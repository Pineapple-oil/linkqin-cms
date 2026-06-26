import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { DbModule } from "./modules/db/db.module.js";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * 应用根模块。
 * Phase 1：DB（全局）+ 健康检查 + 认证 + 后台受保护端点。
 */
@Module({
  imports: [DbModule, AuthModule, AdminModule, HealthModule],
})
export class AppModule {}
