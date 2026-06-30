import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ApiTokenController } from "./api-token.controller.js";
import { ApiTokenService } from "./api-token.service.js";
import { ApiTokenGuard } from "./api-token.guard.js";
import { TOKEN_REPO, DrizzleApiTokenRepository } from "./api-token.repository.js";

/**
 * API token 模块（开发文档 §18）。
 * 导入 AuthModule（JwtAuthGuard 用于管理端点）。
 * ApiTokenGuard 是可选守卫，用于公开 content API。
 */
@Module({
  imports: [AuthModule],
  controllers: [ApiTokenController],
  providers: [
    ApiTokenService,
    ApiTokenGuard,
    DrizzleApiTokenRepository,
    { provide: TOKEN_REPO, useExisting: DrizzleApiTokenRepository },
  ],
  exports: [ApiTokenService, ApiTokenGuard],
})
export class ApiTokensModule {}
