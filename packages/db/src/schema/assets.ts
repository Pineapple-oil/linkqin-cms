import { index, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonbColumn, pkId, updatedAtColumn } from "./_shared.js";
import { users } from "./identity.js";

/**
 * 媒体资产表（开发文档 6.4 / 13）。
 * 第一阶段只做上传、列表、删除、元数据编辑。
 */

export const assetFolders = pgTable(
  "asset_folders",
  {
    id: pkId(),
    name: varchar("name", { length: 128 }).notNull(),
    parentId: uuid("parent_id"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("asset_folders_parent_idx").on(t.parentId)],
);

export const assets = pgTable(
  "assets",
  {
    id: pkId(),
    storage: varchar("storage", { length: 32 }).notNull().default("local"),
    bucket: varchar("bucket", { length: 128 }),
    path: varchar("path", { length: 1024 }).notNull().unique(),
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    size: integer("size").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    alt: varchar("alt", { length: 512 }),
    caption: text("caption"),
    metadata: jsonbColumn("metadata"),
    folderId: uuid("folder_id").references(() => assetFolders.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index("assets_folder_idx").on(t.folderId),
    index("assets_mime_idx").on(t.mimeType),
  ],
);
