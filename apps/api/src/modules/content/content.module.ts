import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/asset.module.js";
import { ApiTokensModule } from "../api-tokens/api-token.module.js";
import { ContentTypesModule } from "../content-types/content-type.module.js";
import { EntriesModule } from "../entries/entry.module.js";
import { ContentController } from "./content.controller.js";

/**
 * 公开内容消费模块（开发文档 7.3 /api/content/*）。
 * 复用 EntryService（只读）+ ContentTypeService（uid 解析）+ AssetService（populate）。
 * 加 ApiTokenGuard（可选）：有 API token 则记录使用，无 token 也允许。
 */
@Module({
  imports: [ContentTypesModule, EntriesModule, AssetsModule, ApiTokensModule],
  controllers: [ContentController],
})
export class ContentModule {}
