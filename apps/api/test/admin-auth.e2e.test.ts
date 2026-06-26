import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { AppModule } from "../src/app.module.js";
import { GlobalExceptionFilter } from "../src/common/filters/zod-exception.filter.js";
import { genRequestId, registerRequestId } from "../src/common/response.js";

/** Phase 1：未登录不得访问后台 API。 */
describe("Admin auth guard (e2e)", () => {
  let app: NestFastifyApplication;
  let fastify: FastifyInstance;

  beforeAll(async () => {
    const adapter = new FastifyAdapter({ logger: false, genReqId: genRequestId });
    registerRequestId(adapter.getInstance() as unknown as FastifyInstance);
    app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
    await app.register(cookie as never, { secret: "test-access-secret" });
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix("api");
    await app.init();
    fastify = adapter.getInstance() as unknown as FastifyInstance;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("GET /api/admin/whoami without token returns 401 UNAUTHORIZED", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/admin/whoami" });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
