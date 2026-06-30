import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiTokenService, hashToken } from "./api-token.service.js";
import { type ApiTokenRepository, type ApiTokenRow } from "./api-token.repository.js";

/**
 * ApiTokenService 单测：token 生成/哈希/校验。
 */
function makeRow(over: Partial<ApiTokenRow> = {}): ApiTokenRow {
  return {
    id: "t-1",
    name: "CI Token",
    tokenHash: "x",
    tokenPrefix: "lk_xxxxxxxx",
    scopes: ["content:read"],
    expiresAt: null,
    lastUsedAt: null,
    createdBy: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  };
}

function makeFakeRepo() {
  const rows = new Map<string, ApiTokenRow>();
  let seq = 0;
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async create(input: { name: string; tokenHash: string; tokenPrefix: string; expiresAt?: Date | null }) {
      seq += 1;
      const row = makeRow({
        id: `t-${seq}`,
        name: input.name,
        tokenHash: input.tokenHash,
        tokenPrefix: input.tokenPrefix,
        expiresAt: input.expiresAt ?? null,
      });
      rows.set(row.id, row);
      return row;
    },
    async delete(id: string) {
      rows.delete(id);
    },
    async findByHash(tokenHash: string) {
      return [...rows.values()].find((r) => r.tokenHash === tokenHash);
    },
    async touchLastUsed(id: string) {
      const r = rows.get(id);
      if (r) r.lastUsedAt = new Date();
    },
  } as unknown as ApiTokenRepository & { rows: Map<string, ApiTokenRow> };
}

describe("ApiTokenService (unit)", () => {
  let repo: ReturnType<typeof makeFakeRepo>;
  let service: ApiTokenService;

  beforeEach(() => {
    repo = makeFakeRepo();
    service = new ApiTokenService(repo);
  });

  afterEach(() => {
    repo.rows.clear();
  });

  it("creates a token with lk_ prefix and returns plaintext once", async () => {
    const result = await service.create({ name: "CI Token" });
    expect(result.token.startsWith("lk_")).toBe(true);
    expect(result.name).toBe("CI Token");
    expect(result.tokenPrefix.startsWith("lk_")).toBe(true);
  });

  it("validates a created token successfully", async () => {
    const created = await service.create({ name: "CI Token", scopes: ["content:read"] });
    const validated = await service.validate(created.token);
    expect(validated.name).toBe("CI Token");
    expect(validated.scopes).toContain("content:read");
  });

  it("rejects invalid token (not found)", async () => {
    await expect(service.validate("lk_nonexistent")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects expired token", async () => {
    const created = await service.create({
      name: "Expired",
      expiresAt: new Date("2020-01-01"),
    });
    await expect(service.validate(created.token)).rejects.toMatchObject({ status: 401 });
  });

  it("hashToken is deterministic", () => {
    expect(hashToken("lk_test123")).toBe(hashToken("lk_test123"));
    expect(hashToken("lk_a")).not.toBe(hashToken("lk_b"));
  });

  it("list excludes tokenHash from output", async () => {
    await service.create({ name: "T1" });
    const list = await service.list();
    expect(list).toHaveLength(1);
    expect((list[0] as unknown as { tokenHash?: string }).tokenHash).toBeUndefined();
  });

  it("delete removes token", async () => {
    const created = await service.create({ name: "T1" });
    await service.remove(created.id);
    expect(repo.rows.has(created.id)).toBe(false);
  });
});
