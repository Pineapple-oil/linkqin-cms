import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { PermissionsGuard } from "./permissions.guard.js";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator.js";
import type { AuthUser } from "@linkqin/shared";

/** 构造一个 mock ExecutionContext，给定路由元数据与 request.user。 */
function makeCtx(opts: {
  permissions?: string[];
  user?: AuthUser | undefined;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: opts.user }),
    }),
  } as unknown as ExecutionContext;
}

/** 带元数据的 Reflector，模拟 @RequirePermissions(...) 写入的值。 */
function reflectorWith(perms: string[] | undefined): Reflector {
  const r = new Reflector();
  const orig = r.getAllAndOverride.bind(r);
  r.getAllAndOverride = <T>(key: string, targets: Parameters<typeof orig>[1]): T =>
    key === PERMISSIONS_KEY ? (perms as T) : orig<T>(key, targets);
  return r;
}

const superAdmin: AuthUser = {
  id: "u1",
  username: "admin",
  displayName: null,
  roleKey: "super_admin",
  permissions: ["*"],
};
const editor: AuthUser = {
  id: "u2",
  username: "editor",
  displayName: null,
  roleKey: "editor",
  permissions: ["entry:read", "entry:update", "entry:publish"],
};

describe("PermissionsGuard", () => {
  it("super_admin short-circuits (always allowed)", () => {
    const guard = new PermissionsGuard(reflectorWith(["system:settings"]));
    expect(guard.canActivate(makeCtx({ user: superAdmin }))).toBe(true);
  });

  it("allows when user has a required permission", () => {
    const guard = new PermissionsGuard(reflectorWith(["system:settings", "entry:publish"]));
    expect(guard.canActivate(makeCtx({ user: editor }))).toBe(true);
  });

  it("denies with 403 when permission missing", () => {
    const guard = new PermissionsGuard(reflectorWith(["system:settings"]));
    expect(() => guard.canActivate(makeCtx({ user: editor }))).toThrow();
  });

  it("allows any logged-in user when no permissions required", () => {
    const guard = new PermissionsGuard(reflectorWith(undefined));
    expect(guard.canActivate(makeCtx({ user: editor }))).toBe(true);
  });

  it("denies with 401 when no user (guard order/missing auth)", () => {
    const guard = new PermissionsGuard(reflectorWith(["entry:read"]));
    expect(() => guard.canActivate(makeCtx({ user: undefined }))).toThrow();
  });
});
