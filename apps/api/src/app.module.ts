import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module.js";
import { DbModule } from "./modules/db/db.module.js";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * 应用根模块。
 * Phase 1：DB（全局）+ 健康检查 + 认证；admin 受保护端点在后续切片追加。
 */
@Module({
  imports: [DbModule, AuthModule, HealthModule],
})
export class AppModule {}
