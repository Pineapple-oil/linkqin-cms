/**
 * 初始 seed 占位（Phase 1 实现 super_admin seed）。
 * 现在仅导出基础角色的常量定义，供后续 seed 脚本复用。
 */
export const SEED_ROLES = [
  {
    key: "super_admin",
    displayName: "超级管理员",
    description: "全部权限",
    isSystem: true,
  },
  {
    key: "admin",
    displayName: "管理员",
    description: "后台管理，不能改系统级配置",
    isSystem: true,
  },
  {
    key: "editor",
    displayName: "编辑",
    description: "内容编辑",
    isSystem: true,
  },
  {
    key: "viewer",
    displayName: "访客",
    description: "只读",
    isSystem: true,
  },
] as const;

/** Phase 1 将定义的权限点（开发文档 9）。 */
export const SEED_PERMISSIONS = [
  "content-type:read",
  "content-type:create",
  "content-type:update",
  "content-type:delete",
  "entry:read",
  "entry:create",
  "entry:update",
  "entry:delete",
  "entry:publish",
  "asset:read",
  "asset:upload",
  "asset:delete",
  "plugin:read",
  "plugin:manage",
  "system:settings",
] as const;
