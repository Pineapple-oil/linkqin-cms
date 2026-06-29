import type {
  CreateEntryInput,
  Entry,
  EntryStatus,
  UpdateEntryInput,
} from "@linkqin/shared";
import { apiClient, type ListResult } from "./client.js";

/**
 * Entry API（开发文档 7.4 /api/admin/entries）。
 */
export interface EntryVersion {
  id: string;
  entryId: string;
  version: number;
  data: Record<string, unknown>;
  editedBy: string | null;
  note: string | null;
  createdAt: string;
}

export interface ListEntriesParams {
  contentType: string;
  status?: EntryStatus;
  locale?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export function listEntries(params: ListEntriesParams): Promise<ListResult<Entry>> {
  const qs = new URLSearchParams();
  qs.set("contentType", params.contentType);
  if (params.status) qs.set("status", params.status);
  if (params.locale) qs.set("locale", params.locale);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.sort) qs.set("sort", params.sort);
  return apiClient.getList<Entry>(`/admin/entries?${qs.toString()}`);
}

export function getEntry(id: string): Promise<Entry> {
  return apiClient.get<Entry>(`/admin/entries/${id}`);
}

export function createEntry(input: CreateEntryInput): Promise<Entry> {
  return apiClient.post<Entry>("/admin/entries", input);
}

export function updateEntry(id: string, input: UpdateEntryInput): Promise<Entry> {
  return apiClient.patch<Entry>(`/admin/entries/${id}`, input);
}

export function deleteEntry(id: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(`/admin/entries/${id}`);
}

export function publishEntry(id: string): Promise<Entry> {
  return apiClient.post<Entry>(`/admin/entries/${id}/publish`);
}

export function unpublishEntry(id: string): Promise<Entry> {
  return apiClient.post<Entry>(`/admin/entries/${id}/unpublish`);
}

export function archiveEntry(id: string): Promise<Entry> {
  return apiClient.post<Entry>(`/admin/entries/${id}/archive`);
}

export function listEntryVersions(id: string): Promise<EntryVersion[]> {
  return apiClient.get<EntryVersion[]>(`/admin/entries/${id}/versions`);
}
