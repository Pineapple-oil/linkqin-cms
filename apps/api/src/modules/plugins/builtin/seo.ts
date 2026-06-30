import { definePlugin } from "@linkqin/plugin-sdk";
import { z } from "zod";

/**
 * 官方 SEO 插件（开发文档 §15）。
 *
 * 演示插件三种扩展能力：
 * 1. 字段类型：注册 `seo` 组件字段（title/description/keywords）。
 * 2. 后台菜单：增加「SEO 设置」菜单项。
 * 3. 事件监听：监听 entry.published，记录 SEO 索引信号（MVP 仅日志）。
 *
 * 仅依赖 @linkqin/plugin-sdk（开发文档 AI 规则 7）。
 */
export const seoPlugin = definePlugin({
  name: "seo",
  version: "0.1.0",
  displayName: "SEO",
  description: "SEO 字段类型与发布索引信号",
  requires: { cms: ">=0.1.0" },
  configSchema: z.object({
    defaultTitle: z.string().optional(),
    defaultDescription: z.string().optional(),
  }),
  backend: async (ctx) => {
    // 监听发布事件（幂等：仅记日志，开发文档 §8.5）。
    ctx.events.on("entry.published", (payload) => {
      ctx.logger.info(`entry published, SEO index signal: ${payload.entryId}`);
    });
  },
  admin: async (ctx) => {
    // 注册 seo 组件字段类型。
    ctx.fields.register({
      name: "seo",
      label: "SEO",
      validator: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
      }),
    });
    // 增加后台菜单项。
    ctx.menu.add({
      key: "seo.settings",
      label: "SEO 设置",
      path: "/plugins/seo",
      permission: "plugin:read",
      order: 10,
    });
  },
});
