import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { ERROR_CODES } from "@linkqin/shared";
import { apiException } from "../errors.js";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator.js";

/**
 * 权限守卫：校验路由声明的权限点。
 * 必须在 JwtAuthGuard 之后运行（依赖 request.user）。
 *
 * - super_admin（permissions 含 "*"）短路放行。
 * - 未声明 @RequirePermissions 的路由：只要有登录用户即放行。
 * - 声明的权限点中满足任一即放行（OR 语义）。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user;

    // JwtAuthGuard 应已挂载 user；缺失说明未登录或 guard 顺序错误。
    if (!user) {
      throw apiException(ERROR_CODES.UNAUTHORIZED, "未登录", undefined, 401);
    }

    // super_admin 短路。
    if (user.permissions.includes("*")) return true;

    // 未声明权限要求：已登录即放行。
    if (!required || required.length === 0) return true;

    // 满足任一权限点。
    const ok = required.some((p) => user.permissions.includes(p));
    if (!ok) {
      throw apiException(ERROR_CODES.FORBIDDEN, "权限不足", { required }, 403);
    }
    return true;
  }
}
