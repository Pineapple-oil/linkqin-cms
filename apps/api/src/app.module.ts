import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * 应用根模块。
 * Phase 0 只挂健康检查；后续 Phase 按垂直切片追加模块
 * （auth/users/content-types/entries/assets/publishing/webhooks/plugins/audit-logs）。
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
