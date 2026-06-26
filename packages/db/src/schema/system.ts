import { index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonbColumn, pkId, updatedAtColumn } from "./_shared.js";
import { users } from "./identity.js";

/**
 * 系统表（开发文档 13 / 18）。
 * - audit_logs：所有数据写入接口必须写 audit log。
 * - system_settings：站点级键值配置。
 */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pkId(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    resource: varchar("resource", { length: 64 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    /** before/after 摘要。 */
    summary: jsonbColumn("summary"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_resource_idx").on(t.resource, t.resourceId),
    index("audit_logs_action_idx").on(t.action),
  ],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    id: pkId(),
    key: varchar("key", { length: 128 }).notNull().unique(),
    value: jsonbColumn("value").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("system_settings_key_idx").on(t.key)],
);
