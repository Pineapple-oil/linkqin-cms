import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { AUTH_REPO, DrizzleAuthRepository } from "./auth.repository.js";
import { env } from "../../config/env.js";

/**
 * 认证模块。
 * JwtModule 提供 JwtService；密钥与 TTL 由 env 注入。
 * AUTH_REPO 用 Drizzle 实现，单测可替换为内存假实现。
 */
@Module({
  imports: [
    JwtModule.register({
      secret: env.jwtAccessSecret,
      signOptions: { expiresIn: env.jwtAccessTtl },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    DrizzleAuthRepository,
    { provide: AUTH_REPO, useExisting: DrizzleAuthRepository },
  ],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
