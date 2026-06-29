import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FieldDefinition } from "@linkqin/shared";
import { getContentType } from "../../api/content-types.js";
import {
  createEntry,
  getEntry,
  listEntryVersions,
  publishEntry,
  unpublishEntry,
  updateEntry,
} from "../../api/entries.js";
import { ApiError } from "../../api/client.js";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const statusColor: Record<string, string> = {
  draft: "default",
  published: "green",
  archived: "orange",
};

/**
 * 内容编辑页：按 contentType.fields 动态渲染填值控件 + slug + 状态操作 + 版本历史。
 * - /entries/new?contentType=ID：新建。
 * - /entries/:id：编辑。
 */
export function EntryEditPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [versionOpen, setVersionOpen] = useState(false);

  const contentTypeId = isEdit ? null : searchParams.get("contentType");

  const ctQuery = useQuery({
    queryKey: ["content-type-for-entry", isEdit ? id : contentTypeId],
    queryFn: () => getContentType(isEdit ? id! : contentTypeId!),
    enabled: Boolean(isEdit ? id : contentTypeId),
  });
  const contentType = ctQuery.data;

  const entryQuery = useQuery({
    queryKey: ["entry", id],
    queryFn: () => getEntry(id!),
    enabled: isEdit,
  });

  // 编辑模式回填。
  useEffect(() => {
    if (entryQuery.data) {
      form.setFieldsValue({ ...entryQuery.data.data, slug: entryQuery.data.slug });
    }
  }, [entryQuery.data, form]);

  const versionsQuery = useQuery({
    queryKey: ["entry-versions", id],
    queryFn: () => listEntryVersions(id!),
    enabled: isEdit && versionOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const slug = (values.slug as string | undefined) || undefined;
      const data = stripMeta(values);
      if (isEdit && id) {
        return updateEntry(id, { data, slug });
      }
      return createEntry({ contentTypeId: contentTypeId!, data, slug });
    },
    onSuccess: (entry) => {
      messageApi.success(isEdit ? "已保存" : "已创建");
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      if (!isEdit) navigate(`/entries/${entry.id}`, { replace: true });
    },
    onError: (err) => {
      messageApi.error(err instanceof ApiError ? err.message : "保存失败");
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishEntry(id!),
    onSuccess: () => {
      messageApi.success("已发布");
      queryClient.invalidateQueries({ queryKey: ["entry", id] });
    },
    onError: (err) => messageApi.error(err instanceof ApiError ? err.message : "发布失败"),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishEntry(id!),
    onSuccess: () => {
      messageApi.success("已撤回");
      queryClient.invalidateQueries({ queryKey: ["entry", id] });
    },
    onError: (err) => messageApi.error(err instanceof ApiError ? err.message : "撤回失败"),
  });

  const fields = contentType?.fields ?? [];

  async function onSubmit() {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    saveMutation.mutate(values);
  }

  if (ctQuery.isLoading || (isEdit && entryQuery.isLoading)) {
    return <Paragraph>加载中…</Paragraph>;
  }
  if (!contentType) {
    return <Paragraph type="danger">内容类型不存在。</Paragraph>;
  }

  return (
    <div>
      {messageHolder}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Space align="center">
          <Title level={3} style={{ margin: 0 }}>
            {isEdit ? "编辑内容" : "新建内容"}
          </Title>
          {isEdit && entryQuery.data && (
            <Tag color={statusColor[entryQuery.data.status]}>
              {entryQuery.data.status} · v{entryQuery.data.version}
            </Tag>
          )}
        </Space>
        <Space>
          {isEdit && (
            <>
              <Button onClick={() => setVersionOpen(true)}>版本历史</Button>
              {entryQuery.data?.status !== "published" ? (
                <Popconfirm title="确认发布？" onConfirm={() => publishMutation.mutate()}>
                  <Button type="primary" loading={publishMutation.isPending}>
                    发布
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm title="确认撤回？" onConfirm={() => unpublishMutation.mutate()}>
                  <Button loading={unpublishMutation.isPending}>撤回</Button>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      </div>

      <Card title={`${contentType.displayName} (${contentType.uid})`}>
        <Form form={form} layout="vertical">
          <Form.Item name="slug" label="Slug" rules={[{ pattern: /^[a-z0-9-]*$/, message: "slug 仅允许小写字母、数字、连字符" }]}>
            <Input placeholder="my-article" />
          </Form.Item>

          {fields.map((field) => (
            <FieldInput key={field.name} field={field} />
          ))}

          <Space style={{ marginTop: 8 }}>
            <Button onClick={() => navigate("/entries")}>取消</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={onSubmit}>
              {isEdit ? "保存" : "创建"}
            </Button>
          </Space>
        </Form>
      </Card>

      <Drawer title="版本历史" open={versionOpen} onClose={() => setVersionOpen(false)} width={520}>
        <Table
          rowKey="id"
          size="small"
          dataSource={versionsQuery.data ?? []}
          loading={versionsQuery.isLoading}
          pagination={false}
          columns={[
            { title: "版本", dataIndex: "version", key: "version", width: 60 },
            {
              title: "动作",
              dataIndex: "note",
              key: "note",
              width: 100,
              render: (n: string) => n ?? "-",
            },
            {
              title: "时间",
              dataIndex: "createdAt",
              key: "createdAt",
              render: (v: string) => new Date(v).toLocaleString("zh-CN"),
            },
          ]}
        />
      </Drawer>
    </div>
  );
}

/** 单个字段的动态输入控件（按 type 渲染）。 */
function FieldInput({ field }: { field: FieldDefinition }) {
  const label = field.required ? `${field.label} *` : field.label;
  switch (field.type) {
    case "textarea":
    case "richText":
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <TextArea rows={4} />
        </Form.Item>
      );
    case "number":
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
      );
    case "boolean":
      return (
        <Form.Item name={field.name} label={label} valuePropName="checked">
          <Switch />
        </Form.Item>
      );
    case "date":
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
      );
    case "select":
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <Select
            options={(field.settings?.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            allowClear={!field.required}
          />
        </Form.Item>
      );
    case "multiSelect":
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <Select
            mode="multiple"
            options={(field.settings?.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            allowClear={!field.required}
          />
        </Form.Item>
      );
    case "json":
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <TextArea rows={6} placeholder='{"key":"value"}' />
        </Form.Item>
      );
    default:
      // text / slug / media / relation / component / componentList：文本输入。
      return (
        <Form.Item name={field.name} label={label} rules={field.required ? [{ required: true }] : []}>
          <Input />
        </Form.Item>
      );
  }
}

/** 去掉 slug 等 meta 字段，只留 data。 */
function stripMeta(values: Record<string, unknown>): Record<string, unknown> {
  const { slug: _slug, ...data } = values;
  void _slug;
  return data;
}
