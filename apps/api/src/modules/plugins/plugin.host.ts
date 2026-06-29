import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { PluginHost } from "@linkqin/core";
import type { EventBus } from "@linkqin/plugin-sdk";

/**
 * 全局插件宿主（开发文档 §8）。
 *
 * 启动时（OnModuleInit）遍历内置清单 register 所有插件定义，
 * 并 bootAdmin（注册字段类型 + 菜单到 host.fields / host.menus）。
 * 已启用插件的后端 boot 由 PluginService（读 DB enabled 状态）触发。
 *
 * host.eventBus 是唯一事件总线：EntryService 与插件订阅的是同一实例。
 * host.fields 是共享字段注册表：插件注册的字段类型进入内容校验。
 *
 * 禁用插件不破坏启动：boot 包 try/catch，单个插件失败只记日志。
 */
export const PLUGIN_HOST = Symbol("PLUGIN_HOST");

@Injectable()
export class PluginHostService implements OnModuleInit {
  private readonly logger = new Logger("PluginHost");
  readonly host = new PluginHost();

  /** 统一事件总线（供 EventsModule 与 EntryService 复用）。 */
  get eventBus(): EventBus {
    return this.host.eventBus;
  }

  async onModuleInit(): Promise<void> {
    // 动态导入避免循环 + 让 Slice 2 填充清单后自动生效。
    const { builtinPlugins } = await import("./builtin.js");
    for (const def of builtinPlugins) {
      try {
        this.host.register(def);
      } catch (err) {
        this.logger.error(`Failed to register plugin "${def.name}": ${String(err)}`);
      }
    }
    // bootAdmin：注册字段类型 + 菜单（不依赖 enabled，注册表统一建立）。
    try {
      await this.host.bootAdmin();
    } catch (err) {
      this.logger.error(`bootAdmin failed: ${String(err)}`);
    }
    if (builtinPlugins.length > 0) {
      this.logger.log(`Registered ${builtinPlugins.length} builtin plugin(s).`);
    }
  }
}
