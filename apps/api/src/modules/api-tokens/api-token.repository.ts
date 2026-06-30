import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { type Database, apiTokens } from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";

/** API token 数据访问。 */
export const TOKEN_REPO = Symbol("TOKEN_REPO");

export interface ApiTokenRow {
  id: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiTokenRepository {
  list(): Promise<ApiTokenRow[]>;
  create(input: {
    name: string;
    tokenHash: string;
    tokenPrefix: string;
    scopes?: string[];
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<ApiTokenRow>;
  delete(id: string): Promise<void>;
  /** 按哈希查找（用于校验）。 */
  findByHash(tokenHash: string): Promise<ApiTokenRow | undefined>;
  /** 更新最后使用时间。 */
  touchLastUsed(id: string): Promise<void>;
}

@Injectable()
export class DrizzleApiTokenRepository implements ApiTokenRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async list(): Promise<ApiTokenRow[]> {
    const rows = await this.db.select().from(apiTokens);
    return rows.map(toRow);
  }

  async create(input: {
    name: string;
    tokenHash: string;
    tokenPrefix: string;
    scopes?: string[];
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<ApiTokenRow> {
    const [row] = await this.db.insert(apiTokens).values(input).returning();
    return toRow(row!);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(apiTokens).where(eq(apiTokens.id, id));
  }

  async findByHash(tokenHash: string): Promise<ApiTokenRow | undefined> {
    const [row] = await this.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? toRow(row) : undefined;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
  }
}

function toRow(row: {
  id: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ApiTokenRow {
  return {
    id: row.id,
    name: row.name,
    tokenHash: row.tokenHash,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes ?? [],
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
