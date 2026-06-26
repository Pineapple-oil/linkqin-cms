/**
 * @linkqin/plugin-sdk
 * 插件开发 SDK。
 * 约束：插件不得 import apps/api 或 apps/admin 内部代码，只能依赖本包。
 */
export * from "./events.js";
export * from "./registries.js";
export * from "./context.js";
export * from "./define-plugin.js";
