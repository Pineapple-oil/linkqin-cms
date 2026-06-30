import "reflect-metadata";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { AppModule } from "./app.module.js";
import { GlobalExceptionFilter } from "./common/filters/zod-exception.filter.js";
import { genRequestId, registerRequestId } from "./common/response.js";
import { env } from "./config/env.js";

/**
 * API 服务入口（NestJS + Fastify Adapter）。
 * 健康检查：GET /health、GET /health/live
 */
async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    logger: env.nodeEnv === "production",
    trustProxy: true,
    genReqId: genRequestId,
  });

  // requestId 链路追踪（开发文档 7.2 / 18）：必须在路由注册（app.init）前挂钩子。
  registerRequestId(adapter.getInstance() as unknown as FastifyInstance);

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  // refresh token 走 httpOnly cookie（开发文档 3.2 / 18）。
  // @fastify/cookie v10 与 Fastify 4 类型定义存在已知不匹配，这里强制转型注册。
  await app.register(cookie as never, { secret: env.jwtAccessSecret });
  // 媒体上传：multipart 解析（开发文档 6.4）。
  await app.register(multipart as never, { limits: { fileSize: 10 * 1024 * 1024 } });
  // 公开访问已上传资产：挂 /uploads（在 setGlobalPrefix 之前注册，避免落入 /api 前缀）。
  await app.register(fastifyStatic as never, {
    root: resolve(env.storageLocalDir ?? "./storage"),
    prefix: "/uploads/",
    decorateReply: false,
  });

  // CORS：允许后台（admin）跨域调用。
  app.enableShutdownHooks();
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({
    origin: env.adminUrl ? [env.adminUrl] : true,
    credentials: true,
  });

  // 全局前缀：所有接口在 /api 下（见开发文档 7.1）。
  app.setGlobalPrefix("api");

  // OpenAPI 文档（开发文档 §20 MVP 完成定义）。
  const config = new DocumentBuilder()
    .setTitle("linkqin-cms API")
    .setDescription("轻量级、插件化、API-first 的 Headless CMS")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, { useGlobalPrefix: true });

  await app.listen(env.port, "0.0.0.0");
  console.log(`🚀 linkqin-cms API ready on http://localhost:${env.port}/api`);
}

bootstrap().catch((err: unknown) => {
  console.error("Failed to bootstrap API", err);
  process.exit(1);
});
