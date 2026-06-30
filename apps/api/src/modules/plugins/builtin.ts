import type { PluginDefinition } from "@linkqin/plugin-sdk";
import { seoPlugin } from "./builtin/seo.js";
import { localStoragePlugin } from "./builtin/local-storage.js";

/**
 * 内置插件清单（开发文档 §15 / §22）。
 *
 * MVP 采用内置清单加载（非动态扫描）：PluginHostService 启动时遍历本数组
 * 调用 host.register。插件视为受信代码（文档明确第一阶段非市场）。
 */
export const builtinPlugins: PluginDefinition[] = [seoPlugin, localStoragePlugin];
