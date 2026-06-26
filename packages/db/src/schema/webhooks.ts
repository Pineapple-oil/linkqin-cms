import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, jsonbColumn, pkId, updatedAtColumn } from "./_shared.js";

/**
 * Webhook 表（开发文档 10 / 13）。
 * 必须支持：签名、重试、失败日志、手动重放。
 */

export const webhooks = pgTable(
  "webhooks",
  {
    id: pkId(),
    name: varchar("name", { length: 128 }).notNull(),
    url: text("url").notNull(),
    /** 订阅的事件名数组。 */
    events: text("events").array().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    /** 用于 HMAC 签名的 secret hash。 */
    secretHash: text("secret_hash").notNull(),
    headers: jsonbColumn("headers"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("webhooks_enabled_idx").on(t.enabled)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: pkId(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 64 }).notNull(),
    payload: jsonbColumn("payload").notNull(),
    status: integer("status"),
    response: text("response"),
    attempt: integer("attempt").notNull().default(0),
    success: boolean("success").notNull().default(false),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index("webhook_deliveries_webhook_idx").on(t.webhookId),
    index("webhook_deliveries_success_idx").on(t.success),
  ],
);
