import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Spin, Typography } from "antd";
import { getHealth } from "../../api/health.js";

const { Title, Paragraph } = Typography;

/**
 * Dashboard 占位页。
 * Phase 0 只验证后台可访问；内容数量、最近发布等待 Phase 1+ 实现。
 */
export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    retry: false,
  });

  return (
    <Card>
      <Title level={3}>仪表盘</Title>
      <Paragraph type="secondary">
        欢迎使用 linkqin CMS。这里是 Phase 0 工程骨架，后续内容统计将在此展示。
      </Paragraph>

      <Card type="inner" title="后端连接状态" style={{ marginTop: 16 }}>
        {isLoading && <Spin />}
        {isError && (
          <Alert
            type="warning"
            showIcon
            message="无法连接后端"
            description={(error as Error)?.message ?? "请确认 API 服务已启动 (默认 :3000)"}
          />
        )}
        {data && (
          <Paragraph>
            <strong>{data.service}</strong> — {data.status}（uptime{" "}
            {Math.round(data.uptime)}s）
          </Paragraph>
        )}
      </Card>
    </Card>
  );
}
