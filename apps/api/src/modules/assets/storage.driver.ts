import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { env } from "../../config/env.js";

/**
 * 存储驱动抽象（开发文档 6.4 / 17）。
 * 第一阶段只实现 Local；S3/MinIO/OSS/COS 留 Phase 5 插件。
 *
 * path 语义：存储内的相对路径（如 `2026/01/abc.jpg`），
 * publicUrl 由驱动派生为完整可访问 URL。
 */
export const STORAGE_DRIVER = Symbol("STORAGE_DRIVER");

export interface SaveResult {
  /** 存储内相对路径，写入 assets.path。 */
  path: string;
  /** 实际落盘的绝对路径。 */
  absPath: string;
}

export interface StorageDriver {
  /** 保存文件，返回相对路径 + 绝对路径。 */
  save(buffer: Buffer, filename: string, mimeType: string): Promise<SaveResult>;
  /** 读取文件为 Buffer。 */
  read(path: string): Promise<Buffer>;
  /** 删除文件。 */
  delete(path: string): Promise<void>;
  /** 派生公开访问 URL。 */
  publicUrl(path: string): string;
}

/** 本地存储实现。 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly root = resolve(env.storageLocalDir ?? "./storage");

  async save(buffer: Buffer, filename: string, _mimeType: string): Promise<SaveResult> {
    // 按年月分目录，避免单目录文件过多；文件名加随机前缀防冲突与覆盖。
    const now = new Date();
    const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const safeName = sanitizeFilename(filename);
    const relPath = `${month}/${randomUUID().slice(0, 8)}-${safeName}`;
    const absPath = join(this.root, relPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, buffer);
    return { path: relPath, absPath };
  }

  async read(path: string): Promise<Buffer> {
    return readFile(this.resolveSafe(path));
  }

  async delete(path: string): Promise<void> {
    await rm(this.resolveSafe(path), { force: true });
  }

  publicUrl(path: string): string {
    // /uploads 由 @fastify/static 在 main.ts 挂载到 storageLocalDir。
    return `${env.appUrl}/uploads/${path}`;
  }

  /** 解析为绝对路径并校验仍在 root 内（防路径穿越）。 */
  private resolveSafe(path: string): string {
    const abs = resolve(this.root, path);
    if (!abs.startsWith(this.root)) {
      throw new Error(`path escapes storage root: ${path}`);
    }
    return abs;
  }
}

/** 文件名清洗：去掉路径分隔符，保留扩展名。 */
function sanitizeFilename(filename: string): string {
  const ext = extname(filename).toLowerCase().slice(0, 16);
  const base = filename.replace(/[\\/:*?"<>|]/g, "_").slice(0, 64);
  return ext ? `${base}${ext}` : base;
}
