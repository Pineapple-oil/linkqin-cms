import { z } from "zod";
import { PAGINATION } from "../constants/index.js";

/** 查询参数：通用分页。 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z
    .coerce.number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** 内容查询公共参数。 */
export const contentQuerySchema = paginationQuerySchema.extend({
  locale: z.string().optional(),
  sort: z.string().optional(),
  fields: z.string().optional(),
  populate: z.string().optional(),
  filter: z.string().optional(),
});

export type ContentQuery = z.infer<typeof contentQuerySchema>;

/** 分页元信息。 */
export const paginationMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  pageCount: z.number(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** 根据总数和分页参数计算分页元信息。 */
export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    pageCount: pageSize === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
