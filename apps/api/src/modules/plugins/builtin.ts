import type { PluginDefinition } from "@linkqin/plugin-sdk";

/**
 * 内置插件清单（开发文档 §15 / §22）。
 *
 * MVP 采用内置清单加载（非动态扫描）：PluginHostService 启动时遍历本数组
 * 调用 host.register。插件视为受信代码（文档明确第一阶段非市场）。
 *
 * Slice 2 在此填充 seo 与 local-storage 两个官方插件。
 */
export const builtinPlugins: PluginDefinition[] = [
  // seo（Slice 2）
  // local-storage（Slice 2）
];
