import { describe, expect, it } from "vitest";
import { fieldDefinitionSchema, createContentTypeInputSchema } from "../index.js";

describe("fieldDefinitionSchema", () => {
  it("accepts a valid field definition", () => {
    const field = {
      name: "title",
      type: "text",
      label: "标题",
      required: true,
      settings: { maxLength: 120 },
    };
    expect(fieldDefinitionSchema.parse(field)).toMatchObject({ name: "title" });
  });

  it("rejects non-camelCase field name", () => {
    const result = fieldDefinitionSchema.safeParse({
      name: "Title",
      type: "text",
      label: "标题",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown field type", () => {
    const result = fieldDefinitionSchema.safeParse({
      name: "title",
      type: "magic",
      label: "标题",
    });
    expect(result.success).toBe(false);
  });
});

describe("createContentTypeInputSchema", () => {
  it("accepts a valid article collection", () => {
    const result = createContentTypeInputSchema.safeParse({
      uid: "article",
      kind: "collection",
      displayName: "文章",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid uid (uppercase)", () => {
    const result = createContentTypeInputSchema.safeParse({
      uid: "Article",
      kind: "collection",
      displayName: "文章",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid kind", () => {
    const result = createContentTypeInputSchema.safeParse({
      uid: "article",
      kind: "something",
      displayName: "文章",
    });
    expect(result.success).toBe(false);
  });
});
