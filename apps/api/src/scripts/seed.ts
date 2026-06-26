/**
 * 幂等 seed 脚本（开发文档 Phase 1）。
 *
 * 用法：pnpm --filter @linkqin/api seed
 *
 * 执行内容：
 * 1. upsert 4 个基础角色（SEED_ROLES）。
 * 2. upsert 全部权限点（SEED_PERMISSIONS）。
 * 3. 按角色矩阵授权 role_permissions（重建，保证可重入）。
 * 4. 从环境变量创建初始 super admin：
 *    - SEED_ADMIN_USERNAME（默认 admin）
 *    - SEED_ADMIN_PASSWORD（缺省生成强随机并打印）
 *
 * 幂等：可重复执行，不会重复创建已存在的用户/角色/权限。
 */
import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import {
  createDb,
  closeDb,
  roles,
  permissions,
  rolePermissions,
  users,
  SEED_ROLES,
  SEED_PERMISSIONS,
  type Database,
} from "@linkqin/db";
import { BASE_ROLES } from "@linkqin/shared";

/**
 * 角色 → 权限矩阵（开发文档 §9）。
 * - super_admin：全部权限（运行时也会短路放行）。
 * - admin：后台管理，不能改系统级配置（无 system:settings）。
 * - editor：内容 + 媒体读写、发布。
 * - viewer：只读。
 */
const ROLE_PERMISSION_MATRIX: Record<string, readonly string[]> = {
  [BASE_ROLES.SUPER_ADMIN]: [...SEED_PERMISSIONS],
  [BASE_ROLES.ADMIN]: SEED_PERMISSIONS.filter((p) => p !== "system:settings"),
  [BASE_ROLES.EDITOR]: [
    "content-type:read",
    "entry:read",
    "entry:create",
    "entry:update",
    "entry:delete",
    "entry:publish",
    "asset:read",
    "asset:upload",
    "plugin:read",
  ],
  [BASE_ROLES.VIEWER]: [
    "content-type:read",
    "entry:read",
    "asset:read",
    "plugin:read",
  ],
};

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }
  const db: Database = createDb(url);

  // 1. 角色
  for (const role of SEED_ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.key, role.key)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values({
        key: role.key,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
      });
      console.log(`✓ role created: ${role.key}`);
    } else {
      await db
        .update(roles)
        .set({ displayName: role.displayName, description: role.description })
        .where(eq(roles.key, role.key));
      console.log(`↻ role up-to-date: ${role.key}`);
    }
  }

  // 2. 权限
  for (const name of SEED_PERMISSIONS) {
    const label = name;
    const existing = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
    if (existing.length === 0) {
      await db.insert(permissions).values({ name, label });
    }
  }
  console.log(`✓ permissions ensured: ${SEED_PERMISSIONS.length}`);

  // 3. 角色-权限映射（先删后建，保证可重入且与矩阵一致）
  const allRoles = await db.select().from(roles);
  const allPerms = await db.select().from(permissions);
  const permByName = new Map(allPerms.map((p) => [p.name, p.id]));

  for (const role of allRoles) {
    const wanted = ROLE_PERMISSION_MATRIX[role.key] ?? [];
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    for (const permName of wanted) {
      const permId = permByName.get(permName);
      if (!permId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: permId })
        .onConflictDoNothing();
    }
    console.log(`↻ ${role.key}: ${wanted.length} permissions`);
  }

  // 4. super admin
  const adminRole = allRoles.find((r) => r.key === BASE_ROLES.SUPER_ADMIN);
  if (!adminRole) throw new Error("super_admin role not found after seeding");

  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "admin";
  const providedPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const password = providedPassword && providedPassword.length > 0
    ? providedPassword
    : generateStrongPassword();

  const existingAdmin = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      username,
      passwordHash: await hash(password),
      displayName: "Super Admin",
      roleId: adminRole.id,
      isActive: true,
    });
    console.log(`✓ super admin created: ${username}`);
    if (!providedPassword) {
      console.log("========================================================");
      console.log("  Generated SEED_ADMIN_PASSWORD (save it now, shown once):");
      console.log(`  ${password}`);
      console.log("========================================================");
    }
  } else {
    // 已存在：仅在提供 SEED_ADMIN_PASSWORD 时才重置密码（避免每次 seed 覆盖）。
    const row = existingAdmin[0]!;
    await db
      .update(users)
      .set({ roleId: adminRole.id, isActive: true })
      .where(eq(users.id, row.id));
    if (providedPassword && !(await verify(row.passwordHash, password))) {
      await db.update(users).set({ passwordHash: await hash(password) }).where(eq(users.id, row.id));
      console.log(`↻ super admin password reset: ${username}`);
    } else {
      console.log(`↻ super admin up-to-date: ${username}`);
    }
  }

  await closeDb(db);
  console.log("✓ seed complete");
}

/** 生成 32 字符 base64url 强随机密码。 */
function generateStrongPassword(): string {
  return randomBytes(24).toString("base64url").slice(0, 32);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
