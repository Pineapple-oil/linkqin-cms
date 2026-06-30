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
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
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
  webhooks,
  webhookDeliveries,
  type Database,
} from "@linkqin/db";

/**
 * Phase 6 端到端：webhook 触发 + API token 拉取 + preview token 读草稿。
 * 需要 Postgres：探活，连不上则 skip。
 */
const TEST_URL =
  process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin";

let db: Database | null = null;
let app: NestFastifyApplication | null = null;
let fastify: FastifyInstance | null = null;
const suffix = `_${Date.now()}`;
const adminUsername = `p6_admin${suffix}`;
const adminRoleKey = `p6_admin_role${suffix}`;
const ctUid = `e2e_p6${suffix}`;
let adminRoleId = "";
let adminUserId = "";
let accessToken = "";
let contentTypeId = "";
let entryId = "";
let apiToken = "";
let webhookId = "";

// 接收 webhook 的本地 mock 服务器。
let mockServer: ReturnType<typeof createServer> | null = null;
let mockPort = 0;
const receivedWebhooks: { event: string; body: string; signature: string }[] = [];

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

  // 启动 mock webhook 接收服务器。
  mockServer = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      receivedWebhooks.push({
        event: req.headers["x-linkqin-event"] as string,
        body,
        signature: req.headers["x-linkqin-signature"] as string,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => mockServer!.listen(0, "127.0.0.1", resolve));
  mockPort = (mockServer!.address() as AddressInfo).port;

  const [role] = await db
    .insert(roles)
    .values({ key: adminRoleKey, displayName: "P6 Admin", isSystem: false })
    .returning();
  adminRoleId = role!.id;
  const [user] = await db
    .insert(users)
    .values({
      username: adminUsername,
      passwordHash: await hash("P6-pass!1"),
      displayName: "P6 Admin",
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
    payload: { username: adminUsername, password: "P6-pass!1" },
  });
  accessToken = login.json().data.accessToken;

  const ct = await fastify.inject({
    method: "POST",
    url: "/api/admin/content-types",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      uid: ctUid,
      kind: "collection",
      displayName: "P6 文章",
      fields: [{ name: "title", type: "text", label: "标题", required: true }],
    },
  });
  contentTypeId = ct.json().data.id;
}, 60000);

afterAll(async () => {
  if (app) await app.close();
  if (mockServer) await new Promise<void>((r) => mockServer!.close(() => r()));
  if (db) {
    await db.delete(webhookDeliveries).where(like(webhookDeliveries.event, "entry.%")).catch(() => undefined);
    await db.delete(webhooks).where(like(webhooks.name, `p6-wh${suffix}%`)).catch(() => undefined);
    await db.delete(entries).where(like(entries.slug, `e2e-p6${suffix}%`)).catch(() => undefined);
    await db.delete(contentTypes).where(eq(contentTypes.uid, ctUid));
    if (adminUserId) await db.delete(users).where(eq(users.id, adminUserId));
    if (adminRoleId) await db.delete(roles).where(eq(roles.id, adminRoleId));
    await closeDb(db);
  }
});

const authHeader = () => ({ authorization: `Bearer ${accessToken}` });

describe.skipIf(!HAS_DB)("Phase 6: webhook + API token + preview (e2e)", () => {
  it("creates a webhook subscribed to entry.published", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/webhooks",
      headers: authHeader(),
      payload: {
        name: `p6-wh${suffix}`,
        url: `http://127.0.0.1:${mockPort}/hook`,
        events: ["entry.published"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.secret).toMatch(/^whsec_/);
    webhookId = res.json().data.id;
  });

  it("publishing an entry triggers the webhook (acceptance: 发布可触发 webhook)", async () => {
    if (!fastify) return;
    receivedWebhooks.length = 0;
    // 创建 + 发布。
    const createRes = await fastify.inject({
      method: "POST",
      url: "/api/admin/entries",
      headers: authHeader(),
      payload: { contentTypeId, slug: `e2e-p6${suffix}`, data: { title: "P6" } },
    });
    entryId = createRes.json().data.id;
    await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/publish`,
      headers: authHeader(),
    });
    // 等待 webhook 投递（同步投递，短暂等一下）。
    await new Promise((r) => setTimeout(r, 500));
    expect(receivedWebhooks.some((w) => w.event === "entry.published")).toBe(true);
    const wh = receivedWebhooks.find((w) => w.event === "entry.published")!;
    expect(wh.signature).toBeTruthy();
  });

  it("creates an API token", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "POST",
      url: "/api/admin/api-tokens",
      headers: authHeader(),
      payload: { name: "P6 CI", scopes: ["content:read"] },
    });
    expect(res.statusCode).toBe(200);
    apiToken = res.json().data.token;
    expect(apiToken.startsWith("lk_")).toBe(true);
  });

  it("pulls content with API token (acceptance: 可用 token 拉取内容)", async () => {
    if (!fastify) return;
    const res = await fastify.inject({
      method: "GET",
      url: `/api/content/${ctUid}`,
      headers: { authorization: `Bearer ${apiToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].data.title).toBe("P6");
  });

  it("generates a preview token and reads draft data", async () => {
    if (!fastify) return;
    // 改草稿（不影响已发布快照）。
    await fastify.inject({
      method: "PATCH",
      url: `/api/admin/entries/${entryId}`,
      headers: authHeader(),
      payload: { data: { title: "P6 edited draft" } },
    });
    // 生成 preview token。
    const ptRes = await fastify.inject({
      method: "POST",
      url: `/api/admin/entries/${entryId}/preview-token`,
      headers: authHeader(),
    });
    expect(ptRes.statusCode).toBe(200);
    const previewToken = ptRes.json().data.token;

    // 用 preview token 读草稿 data。
    const res = await fastify.inject({
      method: "GET",
      url: `/api/content/preview/${entryId}?token=${previewToken}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0].data.title).toBe("P6 edited draft");
  });

  it("preview without token returns 401", async () => {
    if (!fastify) return;
    const res = await fastify.inject({ method: "GET", url: `/api/content/preview/${entryId}` });
    expect(res.statusCode).toBe(401);
  });
});
