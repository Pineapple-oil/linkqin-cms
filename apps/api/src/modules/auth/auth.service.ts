import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import {
  ERROR_CODES,
  type AuthUser,
  type LoginInput,
} from "@linkqin/shared";
import { apiException } from "../../common/errors.js";
import { env } from "../../config/env.js";
import { AUTH_REPO, type AuthRepository } from "./auth.repository.js";

/** refresh token cookie 名。 */
export const REFRESH_COOKIE = "linkqin_refresh";

/** JWT access token payload（内部最小字段）。 */
interface AccessPayload {
  sub: string;
  username: string;
  roleKey: string;
}

/** refresh token 轮换/签发的上下文。 */
export interface IssueContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPO) private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
  ) {}

  /** 登录：校验密码，签发 access token + 持久化 refresh token（哈希）。 */
  async login(
    input: LoginInput,
    ctx: IssueContext,
  ): Promise<{ accessToken: string; refreshToken: string; authUser: AuthUser }> {
    const user = await this.repo.findUserByUsername(input.username);
    if (!user || !user.isActive) {
      throw apiException(ERROR_CODES.INVALID_CREDENTIALS, "用户名或密码错误", undefined, 401);
    }
    const ok = await verify(user.passwordHash, input.password);
    if (!ok) {
      throw apiException(ERROR_CODES.INVALID_CREDENTIALS, "用户名或密码错误", undefined, 401);
    }

    const authUser = await this.loadAuthUser(user);
    const accessToken = this.signAccess(authUser);
    const refreshToken = await this.issueRefresh(user.id, ctx);

    await this.repo.touchLastLogin(user.id);

    return { accessToken, refreshToken, authUser };
  }

  /** 刷新：校验 refresh token 哈希 + 有效期，轮换（删旧发新），返回新 access。 */
  async refresh(
    presentedToken: string,
    ctx: IssueContext,
  ): Promise<{ accessToken: string; refreshToken: string; authUser: AuthUser }> {
    if (!presentedToken) {
      throw apiException(ERROR_CODES.REFRESH_TOKEN_INVALID, "缺少 refresh token", undefined, 401);
    }
    const tokenHash = await hashToken(presentedToken);
    const row = await this.repo.findRefreshByHash(tokenHash);
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw apiException(ERROR_CODES.REFRESH_TOKEN_INVALID, "refresh token 无效或已过期", undefined, 401);
    }

    // 轮换：撤销旧 token。
    await this.repo.revokeRefresh(row.id);

    const user = await this.repo.findUserById(row.userId);
    if (!user || !user.isActive) {
      throw apiException(ERROR_CODES.UNAUTHORIZED, "用户不可用", undefined, 401);
    }

    const authUser = await this.loadAuthUser(user);
    const accessToken = this.signAccess(authUser);
    const refreshToken = await this.issueRefresh(user.id, ctx);
    return { accessToken, refreshToken, authUser };
  }

  /** 退出：撤销该 refresh token，清 cookie 由控制器处理。 */
  async logout(presentedToken: string): Promise<void> {
    if (!presentedToken) return;
    const tokenHash = await hashToken(presentedToken);
    await this.repo.revokeRefreshByHash(tokenHash);
  }

  /** 取当前用户（/auth/me、JwtAuthGuard 复用）。 */
  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw apiException(ERROR_CODES.UNAUTHORIZED, "用户不存在", undefined, 401);
    }
    return this.loadAuthUser(user);
  }

  // ---- 内部 ----

  private signAccess(authUser: AuthUser): string {
    const payload: AccessPayload = {
      sub: authUser.id,
      username: authUser.username,
      roleKey: authUser.roleKey,
    };
    return this.jwt.sign(payload, { secret: env.jwtAccessSecret, expiresIn: env.jwtAccessTtl });
  }

  /** 验证 access token（JwtAuthGuard 复用）。失败抛 apiException。 */
  verifyAccess(token: string): AccessPayload {
    try {
      return this.jwt.verify<AccessPayload>(token, { secret: env.jwtAccessSecret });
    } catch {
      throw apiException(ERROR_CODES.TOKEN_INVALID, "access token 无效或已过期", undefined, 401);
    }
  }

  private async loadAuthUser(user: {
    id: string;
    username: string;
    roleId: string | null;
    displayName: string | null;
  }): Promise<AuthUser> {
    let roleKey = "viewer";
    const perms: string[] = [];
    if (user.roleId) {
      const role = await this.repo.findRoleById(user.roleId);
      if (role) roleKey = role.key;
    }
    if (roleKey === "super_admin") {
      // super_admin 运行时短路放行，权限列表给出通配提示。
      perms.push("*");
    } else if (user.roleId) {
      perms.push(...(await this.repo.findPermissionsByRole(user.roleId)));
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roleKey,
      permissions: perms,
    };
  }

  private async issueRefresh(userId: string, ctx: IssueContext): Promise<string> {
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = await hashToken(raw);
    const expiresAt = expiryFromTtl(env.jwtRefreshTtl);
    await this.repo.createRefresh({
      userId,
      tokenHash,
      expiresAt,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });
    return raw;
  }
}

/**
 * refresh token 哈希：用 SHA-256（确定性）。
 *
 * 注意：不能用 argon2——argon2 每次哈希带随机盐，无法通过「重新哈希再比对」查找，
 * 而 refresh token 需要按哈希查表（轮换/撤销）。refresh token 本身是高熵随机串，
 * SHA-256 足够；密码哈希才需要 argon2 的慢哈希（密码低熵）。
 */
async function hashToken(raw: string): Promise<string> {
  return createHash("sha256").update(raw).digest("hex");
}

/** 把 "7d"/"15m" 之类解析成未来时间点。 */
function expiryFromTtl(ttl: string): Date {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  const unitMs: Record<string, number> = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
  const ms = match ? Number(match[1]) * (unitMs[match[2]!] ?? 0) : 7 * 864e5;
  return new Date(Date.now() + ms);
}
