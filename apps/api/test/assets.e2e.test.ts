import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { resolve } from "node:path";
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
  assets,
  type Database,
} from "@linkqin/db";

/**
 * Phase 4 端到端：媒体上传 + 公开 populate（文档 §15 验收）。
 * 需要 Postgres：探活，连不上则 skip。
 */
const TEST_URL =
  process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin";

// 1x1 PNG。
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

let db: Database | null = null;
let app: NestFastifyApplication | null = null;
let fastify: FastifyInstance | null = null;
const suffix = `_${Date.now()}`;
const adminUsername = `asset_admin${suffix}`;
const adminRoleKey = `asset_admin_role${suffix}`;
const ctUid = `e2e_img${suffix}`;
let adminRoleId = "";
let adminUserId = "";
let accessToken = "";
let contentTypeId = "";
let assetId = "";
let entryId = "";

async function probeDb(): Promise<boolean> {
  try {
    const probe = createDb(TEST_URL);
    await probe.execute("select 1");
    db = probe;
    return true;
  } catch {
    // 连接失败：关闭探测客户端，避免 worker 挂起。
    try { await closeDb(probe); } catch { /* ignore */ }
    db = null;
    return false;
  }
}

const HAS_DB = await probeDb();

beforeAll(async () => {
  if (!HAS_DB || !db) return;

  const [role] = await db
    .insert(roles)
    .values({ key: adminRoleKey, displayName: "Asset Admin", isSystem: false })
    .returning();
  adminRoleId = role!.id;
  const [user] = await db
    .insert(users)
    .values({
      username: adminUsername,
      passwordHash: await hash("Asset-pass!1"),
      displayName: "Asset Admin",
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
  await app.register(multipart as never, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(fastifyStatic as never, {
    root: resolve("./storage"),
    prefix: "/uploads/",
    decorateReply: false,
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix("api");
  await app.init();
  fastify = adapter.getInstance() as unknown as FastifyInstance;

  const login = await fastify.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: adminUsername, password: "Asset-pass!1" },
  });
  accessToken = login.json().data.accessToken;

  const ct = await fastify.inject({
    method: "POST",
    url: "/api/admin/content-types",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      uid: ctUid,
      kind: "collection",
      displayName: "图文",
      fields: [
        { name: "title", type: "text", label: "标题", required: true },
        { name: "cover", type: "media", label: "封面" },
      ],
    },
  });
  contentTypeId = ct.json().data.id;
}, 60000);

afterAll(async () => {
  if (app) await app.close();
  if (db) {
    await db.delete(entries).where(like(entries.slug, `e2e-img${suffix}%`)).catch(() => undefined);
    await db.delete(assets).where(like(assets.filename, `e2e-pic${suffix}%`)).catch(() => undefined);
    await db.delete(contentTypes).where(eq(contentTypes.uid, ctUid));
    if (adminUserId) await db.delete(users).where(eq(users.id, adminUserId));
    if (adminRoleId) await db.delete(roles).where(eq(roles.id, adminRoleId));
    await closeDb(db);
  }
});

const authHeader = () => ({ authorization: `Bearer ${accessToken}` });

describe.skipIf(!HAS_DB)("media upload + populate (e2e)", () => {
  it("uploads an image and returns url/width/height (acceptance: 可上传图片)", async () => {
    if (!fastify) return;
    const boundary = "----testboundary";
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="e2e-pic${suffix}.png"\r\n`),
      Buffer.from("Content-Type: image/png\r\n\r\n"),
      Buffer.from(PNG_B64, "base64"),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/assets/upload",
      headers: { ...authHeader(), "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.mimeType).toBe("image/png");
    expect(data.width).toBe(1);
    expect(data.height).toBe(1);
    expect(data.url).toContain("/uploads/");
    assetId = data.id;
  });

  it("lists assets", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "GET",
      url: "/api/admin/assets?type=image",
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it("updates alt (acceptance: 公开 API 返回 alt)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "PATCH",
      url: `/api/admin/assets/${assetId}`,
      headers: authHeader(),
      payload: { alt: "封面图片" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.alt).toBe("封面图片");
  });

  it("creates an entry referencing the asset and populate=media returns url+alt", async () => {
    if (!fastify) return;
    const createRes = await fastify.inject({
      method: "POST",
      url: "/api/admin/entries",
      headers: authHeader(),
      payload: {
        contentTypeId,
        slug: `e2e-img${suffix}`,
        data: { title: "带图文章", cover: assetId },
      },
    });
    expect(createRes.statusCode).toBe(200);
    entryId = createRes.json().data.id;

    // 发布。
    await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/publish`,
      headers: authHeader(),
    });

    // 公开 API + populate=media：cover 应被替换为 {id,url,alt}。
    const res = await fastify.inject({
      method: "GET",
      url: `/api/content/${ctUid}?populate=media`,
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    const cover = list[0].data.cover;
    expect(cover.id).toBe(assetId);
    expect(cover.url).toContain("/uploads/");
    expect(cover.alt).toBe("封面图片");
  });

  it("without populate, cover is the raw asset id string", async () => {
    if (!fastify) return;
    const res = await fastify.inject({ method: "GET", url: `/api/content/${ctUid}` });
    const list = res.json().data;
    expect(list[0].data.cover).toBe(assetId);
  });

  it("serves the uploaded file via /uploads", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "GET",
      url: `/api/content/${ctUid}?populate=media`,
    });
    const url: string = res.json().data[0].data.cover.url;
    const fileRes = await fastify.inject({ method: "GET", url: url.replace("http://localhost:3000", "") });
    expect(fileRes.statusCode).toBe(200);
  });

  it("deletes the asset", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "DELETE",
      url: `/api/admin/assets/${assetId}`,
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.ok).toBe(true);
  });
});
