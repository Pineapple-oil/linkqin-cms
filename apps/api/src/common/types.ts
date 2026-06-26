import type { AuthUser } from "@linkqin/shared";

/**
 * 已认证用户类型：JwtAuthGuard 校验通过后挂到 request.user。
 * 复用 @linkqin/shared 的 AuthUser，避免后台/后端类型不一致。
 */
export type AuthenticatedUser = AuthUser;

/** 扩展 FastifyRequest，使守卫/控制器能类型安全地访问 request.user。 */
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
