import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * 创建 Drizzle 数据库客户端。
 * DATABASE_URL 缺省时抛错，避免静默使用错误连接。
 */
export function createDb(databaseUrl?: string): Database {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
    );
  }
  const queryClient = postgres(url, { max: 10 });
  return drizzle(queryClient, { schema });
}
