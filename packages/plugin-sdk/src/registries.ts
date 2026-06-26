import type { ZodTypeAny } from "zod";
import type { FieldDefinition } from "@linkqin/shared";

/**
 * 字段类型定义：内置字段与插件字段共用同一结构。
 * 插件字段类型的 name 不能与内置字段类型重名。
 *
 * 这是字段注册表的唯一类型契约，core 与 plugin-sdk 共享，
 * 避免出现两套同名字段注册表接口导致类型不一致。
 */
export interface FieldTypeDefinition {
  /** 字段类型名（类型标识符），内置字段见 BUILTIN_FIELD_TYPES。 */
  name: string;
  /** 后台表单使用的展示标签。 */
  label?: string;
  /**
   * 运行时校验 schema。
   * 不要用字符串拼接校验，必须走 Zod。
   */
  validator: ZodTypeAny;
  /** 序列化为 API 输出（默认 identity）。 */
  serialize?: (value: unknown) => unknown;
  /** 该字段是否为关系/媒体（影响 populate 语义）。 */
  isRelation?: boolean;
}

/**
 * 字段注册表接口：core 实现并注入到插件上下文。
 * 插件通过本接口注册自定义字段类型。
 */
export interface FieldRegistry {
  register(definition: FieldTypeDefinition): void;
  has(name: string): boolean;
}

export interface MenuEntry {
  /** 菜单 key，唯一。 */
  key: string;
  label: string;
  /** 后台路由路径。 */
  path: string;
  icon?: string;
  /** 权限点，无权限时隐藏。 */
  permission?: string;
  /** 排序权重，越小越靠前。 */
  order?: number;
}

export interface MenuRegistry {
  add(entry: MenuEntry): void;
  remove(key: string): void;
}

/**
 * 插件声明的路由。
 * 插件不得直接修改核心表结构，必须通过 migration API。
 */
export interface PluginRoute {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  /** 权限点，缺省表示公开。 */
  permission?: string;
  handler: (req: unknown) => Promise<unknown>;
}

export interface RouteRegistry {
  register(route: PluginRoute): void;
}

/** 插件可声明的权限点。 */
export interface PermissionDeclaration {
  /** 权限点，格式 `domain:action`。 */
  name: string;
  label: string;
  description?: string;
}

export interface PermissionRegistry {
  declare(perm: PermissionDeclaration): void;
}

/** 字段定义与内省接口（供插件读取已注册字段）。 */
export type FieldIntrospection = Pick<FieldDefinition, "name" | "type" | "label" | "required">;
