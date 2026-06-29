import { Inject, Injectable } from "@nestjs/common";
import { ZodError, type z } from "zod";
import {
  type ContentType,
  type CreateContentTypeInput,
  type FieldDefinition,
  type UpdateContentTypeInput,
  createContentTypeInputSchema,
  updateContentTypeInputSchema,
  ERROR_CODES,
} from "@linkqin/shared";
import { bumpSchemaVersion } from "@linkqin/core";
import { apiException } from "../../common/errors.js";
import {
  CT_REPO,
  type ContentTypeInsert,
  type ContentTypeRepository,
  type ContentTypeRow,
  type ContentTypeUpsert,
} from "./content-type.repository.js";

/**
 * 内容类型业务逻辑（开发文档 6.1 / 13）。
 *
 * 关键规则：
 * - uid 全局唯一，重复返回 CONTENT_TYPE_UID_DUPLICATE(409)。
 * - 字段定义走 fieldDefinitionSchema，非法返回 CONTENT_TYPE_FIELD_INVALID(400)。
 * - 字段结构变化时升 schemaVersion。
 * - 删除前检查 entries，有引用返回 CONTENT_TYPE_HAS_ENTRIES(409)。
 *
 * 手动构造（绕过 esbuild 装饰器元数据限制）的单测见 content-type.service.test.ts。
 */
@Injectable()
export class ContentTypeService {
  constructor(@Inject(CT_REPO) private readonly repo: ContentTypeRepository) {}

  async list(): Promise<ContentType[]> {
    return (await this.repo.list()).map(toContentType);
  }

  async getById(id: string): Promise<ContentType> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }
    return toContentType(row);
  }

  async create(input: CreateContentTypeInput): Promise<ContentType> {
    // 1. 请求体校验（含 kind 枚举、uid kebab-case、字段形态）。
    // 字段非法会映射成 CONTENT_TYPE_FIELD_INVALID（验收核心）。
    const parsed = parseCreate(input);

    // 2. uid 唯一性。
    const existing = await this.repo.findByUid(parsed.uid);
    if (existing) {
      throw apiException(
        ERROR_CODES.CONTENT_TYPE_UID_DUPLICATE,
        `内容类型 uid "${parsed.uid}" 已存在`,
        { uid: parsed.uid },
        409,
      );
    }

    return toContentType(await this.repo.create(toInsert(parsed)));
  }

  async update(id: string, input: UpdateContentTypeInput): Promise<ContentType> {
    const parsed = parseUpdate(input);

    const current = await this.repo.findById(id);
    if (!current) {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }

    // uid/kind 不可改：updateContentTypeInputSchema 已不含这两个字段。

    const nextFields: FieldDefinition[] = parsed.fields ?? (current.fields as FieldDefinition[]);

    // 字段结构变化时升 schemaVersion（开发文档 6.1）。
    const schemaVersion = bumpSchemaVersion(
      { schemaVersion: current.schemaVersion, fields: current.fields as FieldDefinition[] },
      nextFields,
    );

    const upsert: ContentTypeUpsert = {
      displayName: parsed.displayName,
      description: parsed.description ?? null,
      fields: nextFields,
      options: parsed.options,
      schemaVersion,
    };
    const updated = await this.repo.update(id, upsert);
    if (!updated) {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }
    return toContentType(updated);
  }

  async remove(id: string): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }
    const entryCount = await this.repo.countEntries(id);
    if (entryCount > 0) {
      throw apiException(
        ERROR_CODES.CONTENT_TYPE_HAS_ENTRIES,
        "该内容类型下存在内容条目，无法删除",
        { entryCount },
        409,
      );
    }
    await this.repo.delete(id);
  }
}

/**
 * 把 ZodError 转成业务异常：
 * - 错误路径在 `fields` 上的（字段定义非法）→ CONTENT_TYPE_FIELD_INVALID(400)。
 * - 其余（uid/kind/displayName 等）→ VALIDATION_ERROR(400)。
 *
 * 这样「字段非法配置」返回明确错误码（验收核心），且与通用入参校验区分。
 */
function parseCreate(input: unknown): z.infer<typeof createContentTypeInputSchema> {
  try {
    return createContentTypeInputSchema.parse(input);
  } catch (err) {
    throw toFieldError(err);
  }
}

function parseUpdate(input: unknown): z.infer<typeof updateContentTypeInputSchema> {
  try {
    return updateContentTypeInputSchema.parse(input);
  } catch (err) {
    throw toFieldError(err);
  }
}

function toFieldError(err: unknown): unknown {
  if (err instanceof ZodError) {
    const onFields = err.issues.some((i) => i.path[0] === "fields");
    const code = onFields ? ERROR_CODES.CONTENT_TYPE_FIELD_INVALID : ERROR_CODES.VALIDATION_ERROR;
    const message = onFields ? "字段定义非法" : "请求参数校验失败";
    throw apiException(
      code,
      message,
      { issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      400,
    );
  }
  throw err;
}

/** 把经过 Zod 校验的创建输入映射成 DB 写入值（填默认值）。 */
function toInsert(parsed: {
  uid: string;
  kind: string;
  displayName: string;
  description?: string;
  fields?: unknown[];
  options?: Record<string, unknown>;
}): ContentTypeInsert {
  return {
    uid: parsed.uid,
    kind: parsed.kind,
    displayName: parsed.displayName,
    description: parsed.description ?? null,
    fields: parsed.fields ?? [],
    options: parsed.options ?? {},
  };
}

/** DB 行 → 对外 ContentType（供 shared 类型消费，遵守规则 6）。 */
function toContentType(row: ContentTypeRow): ContentType {
  return {
    id: row.id,
    uid: row.uid,
    kind: row.kind as ContentType["kind"],
    displayName: row.displayName,
    description: row.description ?? undefined,
    fields: row.fields as ContentType["fields"],
    options: row.options as ContentType["options"],
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
