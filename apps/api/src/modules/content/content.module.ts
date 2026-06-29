import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/asset.module.js";
import { ContentTypesModule } from "../content-types/content-type.module.js";
import { EntriesModule } from "../entries/entry.module.js";
import { ContentController } from "./content.controller.js";

/**
 * 公开内容消费模块（开发文档 7.3 /api/content/*）。
 * 复用 EntryService（只读）+ ContentTypeService（uid 解析）+ AssetService（populate）。
 * 无 guard：公开接口，默认只返回 published 内容。
 */
@Module({
  imports: [ContentTypesModule, EntriesModule, AssetsModule],
  controllers: [ContentController],
})
export class ContentModule {}
