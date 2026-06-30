import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AssetsModule } from "./modules/assets/asset.module.js";
import { AuditModule } from "./common/audit.module.js";
import { EventsModule } from "./common/events.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ContentModule } from "./modules/content/content.module.js";
import { ContentTypesModule } from "./modules/content-types/content-type.module.js";
import { DbModule } from "./modules/db/db.module.js";
import { EntriesModule } from "./modules/entries/entry.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PluginsModule } from "./modules/plugins/plugins.module.js";
import { WebhooksModule } from "./modules/webhooks/webhook.module.js";
import { ApiTokensModule } from "./modules/api-tokens/api-token.module.js";

/**
 * 应用根模块。
 * Phase 6：Webhook + 发布集成。
 */
@Module({
  imports: [
    DbModule,
    AuditModule,
    EventsModule,
    AuthModule,
    AdminModule,
    ContentTypesModule,
    EntriesModule,
    ContentModule,
    AssetsModule,
    PluginsModule,
    WebhooksModule,
    ApiTokensModule,
    HealthModule,
  ],
})
export class AppModule {}
