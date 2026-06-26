/**
 * 全局常量。
 * 业务代码不得硬编码 "article"、"product" 等示例内容类型，
 * 内容类型 uid 等运行时数据必须走数据库或插件配置。
 */

/** 默认 locale。 */
export const DEFAULT_LOCALE = "zh-CN" as const;

/** API 路由前缀。 */
export const API_PREFIX = "/api" as const;

/** API 路由分组。 */
export const API_GROUPS = {
  ADMIN: "/api/admin",
  CONTENT: "/api/content",
  AUTH: "/api/auth",
  ASSETS: "/api/assets",
  WEBHOOKS: "/api/webhooks",
  PLUGINS: "/api/plugins",
} as const;

/** 内容类型分类。 */
export const CONTENT_TYPE_KINDS = ["collection", "single", "component"] as const;
export type ContentTypeKind = (typeof CONTENT_TYPE_KINDS)[number];

/** 内容条目状态。 */
export const ENTRY_STATUSES = ["draft", "published", "archived"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** 公开内容 API 默认返回的状态。 */
export const PUBLIC_ENTRY_STATUSES: ReadonlyArray<EntryStatus> = ["published"];

/** 分页默认值。 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** 内置基础角色。 */
export const BASE_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;
export type BaseRoleKey = keyof typeof BASE_ROLES;

/** 系统级保留用户名。 */
export const RESERVED_USERNAMES = ["admin", "root", "system", "linkqin"] as const;
