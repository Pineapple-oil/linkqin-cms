import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { WebhookController } from "./webhook.controller.js";
import { WebhookService } from "./webhook.service.js";
import { WEBHOOK_REPO, DrizzleWebhookRepository } from "./webhook.repository.js";

/**
 * Webhook 模块（开发文档 §10）。
 * 导入 AuthModule（JwtAuthGuard）。WEBHOOK_REPO 用 Drizzle 实现。
 * WebhookService 实现 OnModuleInit，启动时订阅 entry.* 事件。
 */
@Module({
  imports: [AuthModule],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    DrizzleWebhookRepository,
    { provide: WEBHOOK_REPO, useExisting: DrizzleWebhookRepository },
  ],
  exports: [WebhookService],
})
export class WebhooksModule {}
