import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { AppModule } from "../src/app.module.js";
import { GlobalExceptionFilter } from "../src/common/filters/zod-exception.filter.js";
import { genRequestId, registerRequestId } from "../src/common/response.js";
import { createDb, closeDb, roles, users, type Database } from "@linkqin/db";

/**
 * Phase 1 端到端集成测试：完整认证链路。
 *
 * 需要 Postgres：模块加载时探活，连不上则用 describe.skipIf 跳过整个套件，
 * 保证无 DB 环境下 `pnpm test` 仍全绿（开发文档测试策略）。
 *
 * 覆盖文档 §15 验收：
 * - 登录成功拿 access token + me 返回用户
 * - refresh 轮换（旧 token 失效）
 * - logout 后 refresh 不可用
 * - editor 访问 /api/admin/system → 403
 */
const TEST_URL =
  process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin";

let db: Database | null = null;
let app: NestFastifyApplication | null = null;
let fastify: FastifyInstance | null = null;
const testSuffix = `_${Date.now()}`;
const editorUsername = `e2e_editor${testSuffix}`;
const editorRoleKey = `e2e_editor_role${testSuffix}`;
let editorRoleId = "";
let editorUserId = "";

/** 同步探活：能否连上 Postgres（短超时，失败立即返回 false）。 */
async function probeDb(): Promise<boolean> {
  try {
    const probe = createDb(TEST_URL);
    await probe.execute("select 1");
    db = probe;
    return true;
  } catch {
    db = null;
    return false;
  }
}

// 顶层 await：模块加载时即决定是否跳过。
const HAS_DB = await probeDb();

beforeAll(async () => {
  if (!HAS_DB || !db) return;

  // seed 一个临时 editor 角色与用户（独立于 seed 脚本，可重入）。
  // editor 角色不挂 system:settings 权限 → 用于验证 403。
  const [role] = await db
    .insert(roles)
    .values({ key: editorRoleKey, displayName: "E2E Editor", isSystem: false })
    .returning();
  editorRoleId = role!.id;
  const [user] = await db
    .insert(users)
    .values({
      username: editorUsername,
      passwordHash: await hash("Editor-pass!1"),
      displayName: "E2E Editor",
      roleId: editorRoleId,
      isActive: true,
    })
    .returning();
  editorUserId = user!.id;

  const adapter = new FastifyAdapter({ logger: false, genReqId: genRequestId });
  registerRequestId(adapter.getInstance() as unknown as FastifyInstance);
  app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });
  await app.register(cookie as never, { secret: "test-access-secret" });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix("api");
  await app.init();
  fastify = adapter.getInstance() as unknown as FastifyInstance;
}, 60000);

afterAll(async () => {
  if (app) await app.close();
  if (db) {
    // 清理临时用户/角色。
    if (editorUserId) await db.delete(users).where(eq(users.id, editorUserId));
    if (editorRoleId) await db.delete(roles).where(eq(roles.id, editorRoleId));
    await closeDb(db);
  }
});

// 无 DB 时跳过整个套件，避免标记为 failed。
describe.skipIf(!HAS_DB)("auth full flow (e2e, requires Postgres)", () => {
  it("logs in and returns access token + user", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: editorUsername, password: "Editor-pass!1" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accessToken).toBeTypeOf("string");
    expect(body.data.user.username).toBe(editorUsername);
    // set-cookie 应包含 httpOnly refresh。
    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie) ? setCookie.join(";") : setCookie).toContain("linkqin_refresh");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("/api/auth/me returns current user with bearer token", async () => {
    if (!fastify) return;
    const login = await fastify.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: editorUsername, password: "Editor-pass!1" },
    });
    const token = login.json().data.accessToken;
    const res = await fastify.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.username).toBe(editorUsername);
  });

  it("rotates refresh token (old becomes invalid)", async () => {
    if (!fastify) return;
    const login = await fastify.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: editorUsername, password: "Editor-pass!1" },
    });
    const cookieHeader = extractCookie(login.headers["set-cookie"]);

    // 用旧 refresh cookie 刷新。
    const refresh1 = await fastify.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader },
    });
    expect(refresh1.statusCode).toBe(200);
    expect(refresh1.json().data.accessToken).toBeTypeOf("string");

    // 旧 refresh 应已失效 → 再刷一次返回 401。
    const refresh2 = await fastify.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader },
    });
    expect(refresh2.statusCode).toBe(401);
    expect(refresh2.json().error.code).toBe("REFRESH_TOKEN_INVALID");
  });

  it("logout invalidates refresh token", async () => {
    if (!fastify) return;
    const login = await fastify.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: editorUsername, password: "Editor-pass!1" },
    });
    const cookieHeader = extractCookie(login.headers["set-cookie"]);
    const token = login.json().data.accessToken;

    const logout = await fastify.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieHeader, authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);

    // logout 后 refresh 不可用。
    const refresh = await fastify.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it("editor without system:settings gets 403 on /api/admin/system", async () => {
    if (!fastify) return;
    const login = await fastify.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: editorUsername, password: "Editor-pass!1" },
    });
    const token = login.json().data.accessToken;
    const res = await fastify.inject({
      method: "GET",
      url: "/api/admin/system",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });
});

/** 从 set-cookie 头提取 linkqin_refresh=xxx 部分。 */
function extractCookie(setCookie: unknown): string {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof raw !== "string") return "";
  return raw.split(";")[0] ?? "";
}
