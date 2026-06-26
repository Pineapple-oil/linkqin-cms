import { z } from "zod";
import { ENTRY_STATUSES, DEFAULT_LOCALE } from "../constants/index.js";

export const entryStatusSchema = z.enum(ENTRY_STATUSES);

/** Entry 数据载荷（动态 JSONB，真实内容由字段类型校验）。 */
export const entryDataSchema = z.record(z.string(), z.unknown());

/** Entry schema（DB 行映射）。 */
export const entrySchema = z.object({
  id: z.string(),
  contentTypeId: z.string(),
  status: entryStatusSchema,
  locale: z.string().default(DEFAULT_LOCALE),
  slug: z.string().optional(),
  titleSnapshot: z.string().optional(),
  data: entryDataSchema,
  publishedData: entryDataSchema.nullable(),
  version: z.number().int().nonnegative(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  publishedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  publishedAt: z.coerce.date().nullable(),
});

export type Entry = z.infer<typeof entrySchema>;

/** 创建 Entry 请求体。 */
export const createEntryInputSchema = z.object({
  contentTypeId: z.string().min(1),
  data: entryDataSchema,
  slug: z.string().optional(),
  titleSnapshot: z.string().optional(),
  locale: z.string().optional(),
});

export type CreateEntryInput = z.infer<typeof createEntryInputSchema>;

/** 更新 Entry 请求体。 */
export const updateEntryInputSchema = z.object({
  data: entryDataSchema.optional(),
  slug: z.string().optional(),
  titleSnapshot: z.string().optional(),
});

export type UpdateEntryInput = z.infer<typeof updateEntryInputSchema>;
