import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // 单元测试：src/ 下的 *.test.ts（不含 test/ 目录的 e2e）。
    // e2e 需要 Postgres，单独通过 test:e2e 脚本运行（pnpm test:e2e）。
    include: ["src/**/*.test.ts"],
    exclude: ["test/**/*.test.ts", "node_modules", "dist"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // 测试环境提供一个占位 DATABASE_URL：postgres-js 在发起查询前不会真正连接，
    // 因此不触达 DB 的测试（如 health）可在无 Postgres 环境下运行。
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
    },
  },
});
