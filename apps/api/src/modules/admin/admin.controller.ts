import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "@linkqin/shared";
import { okWithRequest } from "../../common/response.js";
import { JwtAuthGuard } from "../../modules/auth/jwt-auth.guard.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";

/**
 * 后台管理端点（开发文档 7.1 /api/admin/*）。
 * Phase 1 演示：whoami（已登录即可）、system（需 system:settings 权限）。
 * 后续切片/Phase 在此追加内容类型、条目等管理端点。
 */
@Controller("admin")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  @Get("whoami")
  whoami(@Req() request: FastifyRequest) {
    return okWithRequest(request, request.user ?? null);
  }

  @Get("system")
  @RequirePermissions("system:settings")
  system(@Req() request: FastifyRequest) {
    // 占位：Phase 2+ 实现系统设置读写。
    return ok({ section: "system", editable: true }, request.id);
  }
}
