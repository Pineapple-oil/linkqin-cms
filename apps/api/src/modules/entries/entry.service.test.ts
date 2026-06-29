import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FieldRegistry } from "@linkqin/core";
import type { ContentType } from "@linkqin/shared";
import { EntryService } from "./entry.service.js";
import {
  type EntryRepository,
  type EntryRow,
  type EntryVersionRow,
} from "./entry.repository.js";

/**
 * EntryService 单测：聚焦业务规则（contentType 校验、内容校验、
 * titleSnapshot、version 递增、publish 快照、草稿/发布隔离、事件 emit），
 * 用内存假 repo + 假依赖替代真实 DB/Nest DI。
 *
 * 注意：vitest 用 esbuild 转译，不生成 design:paramtypes，
 * 故手动 new EntryService(...) 绕过 Nest DI。
 */

const contentType: ContentType = {
  id: "ct-1",
  uid: "article",
  kind: "collection",
  displayName: "文章",
  description: undefined,
  fields: [
    { name: "title", type: "text", label: "标题", required: true, localized: false, unique: false },
    { name: "views", type: "number", label: "浏览量", required: false, localized: false, unique: false },
  ],
  options: { draftAndPublish: true, versions: true, localized: false, sortable: false },
  schemaVersion: 1,
};

function makeEntryRow(over: Partial<EntryRow> = {}): EntryRow {
  return {
    id: "e-1",
    contentTypeId: "ct-1",
    status: "draft",
    locale: "zh-CN",
    slug: null,
    titleSnapshot: null,
    data: { title: "hello" },
    publishedData: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    publishedBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    publishedAt: null,
    ...over,
  };
}

function makeFakeRepo() {
  const entries = new Map<string, EntryRow>();
  const versions = new Map<string, EntryVersionRow[]>();
  let seq = 0;
  return {
    entries,
    versions,
    async list() {
      return { items: [...entries.values()], total: entries.size };
    },
    async findById(id: string) {
      return entries.get(id);
    },
    async findPublishedBySlug(_ct: string, slug: string) {
      return [...entries.values()].find((e) => e.slug === slug && e.status === "published");
    },
    async create(input: {
      contentTypeId: string;
      data: Record<string, unknown>;
      slug?: string | null;
      titleSnapshot?: string | null;
      createdBy?: string | null;
      version?: number;
    }) {
      seq += 1;
      const row = makeEntryRow({
        id: `e-${seq}`,
        contentTypeId: input.contentTypeId,
        slug: input.slug ?? null,
        titleSnapshot: input.titleSnapshot ?? null,
        data: input.data,
        createdBy: input.createdBy ?? null,
        version: input.version ?? 1,
      });
      entries.set(row.id, row);
      return row;
    },
    async update(id: string, patch: Partial<EntryRow>) {
      const cur = entries.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...patch };
      entries.set(id, next);
      return next;
    },
    async applyStatusPatch(id: string, patch: Partial<EntryRow>) {
      const cur = entries.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...patch };
      entries.set(id, next);
      return next;
    },
    async delete(id: string) {
      entries.delete(id);
    },
    async createVersion(input: { entryId: string; version: number; data: Record<string, unknown> }) {
      const arr = versions.get(input.entryId) ?? [];
      arr.push({
        id: `v-${input.entryId}-${input.version}`,
        entryId: input.entryId,
        version: input.version,
        data: input.data,
        editedBy: null,
        note: null,
        createdAt: new Date(),
      });
      versions.set(input.entryId, arr);
    },
    async listVersions(entryId: string) {
      return versions.get(entryId) ?? [];
    },
  } as unknown as EntryRepository & {
    entries: Map<string, EntryRow>;
    versions: Map<string, EntryVersionRow[]>;
  };
}

/** 假 ContentTypeService：只实现 getById，返回固定 contentType。 */
function makeFakeContentTypes() {
  return {
    getById: async (id: string): Promise<ContentType> => {
      if (id === "ct-1") return contentType;
      throw new Error("not found");
    },
  } as unknown as ConstructorParameters<typeof EntryService>[1];
}

/** 假 AuditService：log 是 no-op。 */
const fakeAudit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as ConstructorParameters<typeof EntryService>[2];

/** 假 EventBus：记录 emit 调用。 */
function makeFakeEvents() {
  const emitted: { event: string; payload: unknown }[] = [];
  return {
    emitted,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(async (event: string, payload: unknown) => {
      emitted.push({ event, payload });
    }),
  } as unknown as ConstructorParameters<typeof EntryService>[3] & {
    emitted: { event: string; payload: unknown }[];
  };
}

/** 假 PluginHostService：暴露共享字段注册表（含内置字段）。 */
function makeFakePluginHost() {
  return { host: { fields: new FieldRegistry() } } as unknown as ConstructorParameters<typeof EntryService>[4];
}

describe("EntryService (unit)", () => {
  let repo: ReturnType<typeof makeFakeRepo>;
  let events: ReturnType<typeof makeFakeEvents>;
  let service: EntryService;

  beforeEach(() => {
    repo = makeFakeRepo();
    events = makeFakeEvents();
    service = new EntryService(repo, makeFakeContentTypes(), fakeAudit, events, makeFakePluginHost());
  });

  afterEach(() => {
    repo.entries.clear();
    repo.versions.clear();
  });

  it("creates a draft entry, picks titleSnapshot, writes version 1, emits created", async () => {
    const entry = await service.create(
      { contentTypeId: "ct-1", data: { title: "My Article", views: 10 } },
      "u1",
    );
    expect(entry.status).toBe("draft");
    expect(entry.titleSnapshot).toBe("My Article");
    expect(entry.version).toBe(1);
    expect(repo.versions.get(entry.id)).toHaveLength(1);
    expect(events.emitted.some((e) => e.event === "entry.created")).toBe(true);
  });

  it("rejects when content type does not exist (404)", async () => {
    await expect(
      service.create({ contentTypeId: "missing", data: {} }, "u1"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects invalid content data (missing required field) with 400", async () => {
    await expect(
      service.create({ contentTypeId: "ct-1", data: { views: 10 } }, "u1"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("update bumps version and writes a new version row", async () => {
    const created = await service.create(
      { contentTypeId: "ct-1", data: { title: "T" } },
      "u1",
    );
    const updated = await service.update(
      created.id!,
      { data: { title: "T2" } },
      "u2",
    );
    expect(updated.version).toBe(2);
    expect(updated.data.title).toBe("T2");
    expect(repo.versions.get(created.id!)).toHaveLength(2);
    expect(events.emitted.some((e) => e.event === "entry.updated")).toBe(true);
  });

  it("publish copies draft data to publishedData and emits entry.published", async () => {
    const created = await service.create(
      { contentTypeId: "ct-1", data: { title: "Pub" } },
      "u1",
    );
    const published = await service.publishAction(created.id!, "publish", "u1");
    expect(published.status).toBe("published");
    expect(published.publishedData).toEqual({ title: "Pub" });
    expect(published.publishedBy).toBe("u1");
    expect(events.emitted.some((e) => e.event === "entry.published")).toBe(true);
  });

  it("editing draft data does not affect publishedData until re-publish (acceptance #3)", async () => {
    const created = await service.create(
      { contentTypeId: "ct-1", data: { title: "V1" } },
      "u1",
    );
    await service.publishAction(created.id!, "publish", "u1");
    // 编辑草稿。
    await service.update(created.id!, { data: { title: "V2" } }, "u1");
    const afterEdit = await service.getById(created.id!);
    // 草稿 data 已更新，但 publishedData 仍是 V1。
    expect(afterEdit.data.title).toBe("V2");
    expect(afterEdit.publishedData?.title).toBe("V1");
    // 重新发布后 publishedData 才更新。
    const republished = await service.publishAction(created.id!, "publish", "u1");
    expect(republished.publishedData?.title).toBe("V2");
  });

  it("unpublish clears publishedData", async () => {
    const created = await service.create(
      { contentTypeId: "ct-1", data: { title: "X" } },
      "u1",
    );
    await service.publishAction(created.id!, "publish", "u1");
    const unpublished = await service.publishAction(created.id!, "unpublish", "u1");
    expect(unpublished.status).toBe("draft");
    expect(unpublished.publishedData).toBeNull();
    expect(unpublished.publishedAt).toBeNull();
    expect(events.emitted.some((e) => e.event === "entry.unpublished")).toBe(true);
  });

  it("archive preserves publishedData for later restore", async () => {
    const created = await service.create(
      { contentTypeId: "ct-1", data: { title: "X" } },
      "u1",
    );
    await service.publishAction(created.id!, "publish", "u1");
    const archived = await service.publishAction(created.id!, "archive", "u1");
    expect(archived.status).toBe("archived");
    expect(archived.publishedData).not.toBeNull();
  });

  it("returns 404 for missing entry on get/update/delete", async () => {
    await expect(service.getById("nope")).rejects.toMatchObject({ status: 404 });
    await expect(service.update("nope", { data: {} }, "u1")).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.remove("nope")).rejects.toMatchObject({ status: 404 });
  });
});
