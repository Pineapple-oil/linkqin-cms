import { definePlugin } from "@linkqin/plugin-sdk";
import { z } from "zod";

/**
 * 官方 local-storage 插件（开发文档 §15）。
 *
 * 演示插件扩展：
 * 1. 存储驱动：声明本地存储能力（MVP 仅注册元信息；实际 LocalStorageDriver
 *    已是核心默认，这里演示插件如何「声明」存储驱动）。
 * 2. 后台菜单：增加「存储设置」菜单项。
 * 3. 权限声明：声明 asset:upload 等已有权限点（演示权限声明能力）。
 *
 * 仅依赖 @linkqin/plugin-sdk（开发文档 AI 规则 7）。
 */
export const localStoragePlugin = definePlugin({
  name: "local-storage",
  version: "0.1.0",
  displayName: "本地存储",
  description: "本地文件存储驱动",
  requires: { cms: ">=0.1.0" },
  configSchema: z.object({
    rootDir: z.string().optional(),
  }),
  backend: async (ctx) => {
    // 声明存储驱动存在（MVP 元信息；Phase 6 接 S3 时复用此模式）。
    ctx.logger.info("local-storage driver available");
    // 声明权限点。
    ctx.permissions.declare({
      name: "asset:upload",
      label: "上传媒体",
      description: "上传文件到媒体库",
    });
  },
  admin: async (ctx) => {
    ctx.menu.add({
      key: "local-storage.settings",
      label: "存储设置",
      path: "/plugins/local-storage",
      permission: "plugin:read",
      order: 11,
    });
  },
});
