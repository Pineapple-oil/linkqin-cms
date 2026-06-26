import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminController } from "./admin.controller.js";

/**
 * 后台管理模块。
 * 导入 AuthModule 以获得 JwtAuthGuard；PermissionsGuard 用全局 Reflector。
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
