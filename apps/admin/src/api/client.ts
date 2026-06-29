import type { ApiResponse, AuthUser } from "@linkqin/shared";
import { authStore } from "../stores/auth.js";

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

interface RequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

interface AuthRefreshData {
  accessToken: string;
  user: AuthUser;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const token = authStore.getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | { error?: ApiErrorShape } | null;

  if (res.ok && json && "data" in json) {
    return json.data;
  }

  const err = json as { error?: ApiErrorShape } | null;
  const code = err?.error?.code ?? "UNKNOWN_ERROR";

  // access token 过期/无效时尝试用 httpOnly refresh cookie 换新 access，再重试原请求。
  if (!init?.skipAuthRefresh && res.status === 401 && token && code !== "INVALID_CREDENTIALS") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...init, skipAuthRefresh: true });
    }
  }

  throw new ApiError(
    code,
    err?.error?.message ?? "Request failed",
    res.status,
    err?.error?.details,
  );
}

async function tryRefresh(): Promise<boolean> {
  try {
    const data = await request<AuthRefreshData>("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true,
    });
    authStore.setAccessToken(data.accessToken);
    authStore.setUser(data.user);
    return true;
  } catch {
    authStore.clear();
    return false;
  }
}

interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** 分页列表响应（保留 meta，供列表页用）。 */
export interface ListResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

/** 分页列表请求：返回 data 数组 + meta（开发文档 7.2 分页格式）。 */
async function requestList<T>(path: string): Promise<ListResult<T>> {
  const token = authStore.getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = (await res.json().catch(() => null)) as
    | { data: T[]; meta: { page: number; pageSize: number; total: number; pageCount: number } }
    | { error?: ApiErrorShape }
    | null;
  if (res.ok && json && "data" in json && "meta" in json) {
    return { items: json.data, meta: json.meta };
  }
  const err = json as { error?: ApiErrorShape } | null;
  throw new ApiError(
    err?.error?.code ?? "UNKNOWN_ERROR",
    err?.error?.message ?? "Request failed",
    res.status,
    err?.error?.details,
  );
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getList: <T>(path: string) => requestList<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
