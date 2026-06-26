import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ERROR_CODES, type AuthUser } from "@linkqin/shared";
import { apiException } from "../../common/errors.js";
import { AuthService } from "./auth.service.js";

/**
 * JWT 认证守卫：从 Authorization: Bearer <token> 校验 access token，
 * 加载完整 AuthUser（含权限）挂到 request.user。
 *
 * 注意：权限校验由 PermissionsGuard 负责，本守卫只做「是否登录」。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
    const header = request.headers["authorization"];
    if (typeof header !== "string" || !header.toLowerCase().startsWith("bearer ")) {
      throw apiException(ERROR_CODES.UNAUTHORIZED, "未登录", undefined, 401);
    }
    const token = header.slice(7).trim();
    const payload = this.auth.verifyAccess(token);

    // 加载最新权限（避免 token 内权限过期后仍生效）。
    const authUser = await this.auth.getMe(payload.sub);
    request.user = authUser;
    return true;
  }
}
