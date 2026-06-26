import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, jsonbColumn, pkId, updatedAtColumn } from "./_shared.js";
import { users } from "./identity.js";

/**
 * 内容模型表（开发文档 6 / 13）。
 * - content_types：内容类型定义，fields/options 为 JSONB。
 * - entries：通用表 + JSONB data，避免每个内容类型建物理表。
 * - entry_versions：发布/编辑版本快照。
 */

export const contentTypes = pgTable(
  "content_types",
  {
    id: pkId(),
    uid: varchar("uid", { length: 64 }).notNull().unique(),
    kind: varchar("kind", { length: 32 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    description: text("description"),
    fields: jsonbColumn("fields").notNull().default([]),
    options: jsonbColumn("options").notNull().default({}),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("content_types_kind_idx").on(t.kind)],
);

export const entries = pgTable(
  "entries",
  {
    id: pkId(),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    locale: varchar("locale", { length: 16 }).notNull().default("zh-CN"),
    slug: varchar("slug", { length: 255 }),
    titleSnapshot: varchar("title_snapshot", { length: 512 }),
    data: jsonbColumn("data").notNull().default({}),
    publishedData: jsonbColumn("published_data"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index("entries_ct_status_locale_idx").on(t.contentTypeId, t.status, t.locale),
    uniqueIndex("entries_ct_slug_locale_status_idx").on(
      t.contentTypeId,
      t.slug,
      t.locale,
      t.status,
    ),
    index("entries_published_at_idx").on(t.publishedAt),
  ],
);

export const entryVersions = pgTable(
  "entry_versions",
  {
    id: pkId(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonbColumn("data").notNull(),
    editedBy: uuid("edited_by").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [uniqueIndex("entry_versions_entry_version_idx").on(t.entryId, t.version)],
);
