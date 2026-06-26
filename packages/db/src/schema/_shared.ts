import { sql } from "drizzle-orm";
import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * 公共列构造器（不要用对象展开，会丢失 Drizzle 的 builder 类型推断）。
 * 每个表直接调用这些函数定义自己的列。
 */

/** 主键 uuid 列。 */
export const pkId = () => uuid("id").primaryKey().defaultRandom();

export const createdAtColumn = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`);

export const updatedAtColumn = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`);

/**
 * JSONB 自定义类型：Drizzle 对 jsonb 的封装默认是 unknown，
 * 这里保持 json 类型语义，让 ORM 层做强类型转换。
 */
export const jsonbColumn = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return "jsonb";
  },
});
