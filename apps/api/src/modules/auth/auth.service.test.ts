import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { AuthService } from "./auth.service.js";
import {
  type AuthRepository,
  type UserRow,
  type RefreshRow,
} from "./auth.repository.js";
import { ERROR_CODES } from "@linkqin/shared";

/**
 * AuthService 单测：聚焦纯逻辑（密码校验、JWT 签发/校验、refresh 轮换），
 * 用内存假 AuthRepository 替代 DB，保证无 Postgres 环境可跑。
 *
 * 注意：vitest 用 esbuild 转译，不生成 design:paramtypes 元数据，
 * 故构造函数注入会失效；这里手动 new AuthService(repo, jwt) 绕过 Nest DI。
 */

/** 内存假 repository。 */
function makeFakeRepo() {
  const users = new Map<string, UserRow>();
  const refreshes = new Map<string, RefreshRow>();
  const roleKeys = new Map<string, string>();
  const rolePerms = new Map<string, string[]>();
  const obj = {
    users,
    refreshes,
    async findUserByUsername(username: string) {
      return [...users.values()].find((u) => u.username === username);
    },
    async findUserById(id: string) {
      return users.get(id);
    },
    async touchLastLogin() {},
    async findRoleById(roleId: string) {
      const key = roleKeys.get(roleId);
      return key ? { key } : undefined;
    },
    async findPermissionsByRole(roleId: string) {
      return rolePerms.get(roleId) ?? [];
    },
    async createRefresh(input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ip?: string;
    }) {
      refreshes.set(input.tokenHash, {
        id: randomBytes(8).toString("hex"),
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
      });
    },
    async findRefreshByHash(tokenHash: string) {
      return refreshes.get(tokenHash);
    },
    async revokeRefresh(id: string) {
      for (const r of refreshes.values()) if (r.id === id) r.revokedAt = new Date();
    },
    async revokeRefreshByHash(tokenHash: string) {
      const r = refreshes.get(tokenHash);
      if (r) r.revokedAt = new Date();
    },
    setRoleKey(roleId: string, key: string) {
      roleKeys.set(roleId, key);
    },
    setRolePerms(roleId: string, perms: string[]) {
      rolePerms.set(roleId, perms);
    },
  };
  return obj as unknown as AuthRepository & typeof obj;
}

describe("AuthService (unit)", () => {
  let jwt: JwtService;
  let moduleRef: TestingModule;
  let service: AuthService;
  let repo: ReturnType<typeof makeFakeRepo>;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "unit-test-access-secret";
    process.env.JWT_REFRESH_TTL = "7d";
    process.env.JWT_ACCESS_TTL = "15m";
    repo = makeFakeRepo();
    moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: "unit-test-access-secret",
          signOptions: { expiresIn: "15m" },
        }),
      ],
    }).compile();
    jwt = moduleRef.get(JwtService);
    // 手动构造，绕过 esbuild 不生成装饰器元数据的限制。
    service = new AuthService(repo, jwt);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it("hashes and verifies a password with argon2", async () => {
    const password = "S3cret-pass!";
    const h = await hash(password);
    expect(await verify(h, password)).toBe(true);
    expect(await verify(h, "wrong")).toBe(false);
  });

  it("issues and verifies a JWT access token round-trip", () => {
    const payload = { sub: "u1", username: "admin", roleKey: "super_admin" };
    const token = jwt.sign(payload);
    const decoded = jwt.verify<{ sub: string; roleKey: string }>(token);
    expect(decoded.sub).toBe("u1");
    expect(decoded.roleKey).toBe("super_admin");
  });

  it("rejects a tampered JWT", () => {
    const token = jwt.sign({ sub: "u1", username: "admin", roleKey: "super_admin" });
    const tampered = token.slice(0, -2) + "xx";
    expect(() => jwt.verify(tampered)).toThrow();
  });

  it("generates a random refresh token (uniqueness sanity)", () => {
    const a = randomBytes(48).toString("base64url");
    const b = randomBytes(48).toString("base64url");
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(48);
  });

  it("rejects login for non-existent user", async () => {
    await expect(
      service.login({ username: "ghost", password: "x" }, {}),
    ).rejects.toThrow();
  });

  it("logs in a real user and issues tokens", async () => {
    const pw = "S3cret-pass!";
    repo.users.set("u1", {
      id: "u1",
      username: "admin",
      passwordHash: await hash(pw),
      roleId: "r-super",
      isActive: true,
      displayName: "Super Admin",
    });
    repo.setRoleKey("r-super", "super_admin");
    const result = await service.login({ username: "admin", password: pw }, {});
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.authUser.username).toBe("admin");
    expect(result.authUser.roleKey).toBe("super_admin");
    expect(result.authUser.permissions).toContain("*");
  });

  it("rotates refresh token on refresh (old becomes revoked)", async () => {
    const pw = "S3cret-pass!";
    repo.users.set("u1", {
      id: "u1",
      username: "admin",
      passwordHash: await hash(pw),
      roleId: "r-super",
      isActive: true,
      displayName: "Super Admin",
    });
    repo.setRoleKey("r-super", "super_admin");
    const login = await service.login({ username: "admin", password: pw }, {});
    const refreshed = await service.refresh(login.refreshToken, {});
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    await expect(service.refresh(login.refreshToken, {})).rejects.toThrow();
  });

  it("logout revokes the refresh token", async () => {
    const pw = "S3cret-pass!";
    repo.users.set("u1", {
      id: "u1",
      username: "admin",
      passwordHash: await hash(pw),
      roleId: "r-super",
      isActive: true,
      displayName: null,
    });
    repo.setRoleKey("r-super", "super_admin");
    const login = await service.login({ username: "admin", password: pw }, {});
    await service.logout(login.refreshToken);
    await expect(service.refresh(login.refreshToken, {})).rejects.toThrow();
  });

  it("exposes auth error codes for login failures", () => {
    expect(ERROR_CODES.INVALID_CREDENTIALS).toBe("INVALID_CREDENTIALS");
    expect(ERROR_CODES.REFRESH_TOKEN_INVALID).toBe("REFRESH_TOKEN_INVALID");
    expect(ERROR_CODES.TOKEN_INVALID).toBe("TOKEN_INVALID");
  });
});
