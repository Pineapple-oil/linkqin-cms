import type { ContentType, CreateContentTypeInput, UpdateContentTypeInput } from "@linkqin/shared";
import { apiClient } from "./client.js";

/**
 * 内容类型 API（开发文档 7.4 /api/admin/content-types）。
 * 类型走 @linkqin/shared，遵守规则 6（后台不拼后端内部字段）。
 */

export function listContentTypes(): Promise<ContentType[]> {
  return apiClient.get<ContentType[]>("/admin/content-types");
}

export function getContentType(id: string): Promise<ContentType> {
  return apiClient.get<ContentType>(`/admin/content-types/${id}`);
}

export function createContentType(input: CreateContentTypeInput): Promise<ContentType> {
  return apiClient.post<ContentType>("/admin/content-types", input);
}

export function updateContentType(
  id: string,
  input: UpdateContentTypeInput,
): Promise<ContentType> {
  return apiClient.patch<ContentType>(`/admin/content-types/${id}`, input);
}

export function deleteContentType(id: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(`/admin/content-types/${id}`);
}
