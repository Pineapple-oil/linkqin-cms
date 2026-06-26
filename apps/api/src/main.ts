import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
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
  registerRequestId(adapter.getInstance());

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
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

  await app.listen(env.port, "0.0.0.0");
  console.log(`🚀 linkqin-cms API ready on http://localhost:${env.port}/api`);
}

bootstrap().catch((err: unknown) => {
  console.error("Failed to bootstrap API", err);
  process.exit(1);
});
