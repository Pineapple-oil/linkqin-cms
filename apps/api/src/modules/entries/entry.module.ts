import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ContentTypesModule } from "../content-types/content-type.module.js";
import { EntryController } from "./entry.controller.js";
import { EntryService } from "./entry.service.js";
import {
  ENTRY_REPO,
  DrizzleEntryRepository,
} from "./entry.repository.js";

/**
 * Entry 模块。
 * 导入 AuthModule（JwtAuthGuard）+ ContentTypesModule（ContentTypeService 用于校验）。
 * AuditService 与 EVENT_BUS 是全局 provider，无需显式 import。
 * ENTRY_REPO 用 Drizzle 实现，单测可替换为内存假实现。
 */
@Module({
  imports: [AuthModule, ContentTypesModule],
  controllers: [EntryController],
  providers: [
    EntryService,
    DrizzleEntryRepository,
    { provide: ENTRY_REPO, useExisting: DrizzleEntryRepository },
  ],
  exports: [EntryService],
})
export class EntriesModule {}
