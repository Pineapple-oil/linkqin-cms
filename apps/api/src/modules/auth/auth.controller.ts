import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { loginInputSchema, ok } from "@linkqin/shared";
import { AuditService } from "../../common/audit.service.js";
import { okWithRequest } from "../../common/response.js";
import { env } from "../../config/env.js";
import { AuthService, REFRESH_COOKIE } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

/**
 * 认证端点（开发文档 7.1 /api/auth/*）。
 * - access token 走 Authorization: Bearer，由前端存储。
 * - refresh token 走 httpOnly cookie（linkqin_refresh），由浏览器自动发送。
 *
 * 注意：用 @Res({ passthrough: true }) 写 cookie——passthrough 模式下
 * 控制器照常 return 响应体，Nest 会自动序列化；我们只额外操作 cookie。
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Post("login")
  async login(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: unknown,
  ) {
    const input = loginInputSchema.parse(body);
    const ctx = { userAgent: request.headers["user-agent"], ip: request.ip };
    try {
      const { accessToken, refreshToken, authUser } = await this.auth.login(input, ctx);
      setRefreshCookie(reply, refreshToken);
      await this.audit.log({
        userId: authUser.id,
        action: "auth.login",
        resource: "user",
        resourceId: authUser.id,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        summary: { username: input.username, success: true },
      });
      return okWithRequest(request, { accessToken, user: authUser });
    } catch (err) {
      // 登录失败也记录审计（userId 未知，记录用户名便于追溯）。
      await this.audit.log({
        userId: null,
        action: "auth.login",
        resource: "user",
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        summary: { username: input.username, success: false },
      });
      throw err;
    }
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
    await this.audit.log({
      userId: authUser.id,
      action: "auth.refresh",
      resource: "user",
      resourceId: authUser.id,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
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
    await this.audit.log({
      userId: currentUser(request),
      action: "auth.logout",
      resource: "user",
      ip: request.ip ?? null,
      userAgent: requestHeaders(request, "user-agent"),
    });
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

/** 从请求读取当前用户 id（logout 时可能无 user，返回 null）。 */
function currentUser(request: FastifyRequest): string | null {
  return (request as unknown as { user?: { id: string } }).user?.id ?? null;
}

/** 从请求读取指定头，统一为 string|null。 */
function requestHeaders(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  return typeof value === "string" ? value : null;
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
