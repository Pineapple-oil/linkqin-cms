import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { authStore } from "../../stores/auth.js";

const { Title, Paragraph } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

/** 登录页：Phase 1 最小后台入口。 */
export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: LoginFormValues) {
    setLoading(true);
    try {
      const data = await login(values);
      authStore.setAccessToken(data.accessToken);
      authStore.setUser(data.user);
      message.success("登录成功");
      navigate("/", { replace: true });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "登录失败";
      message.error(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        padding: 24,
      }}
    >
      <Card style={{ width: 380 }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 8 }}>
          linkqin CMS
        </Title>
        <Paragraph type="secondary" style={{ textAlign: "center", marginBottom: 24 }}>
          管理后台登录
        </Paragraph>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button block type="primary" htmlType="submit" loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
