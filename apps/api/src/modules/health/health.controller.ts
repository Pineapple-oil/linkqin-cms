import { Controller, Get, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { okWithRequest } from "../../common/response.js";

/**
 * 健康检查端点。
 * Phase 0 验收：API health check 可访问。
 */
@Controller("health")
export class HealthController {
  @Get()
  health(@Req() request: FastifyRequest) {
    return okWithRequest(request, {
      status: "ok",
      service: "linkqin-cms-api",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  @Get("live")
  liveness(@Req() request: FastifyRequest) {
    return okWithRequest(request, { status: "alive" });
  }
}
