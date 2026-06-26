import type { ZodTypeAny } from "zod";
import type { BackendPluginContext, AdminPluginContext } from "./context.js";

/**
 * 插件元信息 + 生命周期。
 * 见开发文档 8.3 / 8.4。
 *
 * 插件配置以未知形态存储：运行时由 configSchema（Zod）校验，
 * 读取时由 BackendPluginContext.getConfig<T>() 显式指定类型。
 * 因此 PluginDefinition 不携带配置泛型，避免类型噪音。
 */
export interface PluginDefinition {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  /** 核心版本要求。 */
  requires?: { cms?: string };
  /** 配置 schema（必须用 Zod）。 */
  configSchema?: ZodTypeAny;
  backend?: (ctx: BackendPluginContext) => void | Promise<void>;
  admin?: (ctx: AdminPluginContext) => void | Promise<void>;
}

/**
 * 插件入口辅助函数。
 * 插件以 default 导出一个 `definePlugin(...)` 结果。
 */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition;
}
