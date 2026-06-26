import { Layout, Menu, theme } from "antd";
import {
  AppstoreOutlined,
  DashboardOutlined,
  FileImageOutlined,
  ApiOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/", icon: <DashboardOutlined />, label: "仪表盘" },
  { key: "/content-types", icon: <AppstoreOutlined />, label: "内容类型" },
  { key: "/assets", icon: <FileImageOutlined />, label: "媒体库" },
  { key: "/users", icon: <TeamOutlined />, label: "用户和角色" },
  { key: "/plugins", icon: <ApiOutlined />, label: "插件中心" },
  { key: "/settings", icon: <SettingOutlined />, label: "系统设置" },
];

/**
 * 后台主框架。
 * 菜单对应开发文档 12 的 MVP 页面（Phase 1+ 逐步实现）。
 */
export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const selectedKey =
    menuItems.find((m) => m.key !== "/" && location.pathname.startsWith(m.key))?.key ??
    "/";

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
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
