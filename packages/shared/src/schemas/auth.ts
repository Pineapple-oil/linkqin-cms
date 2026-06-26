import { z } from "zod";

/**
 * 认证相关 Zod schema（开发文档 3.2）。
 * 后台与 API 共用，避免两端校验不一致。
 */

/** 登录请求体。 */
export const loginInputSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/** 登录成功响应：access token（refresh token 走 httpOnly cookie，不在此返回）。 */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** 刷新成功响应。 */
export const refreshTokenResponseSchema = loginResponseSchema;

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;

/** 当前用户信息（/auth/me、JWT payload 对外形态）。 */
export const authUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  roleKey: z.string(),
  permissions: z.array(z.string()),
});

export type AuthUser = z.infer<typeof authUserSchema>;
