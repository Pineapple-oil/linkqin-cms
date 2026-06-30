import { ApiTags } from "@nestjs/swagger";
import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  type ContentType,
  type Entry,
  type PaginationMeta,
  ERROR_CODES,
  buildPaginationMeta,
  okList,
} from "@linkqin/shared";
import { AssetService } from "../assets/asset.service.js";
import { ApiTokenGuard } from "../api-tokens/api-token.guard.js";
import { PreviewService } from "./preview.service.js";
import { apiException } from "../../common/errors.js";
import { ContentTypeService } from "../content-types/content-type.service.js";
import { EntryService } from "../entries/entry.service.js";
import type { EntrySort } from "../entries/entry.repository.js";

/**
 * 公开内容消费 API（开发文档 7.3）。
 * - GET /api/content/:contentType            列表（仅 published，输出 publishedData）
 * - GET /api/content/:contentType/:idOrSlug  单条
 * - GET /api/content/single/:contentType     single 类型
 *
 * 公开接口默认只返回 status=published 的内容，且输出 publishedData
 * 而非草稿 data（开发文档 §10）。
 *
 * 支持查询参数：locale、page、pageSize、sort（按 publishedAt/updatedAt/createdAt 升降序）。
 * filter/fields/populate 暂占位不实现（Phase 6）。
 */
@ApiTags("公开内容")
@Controller("content")
@UseGuards(ApiTokenGuard)
export class ContentController {
  constructor(
    private readonly entries: EntryService,
    private readonly contentTypes: ContentTypeService,
    private readonly assets: AssetService,
    private readonly previewService: PreviewService,
  ) {}

  @Get(":contentType")
  async list(
    @Param("contentType") contentTypeUid: string,
    @Query("locale") locale: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("sort") sort: string | undefined,
    @Query("populate") populate: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const ct = await this.requireContentTypeByUid(contentTypeUid);
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const sortParsed = parseSort(sort);

    const { items, total } = await this.entries.list(
      { contentTypeId: ct.id!, status: "published", locale },
      { page: pageNum, pageSize: pageSizeNum },
      sortParsed,
    );
    const meta: PaginationMeta = buildPaginationMeta(total, pageNum, pageSizeNum);
    const out = populate === "media"
      ? await this.populateMedia(items, ct)
      : items.map(toPublicEntry);
    return okList(out, meta, request.id);
  }

  @Get("single/:contentType")
  async getSingle(
    @Param("contentType") contentTypeUid: string,
    @Query("locale") locale: string | undefined,
    @Query("populate") populate: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const ct = await this.requireContentTypeByUid(contentTypeUid);
    if (ct.kind !== "single") {
      throw apiException(
        ERROR_CODES.NOT_FOUND,
        "该内容类型不是 single 类型",
        undefined,
        404,
      );
    }
    const { items } = await this.entries.list(
      { contentTypeId: ct.id!, status: "published", locale },
      { page: 1, pageSize: 1 },
      { field: "updatedAt", direction: "desc" },
    );
    if (items.length === 0) {
      throw apiException(ERROR_CODES.NOT_FOUND, "内容不存在", undefined, 404);
    }
    const out = populate === "media"
      ? await this.populateMedia([items[0]!], ct)
      : [toPublicEntry(items[0]!)];
    return okList(out, buildPaginationMeta(1, 1, 1), request.id);
  }

  /**
   * 草稿预览（开发文档 §10）：`GET /api/content/preview/:id?token=<previewToken>`。
   * 返回草稿 data（非 publishedData），必须用 preview token（短期 JWT）。
   */
  @Get("preview/:id")
  async preview(
    @Param("id") id: string,
    @Query("token") token: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    if (!token) {
      throw apiException(ERROR_CODES.TOKEN_INVALID, "缺少预览 token", undefined, 401);
    }
    const payload = this.previewService.verify(token);
    if (payload.entryId !== id) {
      throw apiException(ERROR_CODES.TOKEN_INVALID, "预览 token 与内容不匹配", undefined, 401);
    }
    // 直接读 entry（含草稿 data），不经 published 过滤。
    const entry = await this.entries.getById(id);
    return okList(
      [{
        id: entry.id,
        slug: entry.slug,
        title: entry.titleSnapshot,
        locale: entry.locale,
        data: entry.data, // 草稿 data（非 publishedData）
        status: entry.status,
        version: entry.version,
      }],
      buildPaginationMeta(1, 1, 1),
      request.id,
    );
  }

  @Get(":contentType/:idOrSlug")
  async getOne(
    @Param("contentType") contentTypeUid: string,
    @Param("idOrSlug") idOrSlug: string,
    @Query("locale") locale: string | undefined,
    @Query("populate") populate: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const ct = await this.requireContentTypeByUid(contentTypeUid);
    let entry: Entry | undefined;
    // id 优先（uuid 格式），否则按 slug。
    if (isUuid(idOrSlug)) {
      try {
        entry = await this.entries.getById(idOrSlug);
      } catch {
        entry = undefined;
      }
      if (entry && entry.status !== "published") entry = undefined;
    } else {
      const { items } = await this.entries.list(
        { contentTypeId: ct.id!, status: "published", locale },
        { page: 1, pageSize: 200 },
        { field: "updatedAt", direction: "desc" },
      );
      entry = items.find((e) => e.slug === idOrSlug);
    }
    if (!entry) {
      throw apiException(ERROR_CODES.NOT_FOUND, "内容不存在", undefined, 404);
    }
    const out = populate === "media"
      ? await this.populateMedia([entry], ct)
      : [toPublicEntry(entry)];
    return okList(out, buildPaginationMeta(1, 1, 1), request.id);
  }

  private async requireContentTypeByUid(uid: string) {
    const all = await this.contentTypes.list();
    const ct = all.find((c) => c.uid === uid);
    if (!ct) {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }
    return ct;
  }

  /**
   * 轻量 populate：把 entry data 中 media 字段的 asset id 替换成
   * {id, url, alt} 对象（开发文档验收点：公开 API 返回 asset URL 和 alt）。
   * 仅 media 类型字段；通用 populate DSL 留 Phase 6。
   */
  private async populateMedia(
    entries: Entry[],
    contentType: ContentType,
  ): Promise<Record<string, unknown>[]> {
    const mediaFieldNames = contentType.fields
      .filter((f) => f.type === "media")
      .map((f) => f.name);
    if (mediaFieldNames.length === 0) {
      return entries.map(toPublicEntry);
    }
    // 收集所有 asset id。
    const ids = new Set<string>();
    for (const e of entries) {
      for (const name of mediaFieldNames) {
        const v = e.data?.[name];
        if (typeof v === "string" && v.length > 0) ids.add(v);
      }
    }
    const assetMap = ids.size > 0 ? await this.assets.findByIds([...ids]) : new Map();
    return entries.map((e) => {
      const base = toPublicEntry(e);
      if (!base.data || typeof base.data !== "object") return base;
      const data = { ...(base.data as Record<string, unknown>) };
      for (const name of mediaFieldNames) {
        const v = data[name];
        if (typeof v === "string" && assetMap.has(v)) {
          const a = assetMap.get(v)!;
          data[name] = { id: a.id, url: a.url, alt: a.alt };
        }
      }
      return { ...base, data };
    });
  }
}

/** 输出公开形态：用 publishedData 作为 data，隐藏草稿 data 与内部审计字段。 */
function toPublicEntry(entry: Entry) {
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.titleSnapshot,
    locale: entry.locale,
    data: entry.publishedData ?? {},
    publishedAt: entry.publishedAt,
  };
}

function parseSort(sort: string | undefined): EntrySort {
  const fallback: EntrySort = { field: "publishedAt", direction: "desc" };
  if (!sort) return fallback;
  const desc = sort.startsWith("-");
  const name = desc ? sort.slice(1) : sort;
  if (name === "publishedAt" || name === "createdAt" || name === "updatedAt") {
    return { field: name, direction: desc ? "desc" : "asc" };
  }
  return fallback;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
