import { describe, expect, it } from "vitest";
import { contentTypes, entries } from "./schema/index.js";
import { SEED_PERMISSIONS, SEED_ROLES } from "./seed.js";

describe("schema exports", () => {
  it("exports core tables", () => {
    expect(contentTypes).toBeDefined();
    expect(entries).toBeDefined();
  });
});

describe("seed constants", () => {
  it("defines the four base roles", () => {
    expect(SEED_ROLES.map((r) => r.key)).toEqual([
      "super_admin",
      "admin",
      "editor",
      "viewer",
    ]);
  });

  it("includes entry:publish permission", () => {
    expect(SEED_PERMISSIONS).toContain("entry:publish");
  });
});
