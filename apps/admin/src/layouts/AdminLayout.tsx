import { useSyncExternalStore } from "react";
import { Button, Layout, Menu, Space, theme, Typography } from "antd";
import {
  AppstoreOutlined,
  DashboardOutlined,
  FileImageOutlined,
  ApiOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../api/auth.js";
import { authStore } from "../stores/auth.js";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: "/", icon: <DashboardOutlined />, label: "仪表盘" },
  { key: "/content-types", icon: <AppstoreOutlined />, label: "内容类型" },
  { key: "/assets", icon: <FileImageOutlined />, label: "媒体库" },
  { key: "/users", icon: <TeamOutlined />, label: "用户和角色" },
  { key: "/plugins", icon: <ApiOutlined />, label: "插件中心" },
  { key: "/settings", icon: <SettingOutlined />, label: "系统设置" },
];

function useCurrentUserName(): string {
  return useSyncExternalStore(
    authStore.subscribe,
    () => authStore.getUser()?.displayName ?? authStore.getUser()?.username ?? "已登录用户",
    () => "已登录用户",
  );
}

/**
 * 后台主框架。
 * 菜单对应开发文档 12 的 MVP 页面（Phase 1+ 逐步实现）。
 */
export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const userName = useCurrentUserName();

  const selectedKey =
    menuItems.find((m) => m.key !== "/" && location.pathname.startsWith(m.key))?.key ??
    "/";

  async function onLogout() {
    try {
      await logout();
    } finally {
      authStore.clear();
      navigate("/login", { replace: true });
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsible style={{ background: token.colorBgContainer }}>
        <div
          style={{
            color: token.colorText,
            fontWeight: 700,
            fontSize: 18,
            padding: "16px 24px",
            whiteSpace: "nowrap",
          }}
        >
          linkqin CMS
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600 }}>管理后台</span>
          <Space>
            <Text type="secondary">{userName}</Text>
            <Button icon={<LogoutOutlined />} onClick={onLogout}>
              退出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
