import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { ContentType, Entry, EntryStatus } from "@linkqin/shared";
import { listContentTypes } from "../../api/content-types.js";
import {
  archiveEntry,
  deleteEntry,
  listEntries,
  publishEntry,
  unpublishEntry,
} from "../../api/entries.js";
import { ApiError } from "../../api/client.js";

const { Title } = Typography;

const statusColor: Record<string, string> = {
  draft: "default",
  published: "green",
  archived: "orange",
};

/**
 * 内容列表页（开发文档 12）。
 * 按内容类型筛选 + 状态筛选 + 分页；行操作编辑/发布/撤回/归档/删除。
 */
export function EntryListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [messageApi, messageHolder] = message.useMessage();

  const contentTypeId = searchParams.get("contentType") ?? "";
  const status = (searchParams.get("status") as EntryStatus | null) ?? null;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 10);

  const { data: contentTypes } = useQuery({
    queryKey: ["content-types"],
    queryFn: listContentTypes,
  });

  const entriesQuery = useQuery({
    queryKey: ["entries", contentTypeId, status, page, pageSize],
    queryFn: () =>
      listEntries({
        contentType: contentTypeId,
        status: status ?? undefined,
        page,
        pageSize,
      }),
    enabled: Boolean(contentTypeId),
  });

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });

  const runAction = useMutation({
    mutationFn: async (vars: { id: string; action: "publish" | "unpublish" | "archive" | "delete" }) => {
      switch (vars.action) {
        case "publish":
          return publishEntry(vars.id);
        case "unpublish":
          return unpublishEntry(vars.id);
        case "archive":
          return archiveEntry(vars.id);
        case "delete":
          return deleteEntry(vars.id);
      }
    },
    onSuccess: (_d, vars) => {
      messageApi.success(`已${actionLabel(vars.action)}`);
      invalidate();
    },
    onError: (err) => {
      messageApi.error(err instanceof ApiError ? err.message : "操作失败");
    },
  });

  const columns: ColumnsType<Entry> = [
    {
      title: "标题",
      key: "title",
      render: (_, r) => r.titleSnapshot ?? r.slug ?? r.id,
    },
    {
      title: "Slug",
      dataIndex: "slug",
      key: "slug",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => <Tag color={statusColor[s] ?? "default"}>{s}</Tag>,
    },
    { title: "版本", dataIndex: "version", key: "version", width: 70, align: "center" },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      render: (_v, r) => (
        <Space wrap>
          <Button size="small" onClick={() => navigate(`/entries/${r.id}`)}>
            编辑
          </Button>
          {r.status !== "published" && (
            <Popconfirm title="确认发布？" onConfirm={() => runAction.mutate({ id: r.id!, action: "publish" })}>
              <Button size="small" type="primary" loading={runAction.isPending}>
                发布
              </Button>
            </Popconfirm>
          )}
          {r.status === "published" && (
            <Popconfirm title="确认撤回？" onConfirm={() => runAction.mutate({ id: r.id!, action: "unpublish" })}>
              <Button size="small">撤回</Button>
            </Popconfirm>
          )}
          {r.status !== "archived" && (
            <Popconfirm title="确认归档？" onConfirm={() => runAction.mutate({ id: r.id!, action: "archive" })}>
              <Button size="small">归档</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除？" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => runAction.mutate({ id: r.id!, action: "delete" })}>
            <Button size="small" danger loading={runAction.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total: entriesQuery.data?.meta.total ?? 0,
    showSizeChanger: true,
    onChange: (p, ps) => {
      updateParam("page", p > 1 ? String(p) : null);
      if (ps !== pageSize) updateParam("pageSize", String(ps));
    },
  };

  return (
    <div>
      {messageHolder}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          内容管理
        </Title>
        <Space>
          <Select
            placeholder="选择内容类型"
            style={{ width: 220 }}
            value={contentTypeId || undefined}
            onChange={(v) => updateParam("contentType", v)}
            options={(contentTypes ?? []).map((c: ContentType) => ({
              value: c.id,
              label: `${c.displayName} (${c.uid})`,
            }))}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            value={status ?? undefined}
            onChange={(v) => updateParam("status", v ?? null)}
            options={[
              { value: "draft", label: "草稿" },
              { value: "published", label: "已发布" },
              { value: "archived", label: "已归档" },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!contentTypeId}
            onClick={() => navigate(`/entries/new?contentType=${contentTypeId}`)}
          >
            新建内容
          </Button>
        </Space>
      </div>
      {!contentTypeId ? (
        <Typography.Text type="secondary">请先选择一个内容类型。</Typography.Text>
      ) : (
        <Table<Entry>
          rowKey="id"
          columns={columns}
          dataSource={entriesQuery.data?.items ?? []}
          loading={entriesQuery.isLoading}
          pagination={pagination}
        />
      )}
    </div>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case "publish":
      return "发布";
    case "unpublish":
      return "撤回";
    case "archive":
      return "归档";
    case "delete":
      return "删除";
    default:
      return "操作";
  }
}
