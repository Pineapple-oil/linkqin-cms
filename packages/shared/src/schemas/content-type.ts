import { z } from "zod";
import { CONTENT_TYPE_KINDS } from "../constants/index.js";
import { fieldDefinitionSchema } from "./field.js";

/**
 * Content Type options。
 * 控制是否启用草稿、版本、排序、国际化等能力。
 */
export const contentTypeOptionsSchema = z
  .object({
    draftAndPublish: z.boolean().default(true),
    versions: z.boolean().default(true),
    localized: z.boolean().default(false),
    sortable: z.boolean().default(false),
  })
  .strict();

export type ContentTypeOptions = z.infer<typeof contentTypeOptionsSchema>;

/**
 * Content Type schema。
 */
export const contentTypeSchema = z
  .object({
    id: z.string().optional(),
    uid: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9-]*$/, "uid must be kebab-case"),
    kind: z.enum(CONTENT_TYPE_KINDS),
    displayName: z.string().min(1).max(128),
    description: z.string().max(512).optional(),
    fields: z.array(fieldDefinitionSchema).default([]),
    options: contentTypeOptionsSchema.default({}),
    schemaVersion: z.number().int().nonnegative().default(1),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  })
  .strict();

export type ContentType = z.infer<typeof contentTypeSchema>;

/** 创建 Content Type 请求体。 */
export const createContentTypeInputSchema = contentTypeSchema
  .pick({
    uid: true,
    kind: true,
    displayName: true,
    description: true,
    fields: true,
    options: true,
  })
  .partial({ description: true, fields: true, options: true });

export type CreateContentTypeInput = z.infer<typeof createContentTypeInputSchema>;

/** 更新 Content Type 请求体（所有字段可选）。 */
export const updateContentTypeInputSchema = contentTypeSchema
  .pick({
    displayName: true,
    description: true,
    fields: true,
    options: true,
  })
  .partial();

export type UpdateContentTypeInput = z.infer<typeof updateContentTypeInputSchema>;
