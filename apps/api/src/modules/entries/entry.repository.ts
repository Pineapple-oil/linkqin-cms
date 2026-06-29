import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, asc, eq, type SQL } from "drizzle-orm";
import {
  type Database,
  entries,
  entryVersions,
} from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";
import type { EntryStatus } from "@linkqin/shared";

/**
 * Entry 数据访问：所有 Drizzle 查询收敛到这里，
 * Entry Service 只依赖本接口，便于单测用内存假实现替换。
 */
export const ENTRY_REPO = Symbol("ENTRY_REPO");

/** Entry 行 DTO。 */
export interface EntryRow {
  id: string;
  contentTypeId: string;
  status: string;
  locale: string;
  slug: string | null;
  titleSnapshot: string | null;
  data: Record<string, unknown>;
  publishedData: Record<string, unknown> | null;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  publishedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

/** 版本行 DTO。 */
export interface EntryVersionRow {
  id: string;
  entryId: string;
  version: number;
  data: Record<string, unknown>;
  editedBy: string | null;
  note: string | null;
  createdAt: Date;
}

/** 列表查询过滤。 */
export interface EntryListFilter {
  contentTypeId: string;
  status?: EntryStatus | "all";
  locale?: string;
}

/** 排序：字段名 + 方向。 */
export interface EntrySort {
  field: "publishedAt" | "updatedAt" | "createdAt";
  direction: "asc" | "desc";
}

export interface EntryRepository {
  list(
    filter: EntryListFilter,
    pagination: { page: number; pageSize: number },
    sort: EntrySort,
  ): Promise<{ items: EntryRow[]; total: number }>;
  findById(id: string): Promise<EntryRow | undefined>;
  findPublishedBySlug(
    contentTypeId: string,
    slug: string,
    locale?: string,
  ): Promise<EntryRow | undefined>;
  create(input: {
    contentTypeId: string;
    status?: string;
    locale?: string;
    slug?: string | null;
    titleSnapshot?: string | null;
    data?: Record<string, unknown>;
    createdBy?: string | null;
    version?: number;
  }): Promise<EntryRow>;
  update(
    id: string,
    patch: {
      data?: Record<string, unknown>;
      slug?: string | null;
      titleSnapshot?: string | null;
      updatedBy?: string | null;
      version?: number;
    },
  ): Promise<EntryRow | undefined>;
  /** 应用发布状态补丁（status/publishedData/publishedAt/publishedBy/version）。 */
  applyStatusPatch(
    id: string,
    patch: {
      status: string;
      publishedData?: Record<string, unknown> | null;
      publishedAt?: Date | null;
      publishedBy?: string | null;
      version?: number;
      updatedBy?: string | null;
    },
  ): Promise<EntryRow | undefined>;
  delete(id: string): Promise<void>;
  createVersion(input: {
    entryId: string;
    version: number;
    data: Record<string, unknown>;
    editedBy?: string | null;
    note?: string | null;
  }): Promise<void>;
  listVersions(entryId: string): Promise<EntryVersionRow[]>;
}

/** Drizzle 实现，生产用。 */
@Injectable()
export class DrizzleEntryRepository implements EntryRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async list(
    filter: EntryListFilter,
    pagination: { page: number; pageSize: number },
    sort: EntrySort,
  ): Promise<{ items: EntryRow[]; total: number }> {
    const where = buildListWhere(filter);
    const [totalRow] = await this.db
      .select({ value: count() })
      .from(entries)
      .where(where);
    const total = Number(totalRow?.value ?? 0);

    const orderCol =
      sort.field === "publishedAt"
        ? entries.publishedAt
        : sort.field === "createdAt"
          ? entries.createdAt
          : entries.updatedAt;
    const orderBy = sort.direction === "asc" ? asc(orderCol) : desc(orderCol);

    const rows = await this.db
      .select()
      .from(entries)
      .where(where)
      .orderBy(orderBy)
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize);
    return { items: rows.map(toEntryRow), total };
  }

  async findById(id: string): Promise<EntryRow | undefined> {
    const [row] = await this.db.select().from(entries).where(eq(entries.id, id)).limit(1);
    return row ? toEntryRow(row) : undefined;
  }

  async findPublishedBySlug(
    contentTypeId: string,
    slug: string,
    locale?: string,
  ): Promise<EntryRow | undefined> {
    const conds = [
      eq(entries.contentTypeId, contentTypeId),
      eq(entries.slug, slug),
      eq(entries.status, "published"),
    ];
    if (locale) conds.push(eq(entries.locale, locale));
    const [row] = await this.db
      .select()
      .from(entries)
      .where(and(...conds))
      .limit(1);
    return row ? toEntryRow(row) : undefined;
  }

  async create(input: {
    contentTypeId: string;
    status?: string;
    locale?: string;
    slug?: string | null;
    titleSnapshot?: string | null;
    data?: Record<string, unknown>;
    createdBy?: string | null;
    version?: number;
  }): Promise<EntryRow> {
    const [row] = await this.db.insert(entries).values(input).returning();
    return toEntryRow(row!);
  }

  async update(
    id: string,
    patch: {
      data?: Record<string, unknown>;
      slug?: string | null;
      titleSnapshot?: string | null;
      updatedBy?: string | null;
      version?: number;
    },
  ): Promise<EntryRow | undefined> {
    const [row] = await this.db
      .update(entries)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(entries.id, id))
      .returning();
    return row ? toEntryRow(row) : undefined;
  }

  async applyStatusPatch(
    id: string,
    patch: {
      status: string;
      publishedData?: Record<string, unknown> | null;
      publishedAt?: Date | null;
      publishedBy?: string | null;
      version?: number;
      updatedBy?: string | null;
    },
  ): Promise<EntryRow | undefined> {
    const [row] = await this.db
      .update(entries)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(entries.id, id))
      .returning();
    return row ? toEntryRow(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(entries).where(eq(entries.id, id));
  }

  async createVersion(input: {
    entryId: string;
    version: number;
    data: Record<string, unknown>;
    editedBy?: string | null;
    note?: string | null;
  }): Promise<void> {
    await this.db.insert(entryVersions).values(input);
  }

  async listVersions(entryId: string): Promise<EntryVersionRow[]> {
    const rows = await this.db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.entryId, entryId))
      .orderBy(desc(entryVersions.version));
    return rows.map(toVersionRow);
  }
}

function buildListWhere(filter: EntryListFilter): SQL | undefined {
  const conds: SQL[] = [eq(entries.contentTypeId, filter.contentTypeId)];
  if (filter.status && filter.status !== "all") {
    conds.push(eq(entries.status, filter.status));
  }
  if (filter.locale) conds.push(eq(entries.locale, filter.locale));
  return and(...conds);
}

function toEntryRow(row: {
  id: string;
  contentTypeId: string;
  status: string;
  locale: string;
  slug: string | null;
  titleSnapshot: string | null;
  data: unknown;
  publishedData: unknown;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  publishedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}): EntryRow {
  return {
    id: row.id,
    contentTypeId: row.contentTypeId,
    status: row.status,
    locale: row.locale,
    slug: row.slug,
    titleSnapshot: row.titleSnapshot,
    data: asRecord(row.data),
    publishedData: row.publishedData == null ? null : asRecord(row.publishedData),
    version: row.version,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    publishedBy: row.publishedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

function toVersionRow(row: {
  id: string;
  entryId: string;
  version: number;
  data: unknown;
  editedBy: string | null;
  note: string | null;
  createdAt: Date;
}): EntryVersionRow {
  return {
    id: row.id,
    entryId: row.entryId,
    version: row.version,
    data: asRecord(row.data),
    editedBy: row.editedBy,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
