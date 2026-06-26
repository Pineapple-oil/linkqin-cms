import { Card, Result } from "antd";

/** 未实现的 MVP 页面占位，避免空路由。 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card>
      <Result
        status="info"
        title={title}
        subTitle="该模块将在后续 Phase 实现。Phase 0 仅交付工程骨架。"
      />
    </Card>
  );
}
