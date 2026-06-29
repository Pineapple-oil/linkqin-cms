import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import {
  BUILTIN_FIELD_TYPES,
  CONTENT_TYPE_KINDS,
  type ContentType,
  type FieldDefinition,
} from "@linkqin/shared";
import {
  createContentType,
  getContentType,
  updateContentType,
} from "../../api/content-types.js";
import { ApiError } from "../../api/client.js";

const { Title } = Typography;
const { TextArea } = Input;

const kindColor: Record<string, string> = {
  collection: "blue",
  single: "green",
  component: "purple",
};

/** 新字段默认值（遵守 fieldDefinitionSchema 的默认）。 */
function makeField(index: number): FieldDefinition {
  return {
    name: `field${index}`,
    type: "text",
    label: "",
    required: false,
    localized: false,
    unique: false,
  };
}

interface BasicValues {
  uid: string;
  kind: ContentType["kind"];
  displayName: string;
  description?: string;
}

/**
 * 内容类型编辑器（开发文档 12 动态表单原型）：基本信息 + 字段配置。
 * - /content-types/new：创建。
 * - /content-types/:id：编辑（uid/kind 只读）。
 *
 * 提交时构造 fields 走 API；后端 Zod 校验非法字段配置 → 前端展示错误。
 */
export function ContentTypeEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageHolder] = message.useMessage();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [basicForm] = Form.useForm<BasicValues>();

  const { data, isLoading } = useQuery({
    queryKey: ["content-type", id],
    queryFn: () => getContentType(id!),
    enabled: isEdit,
  });

  // 编辑模式：首次加载后回填表单与字段。
  useEffect(() => {
    if (data) {
      basicForm.setFieldsValue({
        uid: data.uid,
        kind: data.kind,
        displayName: data.displayName,
        description: data.description,
      });
      setFields(data.fields);
    }
  }, [data, basicForm]);

  const saveMutation = useMutation({
    mutationFn: async (values: {
      basic: BasicValues;
      fields: FieldDefinition[];
    }) => {
      if (isEdit && id) {
        return updateContentType(id, {
          displayName: values.basic.displayName,
          description: values.basic.description,
          fields: values.fields,
        });
      }
      return createContentType({
        uid: values.basic.uid,
        kind: values.basic.kind,
        displayName: values.basic.displayName,
        description: values.basic.description,
        fields: values.fields,
      });
    },
    onSuccess: () => {
      messageApi.success(isEdit ? "已保存" : "已创建");
      void queryClient.invalidateQueries({ queryKey: ["content-types"] });
      navigate("/content-types");
    },
    onError: (err) => {
      messageApi.error(err instanceof ApiError ? err.message : "保存失败");
    },
  });

  function addField() {
    setFields((prev) => [...prev, makeField(prev.length + 1)]);
  }

  function updateField(rowKey: number, patch: Partial<FieldDefinition>) {
    setFields((prev) => prev.map((f, i) => (i === rowKey ? { ...f, ...patch } : f)));
  }

  function removeField(rowKey: number) {
    setFields((prev) => prev.filter((_, i) => i !== rowKey));
  }

  async function onSubmit() {
    let basic: BasicValues;
    try {
      basic = await basicForm.validateFields();
    } catch {
      return; // 表单校验失败由 AntD 自行提示。
    }
    saveMutation.mutate({ basic, fields });
  }

  const columns: ColumnsType<FieldDefinition & { __key: number }> = [
    {
      title: "字段名 (camelCase)",
      dataIndex: "name",
      width: 200,
      render: (val: string, _r, index) => (
        <Input
          value={val}
          placeholder="myField"
          onChange={(e) => updateField(index, { name: e.target.value })}
        />
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 160,
      render: (val: string, _r, index) => (
        <Select
          value={val}
          style={{ width: "100%" }}
          options={BUILTIN_FIELD_TYPES.map((t) => ({ value: t, label: t }))}
          onChange={(type) => updateField(index, { type: type as FieldDefinition["type"] })}
        />
      ),
    },
    {
      title: "标签",
      dataIndex: "label",
      render: (val: string, _r, index) => (
        <Input
          value={val}
          placeholder="显示名"
          onChange={(e) => updateField(index, { label: e.target.value })}
        />
      ),
    },
    {
      title: "必填",
      dataIndex: "required",
      width: 70,
      align: "center",
      render: (val: boolean, _r, index) => (
        <Switch checked={val} onChange={(required) => updateField(index, { required })} />
      ),
    },
    {
      title: "多语言",
      dataIndex: "localized",
      width: 80,
      align: "center",
      render: (val: boolean, _r, index) => (
        <Switch checked={val} onChange={(localized) => updateField(index, { localized })} />
      ),
    },
    {
      title: "唯一",
      dataIndex: "unique",
      width: 70,
      align: "center",
      render: (val: boolean, _r, index) => (
        <Switch checked={val} onChange={(unique) => updateField(index, { unique })} />
      ),
    },
    {
      title: "",
      key: "remove",
      width: 60,
      render: (_v, _r, index) => (
        <Popconfirm title="删除该字段？" onConfirm={() => removeField(index)} okText="删除" cancelText="取消">
          <Button type="text" danger icon={<MinusCircleOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const dataSource = fields.map((f, i) => ({ ...f, __key: i }));

  return (
    <div>
      {messageHolder}
      <Title level={3}>{isEdit ? "编辑内容类型" : "新建内容类型"}</Title>

      <Card title="基本信息" loading={isEdit && isLoading} style={{ marginBottom: 16 }}>
        <Form<BasicValues> form={basicForm} layout="vertical" initialValues={{ kind: "collection" }}>
          <Form.Item
            name="uid"
            label="UID (kebab-case)"
            rules={[
              { required: true, message: "请输入 uid" },
              { pattern: /^[a-z][a-z0-9-]*$/, message: "uid 必须是 kebab-case" },
            ]}
          >
            <Input placeholder="article" disabled={isEdit} />
          </Form.Item>
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              disabled={isEdit}
              options={CONTENT_TYPE_KINDS.map((k) => ({
                value: k,
                label: <Tag color={kindColor[k]}>{k}</Tag>,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名"
            rules={[{ required: true, message: "请输入显示名" }]}
          >
            <Input placeholder="文章" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="字段配置"
        extra={
          <Button icon={<PlusOutlined />} onClick={addField}>
            添加字段
          </Button>
        }
      >
        <Table
          rowKey="__key"
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          size="middle"
        />
      </Card>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Space>
          <Button onClick={() => navigate("/content-types")}>取消</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={onSubmit}>
            {isEdit ? "保存" : "创建"}
          </Button>
        </Space>
      </div>
    </div>
  );
}
