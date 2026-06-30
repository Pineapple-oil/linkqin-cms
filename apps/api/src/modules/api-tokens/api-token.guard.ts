import { type CanActivate, type ExecutionContext, Injectable, Logger } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@linkqin/shared";
import { ApiTokenService } from "./api-token.service.js";

/**
 * API token 可选认证守卫（开发文档 §18）。
 *
 * 用于公开 content API：如果请求带了 Bearer token 且是有效的 API token，
 * 则记录使用（更新 lastUsedAt）并挂 request.user（scopes 作为 permissions）。
 * 如果没有 token 或 token 无效，**不阻断**——published 内容本就公开。
 *
 * 这与 JwtAuthGuard 不同：JwtAuthGuard 是强制的（未登录→401），
 * ApiTokenGuard 是可选的（用于审计/配额，不限制访问）。
 */
@Injectable()
export class ApiTokenGuard implements CanActivate {
  private readonly logger = new Logger("ApiTokenGuard");

  constructor(private readonly tokens: ApiTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
    const header = request.headers["authorization"];
    if (typeof header !== "string" || !header.toLowerCase().startsWith("bearer ")) {
      // 无 token：允许通过（公开内容）。
      return true;
    }
    const rawToken = header.slice(7).trim();
    if (!rawToken.startsWith("lk_")) {
      // 不是 API token 格式（可能是 JWT）：不处理，允许通过。
      return true;
    }
    try {
      const tokenInfo = await this.tokens.validate(rawToken);
      request.user = {
        id: `api-token:${tokenInfo.id}`,
        username: tokenInfo.name,
        displayName: tokenInfo.name,
        roleKey: "api-token",
        permissions: tokenInfo.scopes,
      };
    } catch {
      // token 无效/过期：静默（公开内容仍允许访问）。
      this.logger.warn("Invalid API token presented to public API");
    }
    return true;
  }
}
