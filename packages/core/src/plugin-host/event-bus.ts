import type {
  CoreEventMap,
  CoreEventName,
  EventBus,
  EventHandler,
} from "@linkqin/plugin-sdk";

/**
 * 进程内事件总线实现。
 * 注意：单实例，非持久化；跨进程场景后续接 Redis。
 * 插件事件处理必须幂等（webhook、搜索索引、发布任务）。
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<CoreEventName, Set<EventHandler<unknown>>>();

  on<K extends CoreEventName>(event: K, handler: EventHandler<CoreEventMap[K]>): void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as EventHandler<unknown>);
    this.handlers.set(event, set);
  }

  off<K extends CoreEventName>(event: K, handler: EventHandler<CoreEventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  async emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    // 串行执行，便于一个失败时停止链路（生产可换并发+错误隔离）。
    for (const handler of set) {
      await handler(payload);
    }
  }
}
