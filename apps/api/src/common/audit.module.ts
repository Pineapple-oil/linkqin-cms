import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service.js";

/**
 * 全局审计日志模块。
 * 依赖全局 DbModule 提供的 DB_TOKEN，故无需显式 import DbModule。
 * AuditService 全局可用，所有写操作控制器注入即可。
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
