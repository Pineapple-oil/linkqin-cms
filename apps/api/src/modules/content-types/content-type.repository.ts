import { Inject, Injectable } from "@nestjs/common";
import { count, eq } from "drizzle-orm";
import {
  type Database,
  contentTypes,
  entries,
} from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";

/**
 * 内容类型数据访问：把所有 Drizzle 查询收敛到这里，
 * Content Type Service 只依赖本接口，便于单测用内存假实现替换（开发文档测试策略）。
 *
 * CT_REPO 是注入 token（interface 无法直接被 Nest 解析）。
 */
export const CT_REPO = Symbol("CT_REPO");

/** 内容类型行 DTO（不暴露 raw Drizzle 行，字段形态与 @linkqin/shared 的 ContentType 对齐）。 */
export interface ContentTypeRow {
  id: string;
  uid: string;
  kind: string;
  displayName: string;
  description: string | null;
  fields: unknown[];
  options: Record<string, unknown>;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建时写入的 DB 值（必填列齐全）。 */
export interface ContentTypeInsert {
  uid: string;
  kind: string;
  displayName: string;
  description?: string | null;
  fields?: unknown[];
  options?: Record<string, unknown>;
  schemaVersion?: number;
}

/** 更新时写入的 DB 值（部分列，uid/kind 不可改）。 */
export interface ContentTypeUpsert {
  displayName?: string;
  description?: string | null;
  fields?: unknown[];
  options?: Record<string, unknown>;
  schemaVersion?: number;
}

export interface ContentTypeRepository {
  list(): Promise<ContentTypeRow[]>;
  findById(id: string): Promise<ContentTypeRow | undefined>;
  findByUid(uid: string): Promise<ContentTypeRow | undefined>;
  create(values: ContentTypeInsert): Promise<ContentTypeRow>;
  update(id: string, values: ContentTypeUpsert): Promise<ContentTypeRow | undefined>;
  delete(id: string): Promise<void>;
  /** 删前检查：该内容类型下有多少条目（开发文档 13）。 */
  countEntries(contentTypeId: string): Promise<number>;
}

/** Drizzle 实现，生产用。 */
@Injectable()
export class DrizzleContentTypeRepository implements ContentTypeRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async list(): Promise<ContentTypeRow[]> {
    const rows = await this.db.select().from(contentTypes);
    return rows.map(toRow);
  }

  async findById(id: string): Promise<ContentTypeRow | undefined> {
    const [row] = await this.db.select().from(contentTypes).where(eq(contentTypes.id, id)).limit(1);
    return row ? toRow(row) : undefined;
  }

  async findByUid(uid: string): Promise<ContentTypeRow | undefined> {
    const [row] = await this.db.select().from(contentTypes).where(eq(contentTypes.uid, uid)).limit(1);
    return row ? toRow(row) : undefined;
  }

  async create(values: ContentTypeInsert): Promise<ContentTypeRow> {
    const [row] = await this.db.insert(contentTypes).values(values).returning();
    return toRow(row!);
  }

  async update(id: string, values: ContentTypeUpsert): Promise<ContentTypeRow | undefined> {
    const [row] = await this.db
      .update(contentTypes)
      .set(values)
      .where(eq(contentTypes.id, id))
      .returning();
    return row ? toRow(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(contentTypes).where(eq(contentTypes.id, id));
  }

  async countEntries(contentTypeId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(entries)
      .where(eq(entries.contentTypeId, contentTypeId));
    return Number(row?.value ?? 0);
  }
}

function toRow(row: {
  id: string;
  uid: string;
  kind: string;
  displayName: string;
  description: string | null;
  fields: unknown;
  options: unknown;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): ContentTypeRow {
  return {
    id: row.id,
    uid: row.uid,
    kind: row.kind,
    displayName: row.displayName,
    description: row.description,
    fields: Array.isArray(row.fields) ? (row.fields as unknown[]) : [],
    options:
      row.options && typeof row.options === "object"
        ? (row.options as Record<string, unknown>)
        : {},
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
