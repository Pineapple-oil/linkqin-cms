import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import type { ContentType } from "@linkqin/shared";
import { deleteContentType, listContentTypes } from "../../api/content-types.js";
import { ApiError } from "../../api/client.js";

const { Title } = Typography;

const kindColor: Record<string, string> = {
  collection: "blue",
  single: "green",
  component: "purple",
};

/**
 * 内容类型列表页（开发文档 12）。
 * 展示所有内容类型，支持新建、编辑字段、删除（二次确认）。
 */
export function ContentTypeListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageHolder] = message.useMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["content-types"],
    queryFn: listContentTypes,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContentType,
    onSuccess: () => {
      messageApi.success("已删除");
      void queryClient.invalidateQueries({ queryKey: ["content-types"] });
    },
    onError: (err) => {
      messageApi.error(err instanceof ApiError ? err.message : "删除失败");
    },
  });

  const columns: ColumnsType<ContentType> = [
    { title: "UID", dataIndex: "uid", key: "uid" },
    {
      title: "类型",
      dataIndex: "kind",
      key: "kind",
      width: 110,
      render: (kind: string) => <Tag color={kindColor[kind] ?? "default"}>{kind}</Tag>,
    },
    { title: "显示名", dataIndex: "displayName", key: "displayName" },
    {
      title: "字段数",
      key: "fieldCount",
      width: 90,
      align: "center",
      render: (_: unknown, record: ContentType) => record.fields.length,
    },
    {
      title: "版本",
      dataIndex: "schemaVersion",
      key: "schemaVersion",
      width: 80,
      align: "center",
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: unknown, record: ContentType) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/content-types/${record.id}`)}>
            编辑字段
          </Button>
          <Popconfirm
            title="确认删除该内容类型？"
            description="若该类型下存在内容条目将无法删除。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => deleteMutation.mutate(record.id!)}
          >
            <Button size="small" danger loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {messageHolder}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          内容类型
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/content-types/new")}>
          新建内容类型
        </Button>
      </div>
      <Table<ContentType>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={false}
      />
    </div>
  );
}
