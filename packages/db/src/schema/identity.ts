import { boolean, index, pgTable, primaryKey, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAtColumn, pkId, updatedAtColumn } from "./_shared.js";

/**
 * 身份与权限表（开发文档 13 / 9）。
 * - users / roles / permissions / role_permissions / api_tokens
 */

export const roles = pgTable("roles", {
  id: pkId(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const users = pgTable("users", {
  id: pkId(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 128 }),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const permissions = pgTable("permissions", {
  id: pkId(),
  /** 权限点，格式 `domain:action`，例如 entry:publish。 */
  name: varchar("name", { length: 128 }).notNull().unique(),
  label: varchar("label", { length: 128 }).notNull(),
  description: text("description"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const apiTokens = pgTable("api_tokens", {
  id: pkId(),
  name: varchar("name", { length: 128 }).notNull(),
  /** 仅存储 hash，不存明文 token。 */
  tokenHash: text("token_hash").notNull().unique(),
  /** token 前缀，用于展示识别。 */
  tokenPrefix: varchar("token_prefix", { length: 16 }).notNull(),
  scopes: text("scopes").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
  createdBy: uuid("created_by"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

/**
 * Refresh token 表（开发文档 3.2 / 18）。
 * refresh token 以哈希存储，不存明文；支持轮换与服务端撤销，
 * 因此「退出登录」能真正让 refresh token 失效。
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: pkId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** argon2 哈希，唯一。 */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    /** 撤销（退出/轮换）时间，null 表示仍有效。 */
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId)],
);

