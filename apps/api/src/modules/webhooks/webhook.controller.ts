import { ApiTags } from "@nestjs/swagger";
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
import { okWithRequest } from "../../common/response.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { WebhookService } from "./webhook.service.js";

/**
 * Webhook 管理端点（开发文档 §10 / §15 Phase 6）。
 * - GET    /api/admin/webhooks        列表（需 webhook:manage）
 * - POST   /api/admin/webhooks        创建（返回明文 secret，仅一次）
 * - PATCH  /api/admin/webhooks/:id    更新
 * - DELETE /api/admin/webhooks/:id    删除
 */
@ApiTags("Webhook")
@Controller("admin/webhooks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Get()
  @RequirePermissions("webhook:manage")
  async list(@Req() request: FastifyRequest) {
    const data = await this.service.list();
    return okWithRequest(request, data);
  }

  @Post()
  @RequirePermissions("webhook:manage")
  async create(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = body as { name: string; url: string; events: string[]; enabled?: boolean };
    const data = await this.service.create(input);
    return okWithRequest(request, data);
  }

  @Patch(":id")
  @RequirePermissions("webhook:manage")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const patch = body as { name?: string; url?: string; events?: string[]; enabled?: boolean };
    const data = await this.service.update(id, patch);
    return okWithRequest(request, data);
  }

  @Delete(":id")
  @RequirePermissions("webhook:manage")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest) {
    await this.service.remove(id);
    return okWithRequest(request, { ok: true });
  }
}
