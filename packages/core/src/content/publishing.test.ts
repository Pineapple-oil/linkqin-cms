import { describe, expect, it } from "vitest";
import type { Entry } from "@linkqin/shared";
import { applyPublish, canTransition, nextStatus } from "../index.js";

function makeEntry(status: Entry["status"]): Entry {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "e1",
    contentTypeId: "ct1",
    status,
    locale: "zh-CN",
    data: { title: "draft content" },
    publishedData: null,
    version: 1,
    createdBy: "u1",
    updatedBy: "u1",
    publishedBy: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
}

describe("publishing state machine", () => {
  it("allows draft -> published", () => {
    expect(canTransition("draft", "publish")).toBe(true);
    expect(nextStatus("draft", "publish")).toBe("published");
  });

  it("disallows archived -> unpublish", () => {
    expect(canTransition("archived", "unpublish")).toBe(false);
  });

  it("allows published -> publish (re-publish after editing)", () => {
    expect(canTransition("published", "publish")).toBe(true);
    expect(nextStatus("published", "publish")).toBe("published");
  });

  it("re-publish snapshots new data over publishedData", () => {
    // 已发布，草稿 data 已被编辑为新内容，旧快照仍是旧内容。
    const entry = {
      ...makeEntry("published"),
      data: { title: "new edited" },
      publishedData: { title: "old published" },
      publishedBy: "u-old",
    };
    const result = applyPublish(entry, "publish", {
      actorId: "u-new",
      at: new Date("2026-03-01T00:00:00Z"),
    });
    expect(result.status).toBe("published");
    // 新 data 被快照到 publishedData。
    expect(result.publishedData).toEqual({ title: "new edited" });
    expect(result.publishedBy).toBe("u-new");
    expect(result.version).toBe(2);
  });

  it("publish copies data to publishedData", () => {
    const entry = makeEntry("draft");
    const result = applyPublish(entry, "publish", {
      actorId: "u2",
      at: new Date("2026-02-01T00:00:00Z"),
    });
    expect(result.status).toBe("published");
    expect(result.publishedData).toEqual({ title: "draft content" });
    expect(result.publishedBy).toBe("u2");
    expect(result.version).toBe(2);
  });

  it("unpublish clears publishedData", () => {
    const entry = { ...makeEntry("published"), publishedData: { title: "x" } };
    const result = applyPublish(entry, "unpublish", {
      actorId: "u2",
      at: new Date("2026-02-01T00:00:00Z"),
    });
    expect(result.status).toBe("draft");
    expect(result.publishedData).toBeNull();
    expect(result.publishedAt).toBeNull();
  });

  it("throws on invalid transition", () => {
    const entry = makeEntry("archived");
    expect(() =>
      applyPublish(entry, "unpublish", { actorId: "u2", at: new Date() }),
    ).toThrow();
  });
});
