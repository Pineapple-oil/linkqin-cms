import { SetMetadata } from "@nestjs/common";

/** 元数据 key：路由所需权限点。 */
export const PERMISSIONS_KEY = "required_permissions";

/**
 * 声明路由所需的权限点（开发文档 §9 / AI 规则 10）。
 *
 * 用法：
 *   @RequirePermissions('plugin:manage')
 *   @RequirePermissions('entry:publish', 'entry:update')  // 满足任一即可
 *
 * super_admin 角色短路放行，无需匹配权限点。
 * 由 PermissionsGuard 读取并校验。
 */
export const RequirePermissions = (...permissions: string[]): MethodDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
