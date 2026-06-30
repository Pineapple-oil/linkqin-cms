import { ApiTags } from "@nestjs/swagger";
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
import type { MultipartFile } from "@fastify/multipart";
import { type UpdateAssetInput, okList } from "@linkqin/shared";
import { AuditService } from "../../common/audit.service.js";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { okWithRequest } from "../../common/response.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AssetService } from "./asset.service.js";

/**
 * 资产管理端点（开发文档 7.1 /api/admin/assets）。
 * - POST   /api/admin/assets/upload   上传（multipart，需 asset:upload）
 * - GET    /api/admin/assets           列表（分页，需 asset:read）
 * - GET    /api/admin/assets/:id       详情（需 asset:read）
 * - PATCH  /api/admin/assets/:id       改元数据（需 asset:update）
 * - DELETE /api/admin/assets/:id       删除（需 asset:delete）
 */
@ApiTags("媒体资产")
@Controller("admin/assets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetController {
  constructor(
    private readonly service: AssetService,
    private readonly audit: AuditService,
  ) {}

  @Post("upload")
  @RequirePermissions("asset:upload")
  async upload(@Req() request: FastifyRequest) {
    // @fastify/multipart 注入 request.file()；类型通过模块加载增强，这里用接口收窄。
    const file = (await (request as unknown as {
      file: () => Promise<MultipartFile | undefined>;
    }).file()) as MultipartFile | undefined;
    if (!file) {
      throw new Error("未提供文件");
    }
    const buffer = await file.toBuffer();
    const actorId = currentUser(request);
    const data = await this.service.upload(
      { filename: file.filename, mimeType: file.mimetype, buffer },
      actorId,
    );
    return okWithRequest(request, data);
  }

  @Get()
  @RequirePermissions("asset:read")
  async list(
    @Query("type") type: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, Number(pageSize) || 20));
    // type=image 仅返回图片。
    const mimeTypePrefix = type === "image" ? "image/" : undefined;
    const { items, total } = await this.service.list(
      { mimeTypePrefix },
      { page: pageNum, pageSize: pageSizeNum },
    );
    const pageCount = pageSizeNum === 0 ? 0 : Math.ceil(total / pageSizeNum);
    return okList(items, { page: pageNum, pageSize: pageSizeNum, total, pageCount }, request.id);
  }

  @Get(":id")
  @RequirePermissions("asset:read")
  async getById(@Param("id") id: string, @Req() request: FastifyRequest) {
    const data = await this.service.getById(id);
    return okWithRequest(request, data);
  }

  @Patch(":id")
  @RequirePermissions("asset:update")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const data = await this.service.update(id, body as UpdateAssetInput, currentUser(request));
    return okWithRequest(request, data);
  }

  @Delete(":id")
  @RequirePermissions("asset:delete")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest) {
    await this.service.remove(id, currentUser(request));
    return okWithRequest(request, { ok: true });
  }
}

function currentUser(request: FastifyRequest): string | null {
  return (request as unknown as { user?: { id: string } }).user?.id ?? null;
}
