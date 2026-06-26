import type { Database } from "@linkqin/db";

/**
 * Database 注入 token。
 * 所有需要 DB 访问的模块注入 @Inject(DB_TOKEN) Database。
 */
export const DB_TOKEN = Symbol("DB_TOKEN");
export type { Database };
