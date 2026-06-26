import { describe, expect, it } from "vitest";
import type { ContentType } from "@linkqin/shared";
import { ContentValidator, FieldRegistry } from "../index.js";

function makeContentType(fields: ContentType["fields"]): ContentType {
  return {
    uid: "article",
    kind: "collection",
    displayName: "Article",
    fields,
    options: { draftAndPublish: true, versions: true, localized: false, sortable: false },
    schemaVersion: 1,
  };
}

describe("ContentValidator", () => {
  // 每个测试套件持有独立的注册表实例，避免模块级单例串状态。
  const validator = new ContentValidator(new FieldRegistry());

  it("validates entry data against content type fields", () => {
    const ct = makeContentType([
      { name: "title", type: "text", label: "标题", required: true },
      { name: "views", type: "number", label: "浏览量", required: false },
    ]);
    const result = validator.validate(ct, { title: "Hello", views: 10 });
    expect(result.success).toBe(true);
  });

  it("rejects missing required field", () => {
    const ct = makeContentType([
      { name: "title", type: "text", label: "标题", required: true },
    ]);
    const result = validator.validate(ct, {});
    expect(result.success).toBe(false);
    expect(result.errors?.title).toBeDefined();
  });

  it("rejects undeclared fields (strict)", () => {
    const ct = makeContentType([
      { name: "title", type: "text", label: "标题", required: true },
    ]);
    const result = validator.validate(ct, { title: "Hi", extra: "no" });
    expect(result.success).toBe(false);
  });

  it("rejects wrong field type", () => {
    const ct = makeContentType([
      { name: "views", type: "number", label: "浏览量", required: true },
    ]);
    const result = validator.validate(ct, { views: "not a number" });
    expect(result.success).toBe(false);
  });

  it("picks title snapshot from title field", () => {
    const ct = makeContentType([
      { name: "title", type: "text", label: "标题", required: true },
    ]);
    expect(validator.pickTitleField(ct, { title: "Hello" })).toBe("Hello");
  });
});
