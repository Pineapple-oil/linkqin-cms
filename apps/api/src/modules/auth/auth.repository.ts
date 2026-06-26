import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import {
  type Database,
  users,
  roles,
  permissions,
  rolePermissions,
  refreshTokens,
} from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";

/**
 * 认证数据访问：把所有 Drizzle 查询收敛到这里，
 * AuthService 只依赖本接口，便于单测用内存假实现替换（开发文档测试策略）。
 *
 * AUTH_REPO 是注入 token（interface 无法直接被 Nest 解析）。
 */
export const AUTH_REPO = Symbol("AUTH_REPO");

export interface AuthRepository {
  findUserByUsername(username: string): Promise<UserRow | undefined>;
  findUserById(id: string): Promise<UserRow | undefined>;
  touchLastLogin(userId: string): Promise<void>;
  findRoleById(roleId: string): Promise<{ key: string } | undefined>;
  findPermissionsByRole(roleId: string): Promise<string[]>;
  createRefresh(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }): Promise<void>;
  findRefreshByHash(tokenHash: string): Promise<RefreshRow | undefined>;
  revokeRefresh(id: string): Promise<void>;
  revokeRefreshByHash(tokenHash: string): Promise<void>;
}

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  roleId: string | null;
  isActive: boolean;
  displayName: string | null;
}

export interface RefreshRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Drizzle 实现，生产用。 */
@Injectable()
export class DrizzleAuthRepository implements AuthRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findUserByUsername(username: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return row ? toUserRow(row) : undefined;
  }

  async findUserById(id: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUserRow(row) : undefined;
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async findRoleById(roleId: string): Promise<{ key: string } | undefined> {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    return row ? { key: row.key } : undefined;
  }

  async findPermissionsByRole(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.name);
  }

  async createRefresh(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }): Promise<void> {
    await this.db.insert(refreshTokens).values(input);
  }

  async findRefreshByHash(tokenHash: string): Promise<RefreshRow | undefined> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? toRefreshRow(row) : undefined;
  }

  async revokeRefresh(id: string): Promise<void> {
    await this.db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
  }

  async revokeRefreshByHash(tokenHash: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }
}

function toUserRow(row: {
  id: string;
  username: string;
  passwordHash: string;
  roleId: string | null;
  isActive: boolean;
  displayName: string | null;
}): UserRow {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    roleId: row.roleId,
    isActive: row.isActive,
    displayName: row.displayName,
  };
}

function toRefreshRow(row: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}): RefreshRow {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
