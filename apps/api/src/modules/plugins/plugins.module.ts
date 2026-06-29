import { Global, Module } from "@nestjs/common";
import { PluginHostService, PLUGIN_HOST } from "./plugin.host.js";

/**
 * 全局插件模块（开发文档 §8）。
 *
 * 提供 PluginHost 单例（PLUGIN_HOST token）。host.eventBus 是统一事件总线，
 * host.fields 是共享字段注册表。其他模块注入 PluginHostService 复用。
 *
 * Slice 1 在此追加 plugin repository/service/controller。
 */
@Global()
@Module({
  providers: [
    PluginHostService,
    { provide: PLUGIN_HOST, useExisting: PluginHostService },
  ],
  exports: [PluginHostService, PLUGIN_HOST],
})
export class PluginsModule {}
