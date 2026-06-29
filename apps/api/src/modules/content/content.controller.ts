import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  type Entry,
  type PaginationMeta,
  ERROR_CODES,
  buildPaginationMeta,
  okList,
} from "@linkqin/shared";
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
@Controller("content")
export class ContentController {
  constructor(
    private readonly entries: EntryService,
    private readonly contentTypes: ContentTypeService,
  ) {}

  @Get(":contentType")
  async list(
    @Param("contentType") contentTypeUid: string,
    @Query("locale") locale: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("sort") sort: string | undefined,
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
    return okList(items.map(toPublicEntry), meta, request.id);
  }

  @Get("single/:contentType")
  async getSingle(
    @Param("contentType") contentTypeUid: string,
    @Query("locale") locale: string | undefined,
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
    return okList([toPublicEntry(items[0]!)], buildPaginationMeta(1, 1, 1), request.id);
  }

  @Get(":contentType/:idOrSlug")
  async getOne(
    @Param("contentType") contentTypeUid: string,
    @Param("idOrSlug") idOrSlug: string,
    @Query("locale") locale: string | undefined,
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
    return okList([toPublicEntry(entry)], buildPaginationMeta(1, 1, 1), request.id);
  }

  private async requireContentTypeByUid(uid: string) {
    const all = await this.contentTypes.list();
    const ct = all.find((c) => c.uid === uid);
    if (!ct) {
      throw apiException(ERROR_CODES.CONTENT_TYPE_NOT_FOUND, "内容类型不存在", undefined, 404);
    }
    return ct;
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
