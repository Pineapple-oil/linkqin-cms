import type { EventBus } from "./events.js";
import type {
  FieldRegistry,
  MenuRegistry,
  RouteRegistry,
  PermissionRegistry,
} from "./registries.js";

/**
 * 后端插件上下文。
 * 由核心注入：注册表、事件总线、配置、日志、迁移 API。
 */
export interface BackendPluginContext {
  events: EventBus;
  routes: RouteRegistry;
  permissions: PermissionRegistry;
  /** 读取已启用的插件配置（已通过 schema 校验）。 */
  getConfig<T = unknown>(): T;
  /** 日志接口，禁止插件直接 console 输出生产日志。 */
  logger: PluginLogger;
  /** 迁移 API：插件建表/改表必须走这里，不得直连核心表。 */
  migrations: PluginMigrationApi;
}

export interface AdminPluginContext {
  menu: MenuRegistry;
  fields: FieldRegistry;
  logger: PluginLogger;
}

export interface PluginLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** 插件数据库迁移 API（占位接口，Phase 5 实现）。 */
export interface PluginMigrationApi {
  /** 注册一个迁移步骤，启用插件 / 版本升级时执行。 */
  register(step: PluginMigrationStep): void;
}

export interface PluginMigrationStep {
  /** 目标版本号。 */
  version: number;
  /** 幂等的 up 函数。 */
  up: () => Promise<void>;
}
