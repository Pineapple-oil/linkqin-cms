import type { Asset, UpdateAssetInput } from "@linkqin/shared";
import { apiClient, ApiError, type ListResult } from "./client.js";
import { authStore } from "../stores/auth.js";

const BASE_URL = "/api";

/** 资产 API（开发文档 /api/admin/assets）。 */

export function listAssets(params?: { type?: "image"; page?: number; pageSize?: number }): Promise<ListResult<Asset>> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  return apiClient.getList<Asset>(`/admin/assets?${qs.toString()}`);
}

export function getAsset(id: string): Promise<Asset> {
  return apiClient.get<Asset>(`/admin/assets/${id}`);
}

/** 上传：multipart，不能用 JSON apiClient.post，直接 fetch 带 token。 */
export async function uploadAsset(file: File): Promise<Asset> {
  const token = authStore.getAccessToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/admin/assets/upload`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = (await res.json().catch(() => null)) as { data?: Asset; error?: { code: string; message: string } } | null;
  if (!res.ok || !json?.data) {
    throw new ApiError(json?.error?.code ?? "UNKNOWN_ERROR", json?.error?.message ?? "上传失败", res.status);
  }
  return json.data;
}

export function updateAsset(id: string, input: UpdateAssetInput): Promise<Asset> {
  return apiClient.patch<Asset>(`/admin/assets/${id}`, input);
}

export function deleteAsset(id: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(`/admin/assets/${id}`);
}
