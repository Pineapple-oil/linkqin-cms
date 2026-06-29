import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetService } from "./asset.service.js";
import {
  type AssetRepository,
  type AssetRow,
} from "./asset.repository.js";
import type { StorageDriver } from "./storage.driver.js";

/**
 * AssetService 单测：聚焦上传校验（mime/大小）、图片尺寸读取、
 * update/delete 调用 storage.delete，用假 storage + 假 repo 替代真实依赖。
 *
 * 注意：vitest 用 esbuild 转译，不生成 design:paramtypes，
 * 故手动 new AssetService(...) 绕过 Nest DI。
 */

// 1x1 PNG（合法图片字节）。
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

function makeRow(over: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "a-1",
    storage: "local",
    bucket: null,
    path: "2026/01/x.png",
    filename: "x.png",
    mimeType: "image/png",
    size: 100,
    width: 1,
    height: 1,
    alt: null,
    caption: null,
    metadata: null,
    folderId: null,
    createdBy: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  };
}

function makeFakeRepo() {
  const rows = new Map<string, AssetRow>();
  return {
    rows,
    async list() {
      return { items: [...rows.values()], total: rows.size };
    },
    async findById(id: string) {
      return rows.get(id);
    },
    async create(input: { path: string; filename: string; mimeType: string; size: number }) {
      const row = makeRow({ id: `a-${rows.size + 1}`, ...input });
      rows.set(row.id, row);
      return row;
    },
    async update(id: string, patch: { alt?: string | null; caption?: string | null }) {
      const cur = rows.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...patch };
      rows.set(id, next);
      return next;
    },
    async delete(id: string) {
      rows.delete(id);
    },
  } as unknown as AssetRepository & { rows: Map<string, AssetRow> };
}

function makeFakeStorage(): StorageDriver & { saved: string[]; deleted: string[] } {
  const obj = {
    saved: [] as string[],
    deleted: [] as string[],
    async save(_buf: Buffer, filename: string) {
      const path = `2026/01/${filename}`;
      obj.saved.push(path);
      return { path, absPath: `/storage/${path}` };
    },
    async read(_p: string) {
      return Buffer.alloc(0);
    },
    async delete(path: string) {
      obj.deleted.push(path);
    },
    publicUrl(path: string) {
      return `http://localhost:3000/uploads/${path}`;
    },
  };
  return obj as unknown as StorageDriver & { saved: string[]; deleted: string[] };
}

const fakeAudit = { log: vi.fn().mockResolvedValue(undefined) } as never;

describe("AssetService (unit)", () => {
  let repo: ReturnType<typeof makeFakeRepo>;
  let storage: ReturnType<typeof makeFakeStorage>;
  let service: AssetService;

  beforeEach(() => {
    repo = makeFakeRepo();
    storage = makeFakeStorage();
    service = new AssetService(repo, storage, fakeAudit);
  });

  afterEach(() => {
    repo.rows.clear();
  });

  it("uploads an image, reads dimensions, returns url", async () => {
    const asset = await service.upload(
      { filename: "pic.png", mimeType: "image/png", buffer: PNG_1x1 },
      "u1",
    );
    expect(asset.mimeType).toBe("image/png");
    expect(asset.width).toBe(1);
    expect(asset.height).toBe(1);
    expect(asset.url).toContain("/uploads/");
    expect(storage.saved).toHaveLength(1);
  });

  it("rejects unsupported mime type", async () => {
    await expect(
      service.upload(
        { filename: "evil.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("x") },
        "u1",
      ),
    ).rejects.toThrow();
  });

  it("rejects oversize file", async () => {
    const big = Buffer.alloc(11 * 1024 * 1024);
    await expect(
      service.upload(
        { filename: "big.png", mimeType: "image/png", buffer: big },
        "u1",
      ),
    ).rejects.toThrow();
  });

  it("non-image upload does not read dimensions", async () => {
    const asset = await service.upload(
      { filename: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      "u1",
    );
    expect(asset.width).toBeNull();
    expect(asset.height).toBeNull();
  });

  it("updates alt/caption", async () => {
    const created = await service.upload(
      { filename: "pic.png", mimeType: "image/png", buffer: PNG_1x1 },
      "u1",
    );
    const updated = await service.update(created.id!, { alt: "封面图" }, "u1");
    expect(updated.alt).toBe("封面图");
  });

  it("delete removes file then row", async () => {
    const created = await service.upload(
      { filename: "pic.png", mimeType: "image/png", buffer: PNG_1x1 },
      "u1",
    );
    await service.remove(created.id!, "u1");
    expect(storage.deleted).toContain("2026/01/pic.png");
    expect(repo.rows.has(created.id!)).toBe(false);
  });

  it("returns 404 for missing asset on get/update/delete", async () => {
    await expect(service.getById("nope")).rejects.toMatchObject({ status: 404 });
    await expect(service.update("nope", { alt: "x" }, "u1")).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.remove("nope", "u1")).rejects.toMatchObject({ status: 404 });
  });
});
