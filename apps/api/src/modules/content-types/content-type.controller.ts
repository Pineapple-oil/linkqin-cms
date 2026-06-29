import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  type CreateContentTypeInput,
  type UpdateContentTypeInput,
} from "@linkqin/shared";
import { AuditService } from "../../common/audit.service.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { okWithRequest } from "../../common/response.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ContentTypeService } from "./content-type.service.js";

/**
 * 内容类型管理端点（开发文档 7.4）。
 * - GET    /api/admin/content-types        列表（需 content-type:read）
 * - GET    /api/admin/content-types/:id    详情（需 content-type:read）
 * - POST   /api/admin/content-types        创建（需 content-type:create）
 * - PATCH  /api/admin/content-types/:id    更新（需 content-type:update）
 * - DELETE /api/admin/content-types/:id    删除（需 content-type:delete）
 *
 * super_admin 角色短路放行；字段非法配置返回 CONTENT_TYPE_FIELD_INVALID(400)。
 * 所有写操作写 audit log（开发文档 AI 规则 11）。
 */
@Controller("admin/content-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentTypeController {
  constructor(
    private readonly service: ContentTypeService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions("content-type:read")
  async list(@Req() request: FastifyRequest) {
    const data = await this.service.list();
    return okWithRequest(request, data);
  }

  @Get(":id")
  @RequirePermissions("content-type:read")
  async getById(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.getById(id);
    return okWithRequest(request, data);
  }

  @Post()
  @RequirePermissions("content-type:create")
  async create(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const data = await this.service.create(body as CreateContentTypeInput);
    await this.audit.log({
      ...auditCtx(request),
      action: "content-type.create",
      resource: "content_type",
      resourceId: data.id,
      summary: { uid: data.uid, kind: data.kind, displayName: data.displayName },
    });
    return okWithRequest(request, data);
  }

  @Patch(":id")
  @RequirePermissions("content-type:update")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const data = await this.service.update(id, body as UpdateContentTypeInput);
    await this.audit.log({
      ...auditCtx(request),
      action: "content-type.update",
      resource: "content_type",
      resourceId: data.id,
      summary: { uid: data.uid, displayName: data.displayName, schemaVersion: data.schemaVersion },
    });
    return okWithRequest(request, data);
  }

  @Delete(":id")
  @RequirePermissions("content-type:delete")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest) {
    await this.service.remove(id);
    await this.audit.log({
      ...auditCtx(request),
      action: "content-type.delete",
      resource: "content_type",
      resourceId: id,
    });
    return okWithRequest(request, { ok: true });
  }
}

/** 从请求提取审计上下文：操作者 + 来源 ip/userAgent。 */
function auditCtx(request: FastifyRequest): {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
} {
  const user = (request as unknown as { user?: { id: string } }).user;
  const ua = request.headers["user-agent"];
  return {
    userId: user?.id ?? null,
    ip: request.ip ?? null,
    userAgent: typeof ua === "string" ? ua : null,
  };
}
