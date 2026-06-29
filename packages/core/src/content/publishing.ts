import type { Entry, EntryStatus } from "@linkqin/shared";

/**
 * 发布状态机：草稿 <-> 发布 <-> 归档。
 *
 * 策略（开发文档 10）：
 * - 编辑内容只改 data。
 * - 发布时把 data 拷贝到 publishedData，记录 publishedAt / publishedBy。
 * - 公开 API 默认读取 publishedData。
 */
export type PublishAction = "publish" | "unpublish" | "archive";

export interface PublishTransition {
  from: EntryStatus;
  action: PublishAction;
  to: EntryStatus;
}

const ALLOWED: PublishTransition[] = [
  { from: "draft", action: "publish", to: "published" },
  // 已发布内容可「重新发布」：编辑 data 后再次快照到 publishedData（开发文档 §10）。
  { from: "published", action: "publish", to: "published" },
  { from: "published", action: "unpublish", to: "draft" },
  { from: "draft", action: "archive", to: "archived" },
  { from: "published", action: "archive", to: "archived" },
  { from: "archived", action: "publish", to: "published" },
];

export function canTransition(from: EntryStatus, action: PublishAction): boolean {
  return ALLOWED.some((t) => t.from === from && t.action === action);
}

export function nextStatus(from: EntryStatus, action: PublishAction): EntryStatus {
  const t = ALLOWED.find((x) => x.from === from && x.action === action);
  if (!t) {
    throw new Error(`Invalid publish transition: ${from} --${action}-->`);
  }
  return t.to;
}

export interface PublishContext {
  actorId: string;
  at: Date;
}

/** 应用发布动作，返回新的 entry 字段（不可变，调用方负责持久化）。 */
export function applyPublish(
  entry: Entry,
  action: PublishAction,
  ctx: PublishContext,
): Pick<
  Entry,
  "status" | "publishedData" | "publishedAt" | "publishedBy" | "version" | "updatedAt"
> {
  if (!canTransition(entry.status, action)) {
    throw new Error(
      `Cannot ${action} an entry in status "${entry.status}"`,
    );
  }
  const status = nextStatus(entry.status, action);

  // 发布：把草稿 data 快照到 publishedData。
  if (action === "publish") {
    return {
      status,
      publishedData: entry.data,
      publishedAt: ctx.at,
      publishedBy: ctx.actorId,
      version: entry.version + 1,
      updatedAt: ctx.at,
    };
  }

  // 撤销发布：清除已发布快照，回到草稿。
  if (action === "unpublish") {
    return {
      status,
      publishedData: null,
      publishedAt: null,
      publishedBy: null,
      version: entry.version + 1,
      updatedAt: ctx.at,
    };
  }

  // 归档：保留快照以便恢复，但状态置为 archived。
  return {
    status,
    publishedData: entry.publishedData,
    publishedAt: entry.publishedAt,
    publishedBy: entry.publishedBy,
    version: entry.version + 1,
    updatedAt: ctx.at,
  };
}
