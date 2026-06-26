import type { FieldType, FieldDefinition } from "@linkqin/shared";
import type { FieldTypeDefinition, FieldRegistry as IFieldRegistry } from "@linkqin/plugin-sdk";
import type { ZodTypeAny } from "zod";
import { z } from "zod";

/**
 * 字段注册表：核心能力。
 * 规则（开发文档 6.2）：
 * - type 必须存在于注册表。
 * - 插件可注册新字段类型。
 * - 字段必须能转换为后台表单配置、API DTO 校验、内容输出 schema。
 *
 * 不要在业务代码里用字符串拼字段校验。
 *
 * 这里实现 plugin-sdk 的 FieldRegistry 接口，core 与插件共用同一套字段类型契约，
 * 由 PluginHost 持有实例并注入到插件上下文（不再用模块级单例，便于测试隔离）。
 */
export type { FieldTypeDefinition };

/**
 * 内部存储条目：直接复用 plugin-sdk 的 FieldTypeDefinition，
 * core 与插件看到的字段类型结构完全一致。
 */
export type RegisteredFieldType = FieldTypeDefinition;

export class FieldRegistry implements IFieldRegistry {
  private readonly types = new Map<string, RegisteredFieldType>();

  constructor() {
    this.registerBuiltins();
  }

  /** 注册一个字段类型，重复注册抛错。 */
  register(definition: RegisteredFieldType): void {
    if (this.types.has(definition.name)) {
      throw new Error(`Field type "${definition.name}" is already registered`);
    }
    this.types.set(definition.name, definition);
  }

  has(name: string): boolean {
    return this.types.has(name);
  }

  get(name: string): RegisteredFieldType | undefined {
    return this.types.get(name);
  }

  /** 生成某个字段定义对应的运行时校验器。 */
  validatorFor(field: FieldDefinition): ZodTypeAny {
    const entry = this.types.get(field.type);
    if (!entry) {
      throw new Error(`Unknown field type: ${field.type}`);
    }
    // 必填字段保持原 schema；非必填字段允许缺省（undefined）。
    // 注意：空字符串 "" 是合法的字符串值，不应被静默丢弃。
    return field.required ? entry.validator : entry.validator.optional();
  }

  private registerBuiltins(): void {
    const builtins: Record<FieldType, RegisteredFieldType> = {
      text: { name: "text", validator: z.string() },
      textarea: { name: "textarea", validator: z.string() },
      richText: { name: "richText", validator: z.string() },
      number: { name: "number", validator: z.number() },
      boolean: { name: "boolean", validator: z.boolean() },
      date: { name: "date", validator: z.union([z.string(), z.coerce.date()]) },
      select: { name: "select", validator: z.string() },
      multiSelect: { name: "multiSelect", validator: z.array(z.string()) },
      media: { name: "media", validator: z.string(), isRelation: true },
      relation: { name: "relation", validator: z.string(), isRelation: true },
      component: { name: "component", validator: z.record(z.string(), z.unknown()) },
      componentList: {
        name: "componentList",
        validator: z.array(z.record(z.string(), z.unknown())),
      },
      json: { name: "json", validator: z.unknown() },
      slug: { name: "slug", validator: z.string().regex(/^[a-z0-9-]*$/) },
    };
    for (const def of Object.values(builtins)) {
      this.register(def);
    }
  }
}
