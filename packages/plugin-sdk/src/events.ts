/**
 * 插件可订阅的核心事件。
 * 事件名稳定，便于 webhook、搜索索引、发布任务依赖。
 */
export type CoreEventMap = {
  "entry.created": { entryId: string; contentTypeId: string };
  "entry.updated": { entryId: string; contentTypeId: string };
  "entry.published": { entryId: string; contentTypeId: string };
  "entry.unpublished": { entryId: string; contentTypeId: string };
  "asset.created": { assetId: string };
  "contentType.updated": { contentTypeId: string };
};

export type CoreEventName = keyof CoreEventMap;

export type EventHandler<P> = (payload: P) => void | Promise<void>;

/**
 * 事件总线接口（核心实现注入到插件上下文）。
 * 插件事件处理必须幂等。
 */
export interface EventBus {
  on<K extends CoreEventName>(event: K, handler: EventHandler<CoreEventMap[K]>): void;
  off<K extends CoreEventName>(event: K, handler: EventHandler<CoreEventMap[K]>): void;
  emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): Promise<void>;
}
