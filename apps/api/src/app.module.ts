import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AuditModule } from "./common/audit.module.js";
import { EventsModule } from "./common/events.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ContentTypesModule } from "./modules/content-types/content-type.module.js";
import { DbModule } from "./modules/db/db.module.js";
import { EntriesModule } from "./modules/entries/entry.module.js";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * 应用根模块。
 * Phase 3：在 Phase 2 基础上挂 Entry CRUD + 草稿/发布 + 全局事件总线。
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
    HealthModule,
  ],
})
export class AppModule {}
