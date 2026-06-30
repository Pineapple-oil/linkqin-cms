import { Inject, Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { EventBus } from "@linkqin/plugin-sdk";
import { ERROR_CODES } from "@linkqin/shared";
import { apiException } from "../../common/errors.js";
import { EVENT_BUS } from "../../common/events.module.js";
import { AuditService } from "../../common/audit.service.js";
import {
  WEBHOOK_REPO,
  type WebhookRepository,
  type WebhookRow,
} from "./webhook.repository.js";

/** 订阅的核心事件（开发文档 §10）。 */
const ENTRY_EVENTS = [
  "entry.created",
  "entry.updated",
  "entry.published",
  "entry.unpublished",
] as const;

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger("WebhookDispatcher");

  constructor(
    @Inject(WEBHOOK_REPO) private readonly repo: WebhookRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly audit: AuditService,
  ) {}

  /** 启动时订阅 entry.* 事件，触发同步投递。 */
  onModuleInit(): void {
    for (const event of ENTRY_EVENTS) {
      this.events.on(event, async (payload) => {
        await this.dispatch(event, payload);
      });
    }
  }

  async list() {
    return this.repo.list();
  }

  async getById(id: string) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw apiException(ERROR_CODES.WEBHOOK_NOT_FOUND, "Webhook 不存在", undefined, 404);
    }
    return row;
  }

  /** 创建 webhook，返回明文 secret（仅此一次）。 */
  async create(input: {
    name: string;
    url: string;
    events: string[];
    enabled?: boolean;
  }): Promise<WebhookRow & { secret: string }> {
    const secret = generateWebhookSecret();
    const secretHash = hashWebhookSecret(secret);
    const row = await this.repo.create({
      name: input.name,
      url: input.url,
      events: input.events,
      enabled: input.enabled ?? true,
      secretHash,
    });
    return { ...row, secret };
  }

  async update(
    id: string,
    patch: { name?: string; url?: string; events?: string[]; enabled?: boolean },
  ) {
    const existing = await this.getById(id);
    const updated = await this.repo.update(id, patch);
    return updated ?? existing;
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await this.repo.delete(id);
  }

  /** 事件分发：查订阅该事件的已启用 webhook，逐个同步投递 + 记录。 */
  private async dispatch(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    let targets: WebhookRow[];
    try {
      targets = await this.repo.listEnabledByEvent(event);
    } catch (err) {
      this.logger.error(`dispatch: listEnabledByEvent failed: ${String(err)}`);
      return;
    }
    for (const webhook of targets) {
      // 不 await 串行——并行投递互不阻塞，但每个内部 try/catch。
      void this.deliver(webhook, event, payload);
    }
  }

  /** 同步投递单个 webhook（HMAC 签名 + 记 delivery）。失败不抛。 */
  private async deliver(
    webhook: WebhookRow,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({ event, payload });
    const signature = signPayload(body, webhook.secretHash);
    let status: number | null = null;
    let responseText: string | null = null;
    let success = false;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Linkqin-Event": event,
          "X-Linkqin-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = res.status;
      success = res.ok;
      responseText = await res.text().catch(() => null);
    } catch (err) {
      responseText = err instanceof Error ? err.message : String(err);
    }

    try {
      await this.repo.recordDelivery({
        webhookId: webhook.id,
        event,
        payload: { event, ...payload },
        status,
        response: responseText?.slice(0, 2000) ?? null,
        attempt: 1,
        success,
        deliveredAt: new Date(),
      });
    } catch (err) {
      this.logger.error(`deliver: recordDelivery failed: ${String(err)}`);
    }
  }
}

/** 生成 webhook 密钥（明文，返回给用户一次）。 */
function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

/** 哈希 webhook 密钥用于存储（scrypt，确定性）。 */
function hashWebhookSecret(secret: string): string {
  return scryptSync(secret, "linkqin-webhook", 64).toString("base64");
}

/** HMAC-SHA256 签名 body（开发文档 §18）。 */
function signPayload(body: string, secretHash: string): string {
  return createHmac("sha256", secretHash).update(body).digest("hex");
}

/** 验证签名（供接收端用，这里导出便于测试）。 */
export function verifySignature(body: string, signature: string, secretHash: string): boolean {
  const expected = signPayload(body, secretHash);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { signPayload, hashWebhookSecret, generateWebhookSecret };
