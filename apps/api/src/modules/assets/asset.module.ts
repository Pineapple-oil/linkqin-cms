import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AssetController } from "./asset.controller.js";
import { AssetService } from "./asset.service.js";
import {
  ASSET_REPO,
  DrizzleAssetRepository,
} from "./asset.repository.js";
import {
  STORAGE_DRIVER,
  LocalStorageDriver,
} from "./storage.driver.js";

/**
 * 资产模块。
 * 导入 AuthModule（JwtAuthGuard）；STORAGE_DRIVER 用 Local 实现（S3 留插件）。
 * ASSET_REPO 用 Drizzle 实现，单测可替换为内存假实现。
 * AuditService 是全局 provider。
 */
@Module({
  imports: [AuthModule],
  controllers: [AssetController],
  providers: [
    AssetService,
    DrizzleAssetRepository,
    { provide: ASSET_REPO, useExisting: DrizzleAssetRepository },
    LocalStorageDriver,
    { provide: STORAGE_DRIVER, useExisting: LocalStorageDriver },
  ],
  exports: [AssetService],
})
export class AssetsModule {}
