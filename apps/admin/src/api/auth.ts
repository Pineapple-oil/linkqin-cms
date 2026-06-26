import type { AuthUser, LoginInput } from "@linkqin/shared";
import { apiClient } from "./client.js";

export interface AuthPayload {
  accessToken: string;
  user: AuthUser;
}

export function login(input: LoginInput): Promise<AuthPayload> {
  return apiClient.post<AuthPayload>("/auth/login", input);
}

export function refresh(): Promise<AuthPayload> {
  return apiClient.post<AuthPayload>("/auth/refresh");
}

export function logout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>("/auth/logout");
}

export function getMe(): Promise<AuthUser> {
  return apiClient.get<AuthUser>("/auth/me");
}
