import { ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { okWithRequest } from "../../common/response.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ApiTokenService } from "./api-token.service.js";

/**
 * API token 管理端点（开发文档 §18）。
 * - GET    /api/admin/api-tokens      列表（需 api-token:manage）
 * - POST   /api/admin/api-tokens      创建（返回明文 token，仅一次）
 * - DELETE /api/admin/api-tokens/:id  删除
 */
@ApiTags("API Token")
@Controller("admin/api-tokens")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApiTokenController {
  constructor(private readonly service: ApiTokenService) {}

  @Get()
  @RequirePermissions("api-token:manage")
  async list(@Req() request: FastifyRequest) {
    const data = await this.service.list();
    return okWithRequest(request, data);
  }

  @Post()
  @RequirePermissions("api-token:manage")
  async create(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = body as { name: string; scopes?: string[]; expiresAt?: string };
    const actorId = (request as unknown as { user?: { id: string } }).user?.id ?? null;
    const data = await this.service.create({
      name: input.name,
      scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdBy: actorId,
    });
    return okWithRequest(request, data);
  }

  @Delete(":id")
  @RequirePermissions("api-token:manage")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest) {
    await this.service.remove(id);
    return okWithRequest(request, { ok: true });
  }
}
