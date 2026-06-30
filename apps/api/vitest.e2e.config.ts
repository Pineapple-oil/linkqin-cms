import { defineConfig } from "vitest/config";

/**
 * e2e 测试配置：需要 Postgres。
 * 运行：pnpm --filter @linkqin/api test:e2e
 * 无 DB 时所有套件 skip（describe.skipIf），但需要 DB 连接尝试。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://linkqin:linkqin@localhost:5432/linkqin",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
      PREVIEW_TOKEN_SECRET: "test-preview-secret",
    },
  },
});
