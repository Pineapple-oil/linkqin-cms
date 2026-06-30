import { Route, Routes } from "react-router-dom";
import { AssetLibraryPage } from "../pages/assets/AssetLibraryPage.js";
import { AdminLayout } from "../layouts/AdminLayout.js";
import { ContentTypeEditorPage } from "../pages/content-types/ContentTypeEditorPage.js";
import { ContentTypeListPage } from "../pages/content-types/ContentTypeListPage.js";
import { DashboardPage } from "../pages/dashboard/DashboardPage.js";
import { EntryEditPage } from "../pages/entries/EntryEditPage.js";
import { EntryListPage } from "../pages/entries/EntryListPage.js";
import { LoginPage } from "../pages/login/LoginPage.js";
import { PlaceholderPage } from "../pages/PlaceholderPage.js";
import { PluginCenterPage } from "../pages/plugins/PluginCenterPage.js";
import { RequireAuth } from "./RequireAuth.js";

/**
 * 后台路由表。
 * /login 为公开路由；其余后台路由通过 RequireAuth 保护。
 */
export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="content-types" element={<ContentTypeListPage />} />
          <Route path="content-types/new" element={<ContentTypeEditorPage />} />
          <Route path="content-types/:id" element={<ContentTypeEditorPage />} />
          <Route path="entries" element={<EntryListPage />} />
          <Route path="entries/new" element={<EntryEditPage />} />
          <Route path="entries/:id" element={<EntryEditPage />} />
          <Route path="assets" element={<AssetLibraryPage />} />
          <Route path="users" element={<PlaceholderPage title="用户和角色" />} />
          <Route path="plugins" element={<PluginCenterPage />} />
          <Route path="settings" element={<PlaceholderPage title="系统设置" />} />
          <Route path="*" element={<PlaceholderPage title="页面未找到" />} />
        </Route>
      </Route>
    </Routes>
  );
}
