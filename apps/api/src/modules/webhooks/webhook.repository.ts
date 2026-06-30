import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { type Database, webhooks, webhookDeliveries } from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";

/** Webhook 数据访问。 */
export const WEBHOOK_REPO = Symbol("WEBHOOK_REPO");

export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  /** 明文 secret 不存储；创建时返回明文，DB 存哈希。 */
  secretHash: string;
  headers: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryRow {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: number | null;
  response: string | null;
  attempt: number;
  success: boolean;
  deliveredAt: Date | null;
  createdAt: Date;
}

export interface WebhookRepository {
  list(): Promise<WebhookRow[]>;
  findById(id: string): Promise<WebhookRow | undefined>;
  create(input: {
    name: string;
    url: string;
    events: string[];
    enabled?: boolean;
    secretHash: string;
    headers?: Record<string, unknown> | null;
  }): Promise<WebhookRow>;
  update(
    id: string,
    patch: {
      name?: string;
      url?: string;
      events?: string[];
      enabled?: boolean;
      secretHash?: string;
      headers?: Record<string, unknown> | null;
    },
  ): Promise<WebhookRow | undefined>;
  delete(id: string): Promise<void>;
  /** 查询订阅了指定事件的已启用 webhook。 */
  listEnabledByEvent(event: string): Promise<WebhookRow[]>;
  /** 记录一次投递。 */
  recordDelivery(input: {
    webhookId: string;
    event: string;
    payload: Record<string, unknown>;
    status: number | null;
    response: string | null;
    attempt: number;
    success: boolean;
    deliveredAt: Date | null;
  }): Promise<void>;
}

@Injectable()
export class DrizzleWebhookRepository implements WebhookRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async list(): Promise<WebhookRow[]> {
    const rows = await this.db.select().from(webhooks);
    return rows.map(toRow);
  }

  async findById(id: string): Promise<WebhookRow | undefined> {
    const [row] = await this.db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    return row ? toRow(row) : undefined;
  }

  async create(input: {
    name: string;
    url: string;
    events: string[];
    enabled?: boolean;
    secretHash: string;
    headers?: Record<string, unknown> | null;
  }): Promise<WebhookRow> {
    const [row] = await this.db.insert(webhooks).values(input).returning();
    return toRow(row!);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      url?: string;
      events?: string[];
      enabled?: boolean;
      secretHash?: string;
      headers?: Record<string, unknown> | null;
    },
  ): Promise<WebhookRow | undefined> {
    const [row] = await this.db
      .update(webhooks)
      .set(patch)
      .where(eq(webhooks.id, id))
      .returning();
    return row ? toRow(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async listEnabledByEvent(event: string): Promise<WebhookRow[]> {
    const all = await this.list();
    return all.filter((w) => w.enabled && w.events.includes(event));
  }

  async recordDelivery(input: {
    webhookId: string;
    event: string;
    payload: Record<string, unknown>;
    status: number | null;
    response: string | null;
    attempt: number;
    success: boolean;
    deliveredAt: Date | null;
  }): Promise<void> {
    await this.db.insert(webhookDeliveries).values(input);
  }
}

function toRow(row: {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  secretHash: string;
  headers: unknown;
  createdAt: Date;
  updatedAt: Date;
}): WebhookRow {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events ?? [],
    enabled: row.enabled,
    secretHash: row.secretHash,
    headers:
      row.headers && typeof row.headers === "object"
        ? (row.headers as Record<string, unknown>)
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
