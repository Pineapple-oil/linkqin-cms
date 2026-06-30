import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PluginController } from "./plugin.controller.js";
import { PluginService } from "./plugin.service.js";
import { PluginHostService, PLUGIN_HOST } from "./plugin.host.js";
import { PLUGIN_REPO, DrizzlePluginRepository } from "./plugin.repository.js";

/**
 * 全局插件模块（开发文档 §8）。
 *
 * 提供 PluginHost 单例（PLUGIN_HOST）+ 插件管理 CRUD。
 * host.eventBus 是统一事件总线，host.fields 是共享字段注册表。
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [PluginController],
  providers: [
    PluginHostService,
    { provide: PLUGIN_HOST, useExisting: PluginHostService },
    PluginService,
    DrizzlePluginRepository,
    { provide: PLUGIN_REPO, useExisting: DrizzlePluginRepository },
  ],
  exports: [PluginHostService, PLUGIN_HOST, PluginService],
})
export class PluginsModule {}
