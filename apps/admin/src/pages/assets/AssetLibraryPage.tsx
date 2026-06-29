import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Spin,
  Typography,
  Upload,
  message,
} from "antd";
import { InboxOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { Asset } from "@linkqin/shared";
import { deleteAsset, listAssets, updateAsset, uploadAsset } from "../../api/assets.js";
import { ApiError } from "../../api/client.js";

const { Dragger } = Upload;
const { Title, Text } = Typography;

/**
 * 媒体库（开发文档 12）。
 * 拖拽/点击上传 + 网格展示（缩略图、文件名、尺寸）+ alt 编辑 + 删除。
 */
export function AssetLibraryPage() {
  const queryClient = useQueryClient();
  const [messageApi, messageHolder] = message.useMessage();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [editAlt, setEditAlt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["assets", page],
    queryFn: () => listAssets({ page, pageSize: 24 }),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAsset,
    onSuccess: () => {
      messageApi.success("上传成功");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err) => messageApi.error(err instanceof ApiError ? err.message : "上传失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      messageApi.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err) => messageApi.error(err instanceof ApiError ? err.message : "删除失败"),
  });

  const saveAltMutation = useMutation({
    mutationFn: (vars: { id: string; alt: string }) => updateAsset(vars.id, { alt: vars.alt }),
    onSuccess: () => {
      messageApi.success("已保存");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setEditing(null);
    },
    onError: (err) => messageApi.error(err instanceof ApiError ? err.message : "保存失败"),
  });

  // 自定义上传：走 uploadAsset（带 token），不经 AntD 默认 XHR。
  function customUpload(req: { file: unknown }) {
    uploadMutation.mutate(req.file as File);
  }

  return (
    <div>
      {messageHolder}
      <Title level={3} style={{ marginBottom: 16 }}>
        媒体库
      </Title>

      <Dragger
        accept="image/*"
        multiple={false}
        showUploadList={false}
        customRequest={customUpload}
        style={{ marginBottom: 16, padding: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽图片到此处上传</p>
        <p className="ant-upload-hint">支持图片，单文件不超过 10MB</p>
      </Dragger>

      {isLoading ? (
        <Spin />
      ) : (data?.items ?? []).length === 0 ? (
        <Empty description="暂无媒体" />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {(data?.items ?? []).map((asset) => (
            <Card
              key={asset.id}
              size="small"
              cover={
                asset.mimeType.startsWith("image/") ? (
                  <div style={{ height: 140, overflow: "hidden", background: "#fafafa" }}>
                    <img
                      src={asset.url}
                      alt={asset.alt ?? asset.filename}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Text type="secondary">{asset.mimeType}</Text>
                  </div>
                )
              }
              actions={[
                <EditOutlined
                  key="edit"
                  onClick={() => {
                    setEditing(asset);
                    setEditAlt(asset.alt ?? "");
                  }}
                />,
                <Popconfirm
                  key="delete"
                  title="确认删除？"
                  onConfirm={() => deleteMutation.mutate(asset.id!)}
                >
                  <DeleteOutlined />
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                title={<Text ellipsis style={{ maxWidth: 140 }}>{asset.filename}</Text>}
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {asset.width && asset.height ? `${asset.width}×${asset.height}` : `${asset.size}B`}
                    {asset.alt ? ` · ${asset.alt}` : ""}
                  </Text>
                }
              />
            </Card>
          ))}
        </div>
      )}

      {data && data.meta.total > data.meta.pageSize && (
        <Pagination
          style={{ marginTop: 16, textAlign: "right" }}
          current={page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          onChange={setPage}
        />
      )}

      <Modal
        title="编辑 Alt 文本"
        open={editing !== null}
        onOk={() => editing && saveAltMutation.mutate({ id: editing.id!, alt: editAlt })}
        onCancel={() => setEditing(null)}
        confirmLoading={saveAltMutation.isPending}
      >
        <Input
          value={editAlt}
          onChange={(e) => setEditAlt(e.target.value)}
          placeholder="用于无障碍与 SEO 的图片描述"
          maxLength={512}
        />
      </Modal>
    </div>
  );
}
