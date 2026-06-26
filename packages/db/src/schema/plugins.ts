import { boolean, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonbColumn, pkId, updatedAtColumn } from "./_shared.js";

/**
 * 插件表（开发文档 13）。
 * 插件不得直接修改核心表结构，必须通过 migration API；
 * 插件配置存储在此，启用前必须通过 Zod schema 校验。
 */

export const plugins = pgTable(
  "plugins",
  {
    id: pkId(),
    name: varchar("name", { length: 128 }).notNull().unique(),
    version: varchar("version", { length: 32 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(false),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("plugins_enabled_idx").on(t.enabled)],
);

export const pluginSettings = pgTable(
  "plugin_settings",
  {
    id: pkId(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    /** JSONB 配置，应用前由 plugin-sdk 的 configSchema 校验。 */
    config: jsonbColumn("config").notNull().default({}),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("plugin_settings_plugin_idx").on(t.pluginId)],
);
