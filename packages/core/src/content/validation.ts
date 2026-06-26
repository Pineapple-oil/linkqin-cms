import type { ContentType, FieldDefinition } from "@linkqin/shared";
import { z } from "zod";
import type { FieldRegistry } from "../fields/registry.js";

export interface ValidationResult {
  success: boolean;
  /** 校验后的数据（含默认值填充）。 */
  data?: Record<string, unknown>;
  /** 字段级错误，key 为字段 name。 */
  errors?: Record<string, string[]>;
}

/**
 * 内容引擎：根据 Content Type 的字段定义，
 * 动态构造 Zod schema 并校验 Entry 的 data。
 *
 * 开发文档规则：
 * - 动态内容字段不要用临时字符串拼接校验，必须走字段注册表和 Zod schema。
 */
export class ContentValidator {
  constructor(private readonly fields: FieldRegistry) {}

  /** 根据 content type 构造一个对象 schema。 */
  buildSchema(contentType: ContentType): z.ZodTypeAny {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const field of contentType.fields) {
      shape[field.name] = this.fields.validatorFor(field);
    }
    // 只允许声明过的字段，防止写入未定义数据。
    return z.object(shape).strict();
  }

  /** 校验 entry data。 */
  validate(contentType: ContentType, data: Record<string, unknown>): ValidationResult {
    const schema = this.buildSchema(contentType);
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data as Record<string, unknown> };
    }
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = (issue.path[0] ?? "_").toString();
      (errors[key] ??= []).push(issue.message);
    }
    return { success: false, errors };
  }

  /** 从 data 中取一个字段的展示标题（用于 titleSnapshot）。 */
  pickTitleField(contentType: ContentType, data: Record<string, unknown>): string | undefined {
    const titleField: FieldDefinition | undefined =
      contentType.fields.find((f) => f.name === "title") ?? contentType.fields[0];
    if (!titleField) return undefined;
    const value = data[titleField.name];
    return typeof value === "string" ? value : undefined;
  }
}
