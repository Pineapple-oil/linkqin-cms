import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { AppModule } from "../src/app.module.js";
import { GlobalExceptionFilter } from "../src/common/filters/zod-exception.filter.js";
import { genRequestId, registerRequestId } from "../src/common/response.js";

/**
 * 集成测试：健康检查端点。
 * Phase 0 验收：API health check 可访问。
 *
 * 直接使用 Fastify adapter 实例的 inject，避免 supertest + Fastify 的 TCP 超时问题。
 */
describe("HealthController (e2e)", () => {
  let app: NestFastifyApplication;
  let fastify: FastifyInstance;

  beforeAll(async () => {
    const adapter = new FastifyAdapter({ logger: false, genReqId: genRequestId });
    registerRequestId(adapter.getInstance());
    app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix("api");
    await app.init();
    fastify = adapter.getInstance();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("GET /api/health returns ok with requestId", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("linkqin-cms-api");
    // requestId 应贯穿响应 meta。
    expect(body.meta.requestId).toEqual(expect.any(String));
    // 响应头也应回写 requestId。
    expect(res.headers["x-request-id"]).toBe(body.meta.requestId);
  });

  it("GET /api/health/live returns alive", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/health/live" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("alive");
  });

  it("echoes provided x-request-id header", async () => {
    const res = await fastify.inject({
      method: "GET",
      url: "/api/health/live",
      headers: { "x-request-id": "req-fixed-123" },
    });
    expect(res.json().meta.requestId).toBe("req-fixed-123");
    expect(res.headers["x-request-id"]).toBe("req-fixed-123");
  });
});
