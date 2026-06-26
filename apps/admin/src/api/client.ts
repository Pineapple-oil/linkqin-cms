import type { ApiResponse } from "@linkqin/shared";

/**
 * 后台统一 API client。
 * 规则（开发文档 AI 规则 6）：后台 UI 不得直接拼后端内部字段，
 * 必须通过 @linkqin/shared 的类型和本 client。
 */
const BASE_URL = "/api";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !json) {
    const err = json as unknown as {
      error?: { code: string; message: string; details?: Record<string, unknown> };
    };
    throw new ApiError(
      err?.error?.code ?? "UNKNOWN_ERROR",
      err?.error?.message ?? "Request failed",
      res.status,
      err?.error?.details,
    );
  }
  return json.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
