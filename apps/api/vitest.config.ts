import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // 测试环境提供一个占位 DATABASE_URL：postgres-js 在发起查询前不会真正连接，
    // 因此不触达 DB 的测试（如 health）可在无 Postgres 环境下运行。
    // 真正需要 DB 的 e2e 会在 beforeAll 探活并 ctx.skip()。
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
    },
  },
});
