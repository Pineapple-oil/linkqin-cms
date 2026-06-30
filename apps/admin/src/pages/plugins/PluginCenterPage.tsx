import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Modal,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { PluginView } from "../../api/plugins.js";
import { disablePlugin, enablePlugin, listPlugins } from "../../api/plugins.js";
import { ApiError } from "../../api/client.js";

const { Title, Text } = Typography;

/**
 * 插件中心（开发文档 12）。
 * 列出内置插件，支持启用/禁用 + 配置查看。
 */
export function PluginCenterPage() {
  const queryClient = useQueryClient();
  const [messageApi, messageHolder] = message.useMessage();
  const [configPlugin, setConfigPlugin] = useState<PluginView | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plugins"],
    queryFn: listPlugins,
  });

  const toggleMutation = useMutation({
    mutationFn: async (vars: { name: string; enable: boolean }) =>
      vars.enable ? enablePlugin(vars.name) : disablePlugin(vars.name),
    onSuccess: (_d, vars) => {
      messageApi.success(vars.enable ? "已启用" : "已禁用");
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (err) => messageApi.error(err instanceof ApiError ? err.message : "操作失败"),
  });

  const columns: ColumnsType<PluginView> = [
    {
      title: "插件",
      key: "plugin",
      render: (_v, r) => (
        <div>
          <Text strong>{r.displayName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.name} · v{r.version}
          </Text>
        </div>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      render: (d: string | null) => d ?? "-",
    },
    {
      title: "菜单项",
      key: "menus",
      width: 120,
      render: (_v, r) =>
        r.menus.length > 0 ? (
          r.menus.map((m) => <Tag key={m.key}>{m.label}</Tag>)
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "可配置",
      key: "config",
      width: 80,
      align: "center",
      render: (_v, r) => (r.hasConfigSchema ? <Tag color="blue">是</Tag> : "-"),
    },
    {
      title: "启用",
      key: "enabled",
      width: 80,
      align: "center",
      render: (_v, r) => (
        <Switch
          checked={r.enabled}
          loading={toggleMutation.isPending}
          onChange={(checked) => toggleMutation.mutate({ name: r.name, enable: checked })}
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_v, r) =>
        r.hasConfigSchema ? (
          <Button size="small" onClick={() => setConfigPlugin(r)}>
            配置
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      {messageHolder}
      <Title level={3} style={{ marginBottom: 16 }}>
        插件中心
      </Title>
      {isLoading ? (
        <Spin />
      ) : (
        <Table<PluginView> rowKey="name" columns={columns} dataSource={data ?? []} pagination={false} />
      )}

      <Modal
        title={`${configPlugin?.displayName ?? ""} 配置`}
        open={configPlugin !== null}
        footer={null}
        onCancel={() => setConfigPlugin(null)}
      >
        {configPlugin && (
          <PluginConfigEditor
            name={configPlugin.name}
            onClose={() => setConfigPlugin(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/** 插件配置编辑器（JSON 视图 + 说明：通过 PATCH /config 修改）。 */
function PluginConfigEditor({ name, onClose }: { name: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["plugin-config", name],
    queryFn: () => import("../../api/plugins.js").then((m) => m.getPluginConfig(name)),
  });
  return (
    <Card size="small" loading={isLoading}>
      <Text type="secondary">当前配置（通过 API 修改）：</Text>
      {data && (
        <pre
          style={{
            marginTop: 8,
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 4,
            fontSize: 12,
            overflow: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Button onClick={onClose}>关闭</Button>
      </div>
    </Card>
  );
}
