import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContentTypeService } from "./content-type.service.js";
import {
  type ContentTypeInsert,
  type ContentTypeRepository,
  type ContentTypeRow,
  type ContentTypeUpsert,
} from "./content-type.repository.js";
import type { ContentType, FieldDefinition } from "@linkqin/shared";

/** 构造字段定义，填齐默认值（required/localized/unique=false）。 */
function mkField(over: Partial<FieldDefinition> & Pick<FieldDefinition, "name" | "type" | "label">): FieldDefinition {
  return {
    required: false,
    localized: false,
    unique: false,
    ...over,
  };
}

/**
 * ContentTypeService 单测：聚焦业务规则（uid 唯一、字段校验、
 * schemaVersion 升级、删前 entries 检查），用内存假 repo 替代 DB。
 *
 * 注意：vitest 用 esbuild 转译，不生成 design:paramtypes，
 * 故手动 new ContentTypeService(repo) 绕过 Nest DI。
 */

function makeRow(over: Partial<ContentTypeRow> = {}): ContentTypeRow {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "ct-1",
    uid: "article",
    kind: "collection",
    displayName: "文章",
    description: null,
    fields: [],
    options: {},
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function makeFakeRepo() {
  const rows = new Map<string, ContentTypeRow>();
  const entryCounts = new Map<string, number>();
  let seq = 0;
  const obj = {
    rows,
    async list(): Promise<ContentTypeRow[]> {
      return [...rows.values()];
    },
    async findById(id: string) {
      return rows.get(id);
    },
    async findByUid(uid: string) {
      return [...rows.values()].find((r) => r.uid === uid);
    },
    async create(values: ContentTypeInsert): Promise<ContentTypeRow> {
      seq += 1;
      const row = makeRow({
        id: `ct-${seq}`,
        ...values,
        fields: values.fields ?? [],
        options: values.options ?? {},
        schemaVersion: values.schemaVersion ?? 1,
        description: values.description ?? null,
      });
      rows.set(row.id, row);
      return row;
    },
    async update(id: string, values: ContentTypeUpsert) {
      const cur = rows.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...values, updatedAt: new Date() };
      rows.set(id, next);
      return next;
    },
    async delete(id: string) {
      rows.delete(id);
    },
    async countEntries(contentTypeId: string): Promise<number> {
      return entryCounts.get(contentTypeId) ?? 0;
    },
    setEntryCount(id: string, n: number) {
      entryCounts.set(id, n);
    },
  };
  return obj as unknown as ContentTypeRepository & {
    rows: Map<string, ContentTypeRow>;
    setEntryCount(id: string, n: number): void;
  };
}

describe("ContentTypeService (unit)", () => {
  let repo: ReturnType<typeof makeFakeRepo>;
  let service: ContentTypeService;

  beforeEach(() => {
    repo = makeFakeRepo();
    service = new ContentTypeService(repo);
  });

  afterEach(() => {
    repo.rows.clear();
  });

  it("creates a collection content type", async () => {
    const ct = await service.create({
      uid: "article",
      kind: "collection",
      displayName: "文章",
      fields: [mkField({ name: "title", type: "text", label: "标题", required: true })],
    });
    expect(ct.uid).toBe("article");
    expect(ct.kind).toBe("collection");
    expect(ct.fields).toHaveLength(1);
    expect(ct.schemaVersion).toBe(1);
  });

  it("creates a single content type (homepage)", async () => {
    const ct = await service.create({
      uid: "homepage",
      kind: "single",
      displayName: "首页",
    });
    expect(ct.kind).toBe("single");
    expect(ct.fields).toEqual([]);
  });

  it("rejects duplicate uid with CONTENT_TYPE_UID_DUPLICATE (409)", async () => {
    await service.create({ uid: "article", kind: "collection", displayName: "文章" });
    await expect(
      service.create({ uid: "article", kind: "collection", displayName: "又一篇" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects invalid field name (non-camelCase) with CONTENT_TYPE_FIELD_INVALID (400)", async () => {
    await expect(
      service.create({
        uid: "article",
        kind: "collection",
        displayName: "文章",
        fields: [mkField({ name: "Title", type: "text", label: "标题" })],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects unknown field type with CONTENT_TYPE_FIELD_INVALID (400)", async () => {
    await expect(
      service.create({
        uid: "article",
        kind: "collection",
        displayName: "文章",
        fields: [mkField({ name: "x", type: "magic" as never, label: "魔法" })],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("bumps schemaVersion when fields structurally change on update", async () => {
    const created = await service.create({
      uid: "article",
      kind: "collection",
      displayName: "文章",
      fields: [mkField({ name: "title", type: "text", label: "标题" })],
    });
    const updated = await service.update(created.id!, {
      fields: [
        mkField({ name: "title", type: "text", label: "标题" }),
        mkField({ name: "body", type: "richText", label: "正文" }),
      ],
    });
    expect(updated.schemaVersion).toBe(2);
  });

  it("keeps schemaVersion when fields are unchanged on update", async () => {
    const fields: FieldDefinition[] = [mkField({ name: "title", type: "text", label: "标题" })];
    const created = await service.create({
      uid: "article",
      kind: "collection",
      displayName: "文章",
      fields,
    });
    const updated = await service.update(created.id!, {
      displayName: "文章（改）",
      fields,
    });
    expect(updated.schemaVersion).toBe(1);
    expect(updated.displayName).toBe("文章（改）");
  });

  it("rejects deleting a content type that has entries (409)", async () => {
    const created = await service.create({
      uid: "article",
      kind: "collection",
      displayName: "文章",
    });
    repo.setEntryCount(created.id!, 3);
    await expect(service.remove(created.id!)).rejects.toMatchObject({ status: 409 });
  });

  it("deletes a content type with no entries", async () => {
    const created = await service.create({
      uid: "article",
      kind: "collection",
      displayName: "文章",
    });
    await service.remove(created.id!);
    expect(repo.rows.has(created.id!)).toBe(false);
  });

  it("returns CONTENT_TYPE_NOT_FOUND (404) for missing id on get/update/delete", async () => {
    await expect(service.getById("nope")).rejects.toMatchObject({ status: 404 });
    await expect(service.update("nope", { displayName: "x" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.remove("nope")).rejects.toMatchObject({ status: 404 });
  });

  it("list returns all content types as ContentType", async () => {
    await service.create({ uid: "article", kind: "collection", displayName: "文章" });
    await service.create({ uid: "homepage", kind: "single", displayName: "首页" });
    const list: ContentType[] = await service.list();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.uid).sort()).toEqual(["article", "homepage"]);
  });
});
