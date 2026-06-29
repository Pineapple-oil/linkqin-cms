import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  type CreateEntryInput,
  type EntryStatus,
  type UpdateEntryInput,
  okList,
} from "@linkqin/shared";
import { AuditService } from "../../common/audit.service.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { okWithRequest } from "../../common/response.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { EntryService } from "./entry.service.js";
import type { EntrySort } from "./entry.repository.js";

/**
 * Entry 管理端点（开发文档 7.4）。
 * - GET    /api/admin/entries?contentType=&status=&locale=&page=&pageSize=&sort=
 * - GET    /api/admin/entries/:id
 * - POST   /api/admin/entries
 * - PATCH  /api/admin/entries/:id
 * - DELETE /api/admin/entries/:id
 * - POST   /api/admin/entries/:id/publish|unpublish|archive
 * - GET    /api/admin/entries/:id/versions
 *
 * 所有写操作写 audit log（开发文档 AI 规则 11）。
 */
@Controller("admin/entries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EntryController {
  constructor(
    private readonly service: EntryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions("entry:read")
  async list(
    @Query("contentType") contentType: string,
    @Query("status") status: string | undefined,
    @Query("locale") locale: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("sort") sort: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const sortParsed = parseSort(sort);
    const { items, total } = await this.service.list(
      { contentTypeId: contentType, status: (status as EntryStatus | "all") ?? "all", locale },
      { page: pageNum, pageSize: pageSizeNum },
      sortParsed,
    );
    const pageCount = pageSizeNum === 0 ? 0 : Math.ceil(total / pageSizeNum);
    return okList(items, { page: pageNum, pageSize: pageSizeNum, total, pageCount }, request.id);
  }

  @Get(":id")
  @RequirePermissions("entry:read")
  async getById(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.getById(id);
    return okWithRequest(request, data);
  }

  @Post()
  @RequirePermissions("entry:create")
  async create(@Body() body: unknown, @Req() request: FastifyRequest) {
    const actorId = currentUser(request);
    const data = await this.service.create(body as CreateEntryInput, actorId);
    await this.audit.log({
      ...auditCtx(request),
      action: "entry.create",
      resource: "entry",
      resourceId: data.id,
      summary: { contentTypeId: data.contentTypeId, slug: data.slug },
    });
    return okWithRequest(request, data);
  }

  @Patch(":id")
  @RequirePermissions("entry:update")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const actorId = currentUser(request);
    const data = await this.service.update(id, body as UpdateEntryInput, actorId);
    await this.audit.log({
      ...auditCtx(request),
      action: "entry.update",
      resource: "entry",
      resourceId: data.id,
      summary: { version: data.version },
    });
    return okWithRequest(request, data);
  }

  @Delete(":id")
  @RequirePermissions("entry:delete")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest) {
    await this.service.remove(id);
    await this.audit.log({
      ...auditCtx(request),
      action: "entry.delete",
      resource: "entry",
      resourceId: id,
    });
    return okWithRequest(request, { ok: true });
  }

  @Post(":id/publish")
  @RequirePermissions("entry:publish")
  async publish(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.publishAction(id, "publish", currentUser(request));
    await this.audit.log({
      ...auditCtx(request),
      action: "entry.publish",
      resource: "entry",
      resourceId: id,
      summary: { version: data.version },
    });
    return okWithRequest(request, data);
  }

  @Post(":id/unpublish")
  @RequirePermissions("entry:publish")
  async unpublish(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.publishAction(id, "unpublish", currentUser(request));
    await this.audit.log({
      ...auditCtx(request),
      action: "entry.unpublish",
      resource: "entry",
      resourceId: id,
    });
    return okWithRequest(request, data);
  }

  @Post(":id/archive")
  @RequirePermissions("entry:publish")
  async archive(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.publishAction(id, "archive", currentUser(request));
    await this.audit.log({
      ...auditCtx(request),
      action: "entry.archive",
      resource: "entry",
      resourceId: id,
    });
    return okWithRequest(request, data);
  }

  @Get(":id/versions")
  @RequirePermissions("entry:read")
  async versions(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.listVersions(id);
    return okWithRequest(request, data);
  }
}

/** 解析 sort 查询参数：`-publishedAt` / `updatedAt`。 */
function parseSort(sort: string | undefined): EntrySort {
  const fallback: EntrySort = { field: "updatedAt", direction: "desc" };
  if (!sort) return fallback;
  const desc = sort.startsWith("-");
  const name = desc ? sort.slice(1) : sort;
  if (name === "publishedAt" || name === "createdAt" || name === "updatedAt") {
    return { field: name, direction: desc ? "desc" : "asc" };
  }
  return fallback;
}

function currentUser(request: FastifyRequest): string | null {
  return (request as unknown as { user?: { id: string } }).user?.id ?? null;
}

function auditCtx(request: FastifyRequest): {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
} {
  const ua = request.headers["user-agent"];
  return {
    userId: currentUser(request),
    ip: request.ip ?? null,
    userAgent: typeof ua === "string" ? ua : null,
  };
}
