import { z } from "zod";

/**
 * 媒体资产相关 Zod schema（开发文档 6.4）。
 * 后台与 API 共用，避免两端校验不一致。
 */

/** 资产对外形态（/api/admin/assets 列表与详情）。 */
export const assetSchema = z.object({
  id: z.string(),
  storage: z.string(),
  bucket: z.string().nullable(),
  path: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
  /** 公开访问 URL（由存储驱动派生，非 DB 列）。 */
  url: z.string().optional(),
});

export type Asset = z.infer<typeof assetSchema>;

/** 更新资产元数据请求体（仅 alt/caption，§6.4 第一阶段）。 */
export const updateAssetInputSchema = z
  .object({
    alt: z.string().max(512).optional(),
    caption: z.string().max(2000).optional(),
  })
  .strict();

export type UpdateAssetInput = z.infer<typeof updateAssetInputSchema>;
