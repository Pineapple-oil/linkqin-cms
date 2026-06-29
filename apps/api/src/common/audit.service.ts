import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, auditLogs } from "@linkqin/db";
import { DB_TOKEN } from "./db-token.js";

/**
 * 审计日志服务（开发文档 AI 规则 11 / §18）。
 *
 * 所有数据写入接口必须写 audit log。记录 userId、action、resource、
 * resourceId、before/after 摘要、ip、userAgent。
 *
 * 设计原则：审计日志是旁路记录，**失败不应中断主请求**——
 * 因此 log() 捕获异常并降级为日志告警，不向上抛。
 */
export interface AuditEntry {
  /** 操作者，未登录场景（如登录失败）为 null。 */
  userId: string | null;
  /** 动作，如 content-type.create、auth.login。 */
  action: string;
  /** 资源类型，如 content_type、user。 */
  resource: string;
  /** 资源 id，未涉及具体记录时为 null。 */
  resourceId?: string | null;
  /** before/after 摘要。 */
  summary?: Record<string, unknown>;
  /** 来源请求的 ip / userAgent（由控制器从 FastifyRequest 注入）。 */
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  /**
   * 写一条审计日志。失败时降级为 console 告警，不抛异常。
   * 返回 void，调用方无需 await（除非需要强一致）。
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        summary: entry.summary,
      });
    } catch (err) {
      // 审计是旁路：不能让日志失败拖垮主流程。
      this.logger.error(
        `Failed to write audit log: ${entry.action} ${entry.resource}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
