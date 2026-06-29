import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { eq, like } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { AppModule } from "../src/app.module.js";
import { GlobalExceptionFilter } from "../src/common/filters/zod-exception.filter.js";
import { genRequestId, registerRequestId } from "../src/common/response.js";
import { createDb, closeDb, roles, users, contentTypes, type Database } from "@linkqin/db";

/**
 * Phase 2 端到端集成测试：内容类型 CRUD 全链路。
 *
 * 需要 Postgres：模块加载时探活，连不上则 describe.skipIf 跳过，
 * 保证无 DB 环境下 `pnpm test` 仍全绿。
 *
 * 覆盖文档 §15 Phase 2 验收：
 * - 可创建 article Collection
 * - 可创建 homepage Single
 * - 字段非法配置返回明确错误（400）
 * 以及 list / 重复 uid(409) / update 升 schemaVersion / delete。
 */
const TEST_URL =
  process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin";

let db: Database | null = null;
let app: NestFastifyApplication | null = null;
let fastify: FastifyInstance | null = null;
const suffix = `_${Date.now()}`;
const adminUsername = `ct_admin${suffix}`;
const adminRoleKey = `ct_admin_role${suffix}`;
// 测试用 uid 带后缀，保证并行/重复运行不撞 duplicate。
const articleUid = `e2e_article${suffix}`;
const homepageUid = `e2e_homepage${suffix}`;
let adminRoleId = "";
let adminUserId = "";
let accessToken = "";

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

const HAS_DB = await probeDb();

beforeAll(async () => {
  if (!HAS_DB || !db) return;

  // seed 临时 super_admin 角色 + 用户（permissions 含 *，过所有 @RequirePermissions）。
  const [role] = await db
    .insert(roles)
    .values({ key: adminRoleKey, displayName: "CT Admin", isSystem: false })
    .returning();
  adminRoleId = role!.id;
  const [user] = await db
    .insert(users)
    .values({
      username: adminUsername,
      passwordHash: await hash("Ct-admin-pass!1"),
      displayName: "CT Admin",
      roleId: adminRoleId,
      isActive: true,
    })
    .returning();
  adminUserId = user!.id;

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

  // 登录拿 access token。
  const login = await fastify.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: adminUsername, password: "Ct-admin-pass!1" },
  });
  accessToken = login.json().data.accessToken;
}, 60000);

afterAll(async () => {
  if (app) await app.close();
  if (db) {
    // 清理：删除本测试创建的内容类型 + 临时用户/角色。
    if (adminUserId) await db.delete(users).where(eq(users.id, adminUserId));
    if (adminRoleId) await db.delete(roles).where(eq(roles.id, adminRoleId));
    // 只清理本测试创建的 e2e_ 前缀内容类型，不破坏其它数据。
    await db.delete(contentTypes).where(like(contentTypes.uid, "e2e_%"));
    await closeDb(db);
  }
});

const authHeader = () => ({ authorization: `Bearer ${accessToken}` });

describe.skipIf(!HAS_DB)("content type CRUD (e2e, requires Postgres)", () => {
  it("creates an article Collection (acceptance #1)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/content-types",
      headers: authHeader(),
      payload: {
        uid: articleUid,
        kind: "collection",
        displayName: "文章",
        fields: [{ name: "title", type: "text", label: "标题", required: true }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.uid).toBe(articleUid);
    expect(body.data.kind).toBe("collection");
    expect(body.data.schemaVersion).toBe(1);
  });

  it("creates a homepage Single (acceptance #2)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/content-types",
      headers: authHeader(),
      payload: { uid: homepageUid, kind: "single", displayName: "首页" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.kind).toBe("single");
  });

  it("lists created content types", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "GET",
      url: "/api/admin/content-types",
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const uids = res.json().data.map((c: { uid: string }) => c.uid);
    expect(uids).toContain(articleUid);
    expect(uids).toContain(homepageUid);
  });

  it("rejects duplicate uid with 409", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/content-types",
      headers: authHeader(),
      payload: { uid: articleUid, kind: "collection", displayName: "重复" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONTENT_TYPE_UID_DUPLICATE");
  });

  it("rejects invalid field name with 400 (acceptance #3)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/content-types",
      headers: authHeader(),
      payload: {
        uid: `e2e_bad${suffix}`,
        kind: "collection",
        displayName: "坏",
        fields: [{ name: "Bad_Name", type: "text", label: "坏" }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("CONTENT_TYPE_FIELD_INVALID");
  });

  it("rejects unknown field type with 400", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/content-types",
      headers: authHeader(),
      payload: {
        uid: `e2e_bad2${suffix}`,
        kind: "collection",
        displayName: "坏2",
        fields: [{ name: "x", type: "magic", label: "魔法" }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("CONTENT_TYPE_FIELD_INVALID");
  });

  it("updates article fields and bumps schemaVersion", async () => {
    if (!fastify) return;
    const list = await fastify.inject({
      method: "GET",
      url: "/api/admin/content-types",
      headers: authHeader(),
    });
    const article = list.json().data.find((c: { uid: string }) => c.uid === articleUid);

    const res = await fastify.inject({
      method: "PATCH",
      url: `/api/admin/content-types/${article.id}`,
      headers: authHeader(),
      payload: {
        fields: [
          { name: "title", type: "text", label: "标题" },
          { name: "body", type: "richText", label: "正文" },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.schemaVersion).toBe(2);
  });

  it("deletes a content type with no entries", async () => {
    if (!fastify) return;
    const list = await fastify.inject({
      method: "GET",
      url: "/api/admin/content-types",
      headers: authHeader(),
    });
    const homepage = list.json().data.find((c: { uid: string }) => c.uid === homepageUid);

    const res = await fastify.inject({
      method: "DELETE",
      url: `/api/admin/content-types/${homepage.id}`,
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.ok).toBe(true);
  });

  it("rejects without auth token (401)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({ method: "GET", url: "/api/admin/content-types" });
    expect(res.statusCode).toBe(401);
  });
});
