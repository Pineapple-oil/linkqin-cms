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
 */
@Controller("admin/content-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentTypeController {
  constructor(private readonly service: ContentTypeService) {}

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
    return okWithRequest(request, data);
  }

  @Delete(":id")
  @RequirePermissions("content-type:delete")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest) {
    await this.service.remove(id);
    return okWithRequest(request, { ok: true });
  }
}
