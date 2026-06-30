import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module.js";
import { AdminController } from "./admin.controller.js";
import { PreviewService } from "../content/preview.service.js";
import { env } from "../../config/env.js";

/**
 * 后台管理模块。
 * 导入 AuthModule 以获得 JwtAuthGuard；PermissionsGuard 用全局 Reflector。
 * PreviewService 用于生成草稿预览 token。
 */
@Module({
  imports: [AuthModule, JwtModule.register({ secret: env.previewTokenSecret })],
  controllers: [AdminController],
  providers: [PreviewService],
})
export class AdminModule {}
