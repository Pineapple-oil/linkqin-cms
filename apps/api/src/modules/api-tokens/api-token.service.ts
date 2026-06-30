import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { ERROR_CODES } from "@linkqin/shared";
import { apiException } from "../../common/errors.js";
import {
  TOKEN_REPO,
  type ApiTokenRepository,
  type ApiTokenRow,
} from "./api-token.repository.js";

/** 对外 token 列表项（不含 tokenHash）。 */
export interface ApiTokenView {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** 创建结果（含明文 token，仅此一次返回）。 */
export interface CreatedApiToken extends ApiTokenView {
  /** 明文 token，仅创建时返回一次。 */
  token: string;
}

/** 校验结果。 */
export interface ValidatedToken {
  id: string;
  name: string;
  scopes: string[];
}

/**
 * API token 业务逻辑（开发文档 §18 安全基线）。
 *
 * - create：生成 `lk_<48 字节随机>`，SHA-256 哈希存 DB，明文仅返回一次。
 * - validate：SHA-256 哈希查表 → 过期检查 → 更新 lastUsedAt。
 */
@Injectable()
export class ApiTokenService {
  constructor(@Inject(TOKEN_REPO) private readonly repo: ApiTokenRepository) {}

  async list(): Promise<ApiTokenView[]> {
    return (await this.repo.list()).map(toView);
  }

  async create(input: {
    name: string;
    scopes?: string[];
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<CreatedApiToken> {
    const raw = generateToken();
    const tokenHash = hashToken(raw);
    const row = await this.repo.create({
      name: input.name,
      tokenHash,
      tokenPrefix: raw.slice(0, 12),
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
    });
    return { ...toView(row), token: raw };
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /** 校验 token：哈希查表 + 过期检查。成功返回 token 信息并更新 lastUsedAt。 */
  async validate(rawToken: string): Promise<ValidatedToken> {
    const tokenHash = hashToken(rawToken);
    const row = await this.repo.findByHash(tokenHash);
    if (!row) {
      throw apiException(ERROR_CODES.TOKEN_INVALID, "API token 无效", undefined, 401);
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      throw apiException(ERROR_CODES.TOKEN_EXPIRED, "API token 已过期", undefined, 401);
    }
    await this.repo.touchLastUsed(row.id);
    return { id: row.id, name: row.name, scopes: row.scopes };
  }
}

/** 生成 `lk_<base64url>` 格式的 API token。 */
function generateToken(): string {
  return `lk_${randomBytes(32).toString("base64url")}`;
}

/** SHA-256 哈希（确定性，用于存储与查找）。 */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function toView(row: ApiTokenRow): ApiTokenView {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

export { hashToken };
