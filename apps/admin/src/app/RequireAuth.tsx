import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSyncExternalStore } from "react";
import { authStore } from "../stores/auth.js";

function useAccessToken(): string | null {
  return useSyncExternalStore(
    authStore.subscribe,
    authStore.getAccessToken,
    authStore.getAccessToken,
  );
}

/** 路由保护：没有 access token 时跳登录页。 */
export function RequireAuth() {
  const location = useLocation();
  const token = useAccessToken();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
