import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AuditModule } from "./common/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ContentTypesModule } from "./modules/content-types/content-type.module.js";
import { DbModule } from "./modules/db/db.module.js";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * 应用根模块。
 * Phase 2：在 Phase 1 基础上挂内容类型 CRUD + 全局审计日志。
 */
@Module({
  imports: [DbModule, AuditModule, AuthModule, AdminModule, ContentTypesModule, HealthModule],
})
export class AppModule {}
