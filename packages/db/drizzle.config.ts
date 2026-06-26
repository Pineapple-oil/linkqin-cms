import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit 配置。
 * 生成迁移：pnpm db:generate
 * 执行迁移：pnpm db:migrate
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin",
  },
  strict: true,
  verbose: true,
});
