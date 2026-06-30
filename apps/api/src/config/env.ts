/**
 * 环境变量集中校验与读取。
 * 启动时缺失关键变量直接抛错，避免运行时静默失败。
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "3000")),
  appUrl: optional("APP_URL", "http://localhost:3000"),
  adminUrl: optional("ADMIN_URL", "http://localhost:5173"),
  databaseUrl: optional("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  /** Access token 有效期（开发文档 3.2）。 */
  jwtAccessTtl: optional("JWT_ACCESS_TTL", "15m") ?? "15m",
  /** Refresh token 有效期。 */
  jwtRefreshTtl: optional("JWT_REFRESH_TTL", "7d") ?? "7d",
  storageDriver: optional("STORAGE_DRIVER", "local"),
  storageLocalDir: optional("STORAGE_LOCAL_DIR", "./storage"),
  defaultLocale: optional("DEFAULT_LOCALE", "zh-CN"),
  redisUrl: optional("REDIS_URL"),
  /** seed 初始 super admin。 */
  seedAdminUsername: optional("SEED_ADMIN_USERNAME", "admin"),
  seedAdminPassword: optional("SEED_ADMIN_PASSWORD"),
  /** 草稿预览 token 密钥（开发文档 §10）。 */
  previewTokenSecret: required("PREVIEW_TOKEN_SECRET", "dev-preview-secret"),
} as const;

export type Env = typeof env;
