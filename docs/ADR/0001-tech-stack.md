# ADR-0001：技术栈选型

- 状态：Accepted
- 日期：2026-06-26
- 关联：`docs/PROJECT_DEVELOPMENT_GUIDE.md` 第 3、19 节

## 背景

linkqin-cms 需要在轻量、可控、AI agent 友好的前提下提供 Headless CMS 能力。

## 决策

- 后端：NestJS + Fastify Adapter + Drizzle ORM + PostgreSQL
- 后台：React + Vite + Ant Design Pro Components + TanStack Query
- 全栈 TypeScript strict，pnpm workspace monorepo
- 校验：Zod；API 文档：OpenAPI 3.1
- 内容存储：通用 entries 表 + JSONB（见开发文档 19.2）

## 理由

详见开发文档第 19 节：不直接二开 Strapi/Payload/Directus，而是借鉴其模式自研核心，换取轻量、可控、可扩展。

## 后果

- 优点：模块边界清晰，二开成本可控，类型贯穿前后端。
- 代价：需自行实现内容类型构建器、权限、插件宿主等基础设施。
