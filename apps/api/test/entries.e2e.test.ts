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
import {
  createDb,
  closeDb,
  roles,
  users,
  contentTypes,
  entries,
  type Database,
} from "@linkqin/db";

/**
 * Phase 3 端到端：草稿/发布/公开 API 隔离（文档 §15 三条验收）。
 *
 * 需要 Postgres：模块加载时探活，连不上则 describe.skipIf 跳过。
 *
 * 验收：
 * 1. 后台可创建文章草稿。
 * 2. 发布后公开 API 可读取。
 * 3. 修改草稿不影响公开 API 的已发布快照。
 * 附加：unpublish 后公开 API 读不到。
 */
const TEST_URL =
  process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin";

let db: Database | null = null;
let app: NestFastifyApplication | null = null;
let fastify: FastifyInstance | null = null;
const suffix = `_${Date.now()}`;
const adminUsername = `entry_admin${suffix}`;
const adminRoleKey = `entry_admin_role${suffix}`;
const ctUid = `e2e_article${suffix}`;
let adminRoleId = "";
let adminUserId = "";
let accessToken = "";
let contentTypeId = "";
let entryId = "";

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

  const [role] = await db
    .insert(roles)
    .values({ key: adminRoleKey, displayName: "Entry Admin", isSystem: false })
    .returning();
  adminRoleId = role!.id;
  const [user] = await db
    .insert(users)
    .values({
      username: adminUsername,
      passwordHash: await hash("Entry-pass!1"),
      displayName: "Entry Admin",
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

  const login = await fastify.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: adminUsername, password: "Entry-pass!1" },
  });
  accessToken = login.json().data.accessToken;

  // 建一个内容类型供 entry 使用。
  const ct = await fastify.inject({
    method: "POST",
    url: "/api/admin/content-types",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      uid: ctUid,
      kind: "collection",
      displayName: "文章",
      fields: [{ name: "title", type: "text", label: "标题", required: true }],
    },
  });
  contentTypeId = ct.json().data.id;
}, 60000);

afterAll(async () => {
  if (app) await app.close();
  if (db) {
    await db.delete(entries).where(like(entries.slug, `e2e-slug${suffix}%`)).catch(() => undefined);
    await db.delete(contentTypes).where(eq(contentTypes.uid, ctUid));
    if (adminUserId) await db.delete(users).where(eq(users.id, adminUserId));
    if (adminRoleId) await db.delete(roles).where(eq(roles.id, adminRoleId));
    await closeDb(db);
  }
});

const authHeader = () => ({ authorization: `Bearer ${accessToken}` });

describe.skipIf(!HAS_DB)("entry draft/publish/public isolation (e2e)", () => {
  it("creates a draft entry (acceptance #1)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/entries",
      headers: authHeader(),
      payload: {
        contentTypeId,
        slug: `e2e-slug${suffix}`,
        data: { title: "Hello" },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe("draft");
    expect(body.data.version).toBe(1);
    entryId = body.data.id;
  });

  it("public API returns nothing before publish", async () => {
    if (!fastify) return;
    const res = await fastify.inject({ method: "GET", url: `/api/content/${ctUid}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it("publishes the entry; public API can read it (acceptance #2)", async () => {
    if (!fastify) return;
    const pub = await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/publish`,
      headers: authHeader(),
    });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().data.status).toBe("published");

    const res = await fastify.inject({ method: "GET", url: `/api/content/${ctUid}` });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].data.title).toBe("Hello");
  });

  it("editing draft does not affect published snapshot (acceptance #3)", async () => {
    if (!fastify) return;
    // 改草稿 data。
    const edit = await fastify.inject({
      method: "PATCH",
      url: `/api/admin/entries/${entryId}`,
      headers: authHeader(),
      payload: { data: { title: "Edited" } },
    });
    expect(edit.statusCode).toBe(200);
    expect(edit.json().data.data.title).toBe("Edited");

    // 公开 API 仍是旧快照 Hello。
    const res = await fastify.inject({ method: "GET", url: `/api/content/${ctUid}` });
    expect(res.json().data[0].data.title).toBe("Hello");
  });

  it("re-publish updates the public snapshot", async () => {
    if (!fastify) return;
    await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/publish`,
      headers: authHeader(),
    });
    const res = await fastify.inject({ method: "GET", url: `/api/content/${ctUid}` });
    expect(res.json().data[0].data.title).toBe("Edited");
  });

  it("unpublish removes it from public API", async () => {
    if (!fastify) return;
    await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/unpublish`,
      headers: authHeader(),
    });
    const res = await fastify.inject({ method: "GET", url: `/api/content/${ctUid}` });
    expect(res.json().data).toHaveLength(0);
  });

  it("fetches a published entry by slug", async () => {
    if (!fastify) return;
    // 先重新发布。
    await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/publish`,
      headers: authHeader(),
    });
    const res = await fastify.inject({
      method: "GET",
      url: `/api/content/${ctUid}/e2e-slug${suffix}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0].data.title).toBe("Edited");
  });

  it("records version history", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "GET",
      url: `/api/admin/entries/${entryId}/versions`,
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const versions = res.json().data;
    // 至少：initial + update + publish + unpublish + publish。
    expect(versions.length).toBeGreaterThanOrEqual(3);
  });
});
