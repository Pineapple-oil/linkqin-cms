import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit 配置。
 * 生成迁移：pnpm db:generate
 * 执行迁移：pnpm db:migrate
 *
 * schema 指向编译后的 dist（本仓库源码 import 统一带 .js 扩展名，
 * drizzle-kit 的 CJS 加载器无法解析 .ts 源里的 .js 后缀）。
 * 因此生成迁移前需先 `pnpm --filter @linkqin/db build`。
 */
export default defineConfig({
  schema: "./dist/schema/index.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin",
  },
  strict: true,
  verbose: true,
});
