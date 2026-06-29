import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ContentTypeController } from "./content-type.controller.js";
import { ContentTypeService } from "./content-type.service.js";
import {
  CT_REPO,
  DrizzleContentTypeRepository,
} from "./content-type.repository.js";

/**
 * 内容类型模块。
 * 导入 AuthModule 以获得 JwtAuthGuard；CT_REPO 用 Drizzle 实现，单测可替换为内存假实现。
 */
@Module({
  imports: [AuthModule],
  controllers: [ContentTypeController],
  providers: [
    ContentTypeService,
    DrizzleContentTypeRepository,
    { provide: CT_REPO, useExisting: DrizzleContentTypeRepository },
  ],
  exports: [ContentTypeService],
})
export class ContentTypesModule {}
