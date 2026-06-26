import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "../layouts/AdminLayout.js";
import { DashboardPage } from "../pages/dashboard/DashboardPage.js";
import { PlaceholderPage } from "../pages/PlaceholderPage.js";

/**
 * 后台路由表。
 * 对应开发文档 12 的 MVP 页面，Phase 0 多数为占位。
 */
export function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="content-types" element={<PlaceholderPage title="内容类型" />} />
        <Route path="entries" element={<PlaceholderPage title="内容管理" />} />
        <Route path="assets" element={<PlaceholderPage title="媒体库" />} />
        <Route path="users" element={<PlaceholderPage title="用户和角色" />} />
        <Route path="plugins" element={<PlaceholderPage title="插件中心" />} />
        <Route path="settings" element={<PlaceholderPage title="系统设置" />} />
        <Route path="*" element={<PlaceholderPage title="页面未找到" />} />
      </Route>
    </Routes>
  );
}
