import type { z } from "zod";
import type { PaginationMeta } from "../schemas/pagination.js";

/**
 * 统一响应格式，见开发文档 7.2。
 * 成功：{ data, meta }
 * 分页：{ data: [], meta: { page, pageSize, total, pageCount, requestId } }
 * 失败：{ error: { code, message, details }, meta: { requestId } }
 */
export interface ApiResponse<T = unknown> {
  data: T;
  meta: {
    requestId?: string;
  };
}

export interface ApiListResponse<T = unknown> extends ApiResponse<readonly T[]> {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    requestId?: string;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId?: string;
  };
}

/** 构造成功响应。 */
export function ok<T>(data: T, requestId?: string): ApiResponse<T> {
  return { data, meta: { requestId } };
}

/** 构造分页列表响应。 */
export function okList<T>(
  items: readonly T[],
  pagination: PaginationMeta,
  requestId?: string,
): ApiListResponse<T> {
  return {
    data: items,
    meta: { ...pagination, requestId },
  };
}

/** 构造错误响应。 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponse {
  return {
    error: { code, message, details },
    meta: { requestId },
  };
}

export type AnySchema = z.ZodTypeAny;
