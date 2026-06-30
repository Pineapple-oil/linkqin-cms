import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "@linkqin/shared";
import { okWithRequest } from "../../common/response.js";
import { JwtAuthGuard } from "../../modules/auth/jwt-auth.guard.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PreviewService } from "../content/preview.service.js";

/**
 * 后台管理端点（开发文档 7.1 /api/admin/*）。
 * Phase 1：whoami（已登录即可）、system（需 system:settings 权限）。
 * Phase 6：preview-token（生成草稿预览 token，需 entry:read）。
 */
@Controller("admin")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly preview: PreviewService) {}

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

  /** 生成草稿预览 token（开发文档 §10）。 */
  @Post("entries/:id/preview-token")
  @RequirePermissions("entry:read")
  previewToken(@Param("id") id: string, @Req() request: FastifyRequest) {
    const token = this.preview.issue(id);
    return okWithRequest(request, { token, entryId: id });
  }
}
