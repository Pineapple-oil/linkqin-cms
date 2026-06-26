import { apiClient } from "./client.js";

export interface HealthStatus {
  status: string;
  service: string;
  uptime: number;
  timestamp: string;
}

/** 健康检查，用于后台显示后端连接状态。 */
export function getHealth(): Promise<HealthStatus> {
  return apiClient.get<HealthStatus>("/health");
}
