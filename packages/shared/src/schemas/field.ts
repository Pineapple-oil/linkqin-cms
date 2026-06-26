import { z } from "zod";

/**
 * 第一阶段内置字段类型注册表。
 * 插件可通过 plugin-sdk 扩展新的字段类型，
 * 不要在业务代码里用字符串拼字段校验。
 */
export const BUILTIN_FIELD_TYPES = [
  "text",
  "textarea",
  "richText",
  "number",
  "boolean",
  "date",
  "select",
  "multiSelect",
  "media",
  "relation",
  "component",
  "componentList",
  "json",
  "slug",
] as const;

export type FieldType = (typeof BUILTIN_FIELD_TYPES)[number];

/**
 * 字段定义 schema。
 * 用于 Content Type 中的字段配置校验。
 */
export const fieldSettingsSchema = z
  .object({
    maxLength: z.number().int().positive().optional(),
    minLength: z.number().int().nonnegative().optional(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    targetContentTypeId: z.string().optional(),
    componentTypeId: z.string().optional(),
    multiple: z.boolean().optional(),
    accept: z.array(z.string()).optional(),
    defaultValue: z.unknown().optional(),
  })
  .strict();

export const fieldDefinitionSchema = z
  .object({
    /** 字段名，camelCase。 */
    name: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-zA-Z0-9]*$/, "field name must be camelCase"),
    type: z.enum(BUILTIN_FIELD_TYPES),
    label: z.string().min(1).max(128),
    description: z.string().max(512).optional(),
    required: z.boolean().default(false),
    localized: z.boolean().default(false),
    unique: z.boolean().default(false),
    settings: fieldSettingsSchema.optional(),
  })
  .strict();

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type FieldSettings = z.infer<typeof fieldSettingsSchema>;
