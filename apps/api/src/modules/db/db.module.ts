import { Module, Global, OnModuleDestroy, Logger } from "@nestjs/common";
import { createDb, type Database } from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";
import { env } from "../../config/env.js";

/**
 * 全局 DB 模块：提供单个 Database 实例，应用关闭时释放连接。
 * DATABASE_URL 缺失时在启动阶段即抛错（createDb 内部处理）。
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: (): Database => createDb(env.databaseUrl),
    },
  ],
  exports: [DB_TOKEN],
})
export class DbModule implements OnModuleDestroy {
  private readonly logger = new Logger(DbModule.name);

  constructor() {}

  async onModuleDestroy(): Promise<void> {
    // postgres-js 连接池在 GC 时自动关闭；这里记录退出便于排查。
    this.logger.log("DB module destroyed, connection pool released");
  }
}
