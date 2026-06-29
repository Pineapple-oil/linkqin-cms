import { Inject, Injectable } from "@nestjs/common";
import { imageSize } from "image-size";
import {
  type Asset,
  type UpdateAssetInput,
  ERROR_CODES,
  updateAssetInputSchema,
} from "@linkqin/shared";
import { AuditService } from "../../common/audit.service.js";
import { apiException } from "../../common/errors.js";
import { env } from "../../config/env.js";
import {
  ASSET_REPO,
  type AssetListFilter,
  type AssetRepository,
  type AssetRow,
} from "./asset.repository.js";
import { STORAGE_DRIVER, type StorageDriver } from "./storage.driver.js";

/** 上传文件入参（由控制器从 multipart 解析）。 */
export interface UploadFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/** 允许的 mime 前缀白名单（§6.4 第一阶段：图片 + 常见文档）。 */
const ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/json",
  "application/zip",
];

/** 单文件大小上限（默认 10MB，开发文档 18 安全基线）。 */
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * Asset 业务逻辑（开发文档 6.4）。
 *
 * 上传流程：mime/大小校验 → 写存储 → 图片读尺寸 → insert → audit。
 * 元数据编辑：alt/caption。
 * 删除：先删文件再删行。
 */
@Injectable()
export class AssetService {
  constructor(
    @Inject(ASSET_REPO) private readonly repo: AssetRepository,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly audit: AuditService,
  ) {}

  async list(
    filter: AssetListFilter,
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: Asset[]; total: number }> {
    const { items, total } = await this.repo.list(filter, pagination);
    return { items: items.map((r) => toAsset(r, this.storage)), total };
  }

  async getById(id: string): Promise<Asset> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw apiException(ERROR_CODES.ASSET_NOT_FOUND, "资产不存在", undefined, 404);
    }
    return toAsset(row, this.storage);
  }

  async upload(
    file: UploadFile,
    actorId: string | null,
  ): Promise<Asset> {
    // 1. mime 白名单。
    if (!ALLOWED_MIME_PREFIXES.some((p) => file.mimeType.startsWith(p))) {
      throw apiException(
        ERROR_CODES.ASSET_UPLOAD_FAILED,
        `不支持的文件类型：${file.mimeType}`,
        { mimeType: file.mimeType },
      );
    }
    // 2. 大小上限。
    if (file.buffer.byteLength > MAX_SIZE) {
      throw apiException(
        ERROR_CODES.ASSET_UPLOAD_FAILED,
        `文件过大（上限 ${MAX_SIZE / 1024 / 1024}MB）`,
        { size: file.buffer.byteLength },
      );
    }

    // 3. 写存储。
    const saved = await this.storage.save(file.buffer, file.filename, file.mimeType);

    // 4. 图片读尺寸（非图片不读）。
    let width: number | null = null;
    let height: number | null = null;
    if (file.mimeType.startsWith("image/")) {
      try {
        const dim = imageSize(file.buffer);
        width = dim.width ?? null;
        height = dim.height ?? null;
      } catch {
        // 损坏图片：不阻断，尺寸留空。
      }
    }

    // 5. insert。
    const row = await this.repo.create({
      storage: env.storageDriver ?? "local",
      path: saved.path,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.buffer.byteLength,
      width,
      height,
      createdBy: actorId,
    });

    await this.audit.log({
      userId: actorId,
      action: "asset.upload",
      resource: "asset",
      resourceId: row.id,
      summary: { filename: file.filename, mimeType: file.mimeType, size: file.buffer.byteLength },
    });
    return toAsset(row, this.storage);
  }

  async update(id: string, input: UpdateAssetInput, actorId: string | null): Promise<Asset> {
    const parsed = updateAssetInputSchema.parse(input);
    const current = await this.requireAsset(id);
    const updated = await this.repo.update(id, {
      alt: parsed.alt ?? current.alt,
      caption: parsed.caption ?? current.caption,
    });
    if (!updated) {
      throw apiException(ERROR_CODES.ASSET_NOT_FOUND, "资产不存在", undefined, 404);
    }
    await this.audit.log({
      userId: actorId,
      action: "asset.update",
      resource: "asset",
      resourceId: id,
      summary: { alt: parsed.alt, caption: parsed.caption },
    });
    return toAsset(updated, this.storage);
  }

  async remove(id: string, actorId: string | null): Promise<void> {
    const row = await this.requireAsset(id);
    // 先删文件，再删行（文件删失败不阻断行删除——记录告警即可）。
    try {
      await this.storage.delete(row.path);
    } catch {
      // 静默：文件可能已被外部删除。
    }
    await this.repo.delete(id);
    await this.audit.log({
      userId: actorId,
      action: "asset.delete",
      resource: "asset",
      resourceId: id,
    });
  }

  /** 按 id 批量取资产（供 populate 用）。 */
  async findByIds(ids: readonly string[]): Promise<Map<string, Asset>> {
    const map = new Map<string, Asset>();
    for (const id of ids) {
      const row = await this.repo.findById(id);
      if (row) map.set(id, toAsset(row, this.storage));
    }
    return map;
  }

  private async requireAsset(id: string): Promise<AssetRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw apiException(ERROR_CODES.ASSET_NOT_FOUND, "资产不存在", undefined, 404);
    }
    return row;
  }
}

/** DB 行 → 对外 Asset（附 url）。 */
function toAsset(row: AssetRow, storage: StorageDriver): Asset {
  return {
    id: row.id,
    storage: row.storage,
    bucket: row.bucket,
    path: row.path,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
    url: storage.publicUrl(row.path),
  };
}
