import { Global, Module } from "@nestjs/common";
import type { EventBus } from "@linkqin/plugin-sdk";
import { PluginHostService } from "../modules/plugins/plugin.host.js";

/**
 * 全局事件总线模块（开发文档 §10）。
 *
 * 复用 PluginHost 的 eventBus（同一实例），保证 EntryService emit 的事件
 * 与插件 on() 订阅的是同一个总线。
 *
 * 当前为进程内单实例（非持久化），跨进程场景后续接 Redis。
 */
export const EVENT_BUS = Symbol("EVENT_BUS");

@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: (host: PluginHostService): EventBus => host.eventBus,
      inject: [PluginHostService],
    },
  ],
  exports: [EVENT_BUS],
})
export class EventsModule {}
