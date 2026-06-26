import { Module } from "@nestjs/common";
import { DbModule } from "./modules/db/db.module.js";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * 应用根模块。
 * Phase 1：挂 DB 模块（全局）+ 健康检查；auth/admin 模块在后续切片追加。
 */
@Module({
  imports: [DbModule, HealthModule],
})
export class AppModule {}
