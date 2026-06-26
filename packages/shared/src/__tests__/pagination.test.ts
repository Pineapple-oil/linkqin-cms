import { describe, expect, it } from "vitest";
import { buildPaginationMeta, paginationQuerySchema } from "../index.js";

describe("paginationQuerySchema", () => {
  it("applies defaults for missing page/pageSize", () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("coerces string inputs", () => {
    const parsed = paginationQuerySchema.parse({ page: "2", pageSize: "5" });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(5);
  });

  it("rejects pageSize over max", () => {
    const result = paginationQuerySchema.safeParse({ pageSize: 999 });
    expect(result.success).toBe(false);
  });
});

describe("buildPaginationMeta", () => {
  it("computes page count", () => {
    expect(buildPaginationMeta(100, 1, 20)).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 100,
      pageCount: 5,
    });
  });

  it("handles zero total", () => {
    expect(buildPaginationMeta(0, 1, 20).pageCount).toBe(0);
  });
});
