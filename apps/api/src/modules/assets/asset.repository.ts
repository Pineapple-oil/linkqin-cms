import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, isNull, type SQL } from "drizzle-orm";
import { type Database, assets } from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";

/**
 * Asset 数据访问：所有 Drizzle 查询收敛到这里，
 * Asset Service 只依赖本接口，便于单测用内存假实现替换。
 */
export const ASSET_REPO = Symbol("ASSET_REPO");

/** Asset 行 DTO。 */
export interface AssetRow {
  id: string;
  storage: string;
  bucket: string | null;
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  metadata: Record<string, unknown> | null;
  folderId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetListFilter {
  mimeTypePrefix?: string; // 如 "image/"
  folderId?: string | null;
}

export interface AssetRepository {
  list(
    filter: AssetListFilter,
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: AssetRow[]; total: number }>;
  findById(id: string): Promise<AssetRow | undefined>;
  create(input: {
    storage: string;
    bucket?: string | null;
    path: string;
    filename: string;
    mimeType: string;
    size: number;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    caption?: string | null;
    metadata?: Record<string, unknown> | null;
    createdBy?: string | null;
  }): Promise<AssetRow>;
  update(
    id: string,
    patch: { alt?: string | null; caption?: string | null },
  ): Promise<AssetRow | undefined>;
  delete(id: string): Promise<void>;
}

@Injectable()
export class DrizzleAssetRepository implements AssetRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async list(
    filter: AssetListFilter,
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: AssetRow[]; total: number }> {
    const where = buildListWhere(filter);
    const [totalRow] = await this.db.select({ value: count() }).from(assets).where(where);
    const total = Number(totalRow?.value ?? 0);
    const rows = await this.db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize);
    return { items: rows.map(toRow), total };
  }

  async findById(id: string): Promise<AssetRow | undefined> {
    const [row] = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return row ? toRow(row) : undefined;
  }

  async create(input: {
    storage: string;
    path: string;
    filename: string;
    mimeType: string;
    size: number;
    createdBy?: string | null;
  }): Promise<AssetRow> {
    const [row] = await this.db.insert(assets).values(input).returning();
    return toRow(row!);
  }

  async update(
    id: string,
    patch: { alt?: string | null; caption?: string | null },
  ): Promise<AssetRow | undefined> {
    const [row] = await this.db
      .update(assets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(assets.id, id))
      .returning();
    return row ? toRow(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(assets).where(eq(assets.id, id));
  }
}

function buildListWhere(filter: AssetListFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.mimeTypePrefix) conds.push(ilike(assets.mimeType, `${filter.mimeTypePrefix}%`));
  if (filter.folderId !== undefined) {
    conds.push(filter.folderId === null ? isNull(assets.folderId) : eq(assets.folderId, filter.folderId));
  }
  return and(...conds);
}

function toRow(row: {
  id: string;
  storage: string;
  bucket: string | null;
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  metadata: unknown;
  folderId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AssetRow {
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
    metadata: row.metadata == null ? null : (row.metadata as Record<string, unknown>),
    folderId: row.folderId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
