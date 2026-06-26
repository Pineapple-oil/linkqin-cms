import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { loginInputSchema, ok } from "@linkqin/shared";
import { okWithRequest } from "../../common/response.js";
import { env } from "../../config/env.js";
import { AuthService, REFRESH_COOKIE } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

/**
 * 认证端点（开发文档 7.1 /api/auth/*）。
 * - access token 走 Authorization: Bearer，由前端存储。
 * - refresh token 走 httpOnly cookie（linkqin_refresh），由浏览器自动发送。
 *
 * 注意：本控制器用 @Res() 主动写 cookie，需手动序列化响应体（不返回即不发送）。
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: unknown,
  ) {
    const input = loginInputSchema.parse(body);
    const ctx = { userAgent: request.headers["user-agent"], ip: request.ip };
    const { accessToken, refreshToken, authUser } = await this.auth.login(input, ctx);
    setRefreshCookie(reply, refreshToken);
    return okWithRequest(request, { accessToken, user: authUser });
  }

  @Post("refresh")
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const presented = readRefreshCookie(request);
    const ctx = { userAgent: request.headers["user-agent"], ip: request.ip };
    const { accessToken, refreshToken, authUser } = await this.auth.refresh(presented, ctx);
    setRefreshCookie(reply, refreshToken);
    return okWithRequest(request, { accessToken, user: authUser });
  }

  @Post("logout")
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const presented = readRefreshCookie(request);
    await this.auth.logout(presented);
    clearRefreshCookie(reply);
    return okWithRequest(request, { ok: true });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: FastifyRequest) {
    const userId = (request as unknown as { user: { id: string } }).user.id;
    const user = await this.auth.getMe(userId);
    return ok(user, request.id);
  }
}

/** 读取 refresh cookie；@fastify/cookie 注入 request.cookies。 */
function readRefreshCookie(request: FastifyRequest): string {
  const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies ?? {};
  return cookies[REFRESH_COOKIE] ?? "";
}

function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60,
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}
