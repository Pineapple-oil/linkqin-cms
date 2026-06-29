import { Global, Module } from "@nestjs/common";
import { InMemoryEventBus } from "@linkqin/core";
import type { EventBus } from "@linkqin/plugin-sdk";

/**
 * 全局事件总线模块（开发文档 §10）。
 * 提供单例 EventBus，entry 等写操作 emit 事件，
 * webhook/搜索索引等消费者（Phase 5/6）通过 on() 订阅。
 *
 * 当前为进程内单实例（非持久化），跨进程场景后续接 Redis。
 */
export const EVENT_BUS = Symbol("EVENT_BUS");

@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useFactory: (): EventBus => new InMemoryEventBus() }],
  exports: [EVENT_BUS],
})
export class EventsModule {}
