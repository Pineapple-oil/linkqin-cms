import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { AuditService, type AuditEntry } from "./audit.service.js";
import type { auditLogs } from "@linkqin/db";

/**
 * AuditService 单测：验证写入内容正确，且失败降级不抛（开发文档 AI 规则 11）。
 *
 * 注意：vitest 用 esbuild 转译，不生成 design:paramtypes，
 * 故手动 new AuditService(db) 绕过 Nest DI。
 */

type InsertedRow = typeof auditLogs.$inferInsert;

/** 内存假 DB，只捕获 insert(auditLogs).values(...)。 */
function makeFakeDb() {
  const inserted: InsertedRow[] = [];
  const db = {
    inserted,
    insert: (_table: unknown) => ({
      values: (row: InsertedRow) => {
        inserted.push(row);
        return Promise.resolve();
      },
    }),
  };
  // 制造一个会失败的 DB，用于验证降级。
  const failingDb = {
    insert: (_table: unknown) => ({
      values: () => Promise.reject(new Error("db down")),
    }),
  };
  return { db, failingDb };
}

describe("AuditService", () => {
  it("writes an audit row with mapped fields", async () => {
    const { db } = makeFakeDb();
    const service = new AuditService(db as never);
    const entry: AuditEntry = {
      userId: "u1",
      action: "content-type.create",
      resource: "content_type",
      resourceId: "ct-1",
      summary: { uid: "article" },
      ip: "127.0.0.1",
      userAgent: "test-agent",
    };
    await service.log(entry);
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toMatchObject({
      userId: "u1",
      action: "content-type.create",
      resource: "content_type",
      resourceId: "ct-1",
      ip: "127.0.0.1",
      userAgent: "test-agent",
      summary: { uid: "article" },
    });
  });

  it("defaults resourceId/ip/userAgent to null when omitted", async () => {
    const { db } = makeFakeDb();
    const service = new AuditService(db as never);
    await service.log({ userId: null, action: "auth.logout", resource: "user" });
    expect(db.inserted[0]).toMatchObject({
      userId: null,
      resourceId: null,
      ip: null,
      userAgent: null,
    });
  });

  it("does not throw when DB insert fails (best-effort)", async () => {
    const { failingDb } = makeFakeDb();
    const service = new AuditService(failingDb as never);
    // 失败应被吞掉，不向上抛。
    await expect(
      service.log({ userId: "u1", action: "x", resource: "y" }),
    ).resolves.toBeUndefined();
  });
});
