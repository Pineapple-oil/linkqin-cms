import { ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { okWithRequest } from "../../common/response.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PluginService } from "./plugin.service.js";

/**
 * 插件管理端点（开发文档 7.4 /api/admin/plugins）。
 * - GET    /api/admin/plugins           列表（需 plugin:read）
 * - POST   /api/admin/plugins/:name/enable   启用（需 plugin:manage）
 * - POST   /api/admin/plugins/:name/disable  禁用（需 plugin:manage）
 * - GET    /api/admin/plugins/:name/config   读配置（需 plugin:read）
 * - PATCH  /api/admin/plugins/:name/config   改配置（需 plugin:manage）
 */
@ApiTags("插件")
@Controller("admin/plugins")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PluginController {
  constructor(private readonly service: PluginService) {}

  @Get()
  @RequirePermissions("plugin:read")
  async list(@Req() request: FastifyRequest) {
    const data = await this.service.list();
    return okWithRequest(request, data);
  }

  @Post(":name/enable")
  @RequirePermissions("plugin:manage")
  async enable(
    @Param("name") name: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const config = (body as { config?: Record<string, unknown> })?.config;
    const data = await this.service.enable(name, config);
    return okWithRequest(request, data);
  }

  @Post(":name/disable")
  @RequirePermissions("plugin:manage")
  async disable(@Param("name") name: string, @Req() request: FastifyRequest) {
    const data = await this.service.disable(name);
    return okWithRequest(request, data);
  }

  @Get(":name/config")
  @RequirePermissions("plugin:read")
  async getConfig(@Param("name") name: string, @Req() request: FastifyRequest) {
    const data = await this.service.getConfig(name);
    return okWithRequest(request, data);
  }

  @Patch(":name/config")
  @RequirePermissions("plugin:manage")
  async setConfig(
    @Param("name") name: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const config = body as Record<string, unknown>;
    const data = await this.service.setConfig(name, config);
    return okWithRequest(request, data);
  }
}
