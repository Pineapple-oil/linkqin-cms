import { Inject, Injectable } from "@nestjs/common";
import { ZodError, type z } from "zod";
import {
  type ContentType,
  type CreateEntryInput,
  type Entry,
  type EntryStatus,
  type UpdateEntryInput,
  DEFAULT_LOCALE,
  ERROR_CODES,
  createEntryInputSchema,
  updateEntryInputSchema,
} from "@linkqin/shared";
import {
  ContentValidator,
  FieldRegistry,
  applyPublish,
  type PublishAction,
} from "@linkqin/core";
import type { EventBus } from "@linkqin/plugin-sdk";
import { AuditService } from "../../common/audit.service.js";
import { apiException } from "../../common/errors.js";
import { EVENT_BUS } from "../../common/events.module.js";
import { ContentTypeService } from "../content-types/content-type.service.js";
import {
  ENTRY_REPO,
  type EntryListFilter,
  type EntryRepository,
  type EntryRow,
  type EntrySort,
} from "./entry.repository.js";

/**
 * Entry 业务逻辑（开发文档 6.3 / 10）。
 *
 * 关键规则：
 * - 内容类型必须存在（否则 CONTENT_TYPE_NOT_FOUND）。
 * - data 走 ContentValidator（按字段类型 + 必填 + strict key 校验）。
 * - 草稿 data 与 publishedData 隔离：编辑只改 data；发布时快照到 publishedData。
 * - 每次 update/publish 写一条 entry_versions。
 * - 写操作 emit entry.* 事件（开发文档 §10，为 Phase 6 webhook 铺路）。
 */
@Injectable()
export class EntryService {
  private readonly validator = new ContentValidator(new FieldRegistry());

  constructor(
    @Inject(ENTRY_REPO) private readonly repo: EntryRepository,
    private readonly contentTypes: ContentTypeService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async list(
    filter: EntryListFilter,
    pagination: { page: number; pageSize: number },
    sort: EntrySort,
  ): Promise<{ items: Entry[]; total: number }> {
    const { items, total } = await this.repo.list(filter, pagination, sort);
    return { items: items.map(toEntry), total };
  }

  async getById(id: string): Promise<Entry> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw apiException(ERROR_CODES.ENTRY_NOT_FOUND, "内容不存在", undefined, 404);
    }
    return toEntry(row);
  }

  async create(input: CreateEntryInput, actorId: string | null): Promise<Entry> {
    const parsed = parseCreate(input);
    const contentType = await this.requireContentType(parsed.contentTypeId);

    const result = this.validator.validate(contentType, parsed.data);
    if (!result.success) {
      throw apiException(
        ERROR_CODES.VALIDATION_ERROR,
        "内容校验失败",
        { errors: result.errors },
        400,
      );
    }
    const data = result.data ?? parsed.data;
    const titleSnapshot =
      parsed.titleSnapshot ?? this.validator.pickTitleField(contentType, data) ?? null;

    const row = await this.repo.create({
      contentTypeId: parsed.contentTypeId,
      status: "draft",
      locale: parsed.locale ?? DEFAULT_LOCALE,
      slug: parsed.slug ?? null,
      titleSnapshot,
      data,
      createdBy: actorId,
      version: 1,
    });

    await this.repo.createVersion({
      entryId: row.id,
      version: 1,
      data,
      editedBy: actorId,
      note: "initial",
    });
    await this.events.emit("entry.created", {
      entryId: row.id,
      contentTypeId: row.contentTypeId,
    });
    return toEntry(row);
  }

  async update(id: string, input: UpdateEntryInput, actorId: string | null): Promise<Entry> {
    const parsed = parseUpdate(input);
    const current = await this.requireEntry(id);
    const contentType = await this.requireContentType(current.contentTypeId);

    const nextData = parsed.data ?? current.data;
    if (parsed.data) {
      const result = this.validator.validate(contentType, nextData);
      if (!result.success) {
        throw apiException(
          ERROR_CODES.VALIDATION_ERROR,
          "内容校验失败",
          { errors: result.errors },
          400,
        );
      }
    }
    const titleSnapshot =
      parsed.titleSnapshot ??
      this.validator.pickTitleField(contentType, nextData) ??
      current.titleSnapshot;
    const nextVersion = current.version + 1;

    const updated = await this.repo.update(id, {
      data: parsed.data ? nextData : undefined,
      slug: parsed.slug,
      titleSnapshot,
      updatedBy: actorId,
      version: nextVersion,
    });
    if (!updated) {
      throw apiException(ERROR_CODES.ENTRY_NOT_FOUND, "内容不存在", undefined, 404);
    }

    await this.repo.createVersion({
      entryId: id,
      version: nextVersion,
      data: nextData,
      editedBy: actorId,
    });
    await this.events.emit("entry.updated", { entryId: id, contentTypeId: current.contentTypeId });
    return toEntry(updated);
  }

  async publishAction(
    id: string,
    action: PublishAction,
    actorId: string | null,
  ): Promise<Entry> {
    const current = await this.requireEntry(id);
    const patch = applyPublish(toEntry(current), action, {
      actorId: actorId ?? "",
      at: new Date(),
    });
    const updated = await this.repo.applyStatusPatch(id, {
      status: patch.status,
      publishedData: patch.publishedData,
      publishedAt: patch.publishedAt,
      publishedBy: patch.publishedBy,
      version: patch.version,
      updatedBy: actorId,
    });
    if (!updated) {
      throw apiException(ERROR_CODES.ENTRY_NOT_FOUND, "内容不存在", undefined, 404);
    }

    await this.repo.createVersion({
      entryId: id,
      version: patch.version,
      data: current.data,
      editedBy: actorId,
      note: action,
    });

    if (action === "publish") {
      await this.events.emit("entry.published", {
        entryId: id,
        contentTypeId: current.contentTypeId,
      });
    } else if (action === "unpublish") {
      await this.events.emit("entry.unpublished", {
        entryId: id,
        contentTypeId: current.contentTypeId,
      });
    }
    return toEntry(updated);
  }

  async remove(id: string): Promise<void> {
    await this.requireEntry(id);
    await this.repo.delete(id);
  }

  async listVersions(entryId: string) {
    await this.requireEntry(entryId);
    return this.repo.listVersions(entryId);
  }

  private async requireContentType(contentTypeId: string): Promise<ContentType> {
    try {
      return await this.contentTypes.getById(contentTypeId);
    } catch {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }
  }

  private async requireEntry(id: string): Promise<EntryRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw apiException(ERROR_CODES.ENTRY_NOT_FOUND, "内容不存在", undefined, 404);
    }
    return row;
  }
}

function parseCreate(input: unknown): z.infer<typeof createEntryInputSchema> {
  try {
    return createEntryInputSchema.parse(input);
  } catch (err) {
    throw toValidationError(err);
  }
}

function parseUpdate(input: unknown): z.infer<typeof updateEntryInputSchema> {
  try {
    return updateEntryInputSchema.parse(input);
  } catch (err) {
    throw toValidationError(err);
  }
}

function toValidationError(err: unknown): unknown {
  if (err instanceof ZodError) {
    throw apiException(
      ERROR_CODES.VALIDATION_ERROR,
      "请求参数校验失败",
      { issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      400,
    );
  }
  throw err;
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    contentTypeId: row.contentTypeId,
    status: row.status as EntryStatus,
    locale: row.locale,
    slug: row.slug ?? undefined,
    titleSnapshot: row.titleSnapshot ?? undefined,
    data: row.data,
    publishedData: row.publishedData,
    version: row.version,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    publishedBy: row.publishedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}
