import { apiClient } from "./client.js";

/** 插件菜单项（从插件 list 响应中提取）。 */
export interface PluginMenuEntry {
  key: string;
  label: string;
  path: string;
  icon?: string;
  permission?: string;
  order?: number;
}

/** 对外插件形态。 */
export interface PluginView {
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  menus: PluginMenuEntry[];
  hasConfigSchema: boolean;
}

/** 插件 API（开发文档 /api/admin/plugins）。 */
export function listPlugins(): Promise<PluginView[]> {
  return apiClient.get<PluginView[]>("/admin/plugins");
}

export function enablePlugin(name: string, config?: Record<string, unknown>): Promise<PluginView> {
  return apiClient.post<PluginView>(`/admin/plugins/${name}/enable`, config ? { config } : undefined);
}

export function disablePlugin(name: string): Promise<PluginView> {
  return apiClient.post<PluginView>(`/admin/plugins/${name}/disable`);
}

export function getPluginConfig(name: string): Promise<Record<string, unknown>> {
  return apiClient.get<Record<string, unknown>>(`/admin/plugins/${name}/config`);
}

export function setPluginConfig(name: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiClient.patch<Record<string, unknown>>(`/admin/plugins/${name}/config`, config);
}
