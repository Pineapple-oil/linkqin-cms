# API 文档

本目录记录 REST API 契约与 OpenAPI 片段。

## 通用响应格式

成功（开发文档 7.2）：

```json
{ "data": {}, "meta": { "requestId": "req_xxx" } }
```

失败：

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "未登录", "details": {} },
  "meta": { "requestId": "req_xxx" }
}
```

错误码与 HTTP 状态码的映射见 `@linkqin/shared` 的 `ERROR_CODES` 与 `httpStatusForCode`。

## Phase 0：健康检查

- `GET /api/health` → `{ data: { status, service, uptime, timestamp } }`
- `GET /api/health/live` → `{ data: { status: "alive" } }`

## Phase 1：认证与后台保护

### `POST /api/auth/login`

请求：

```json
{ "username": "admin", "password": "..." }
```

响应：

```json
{
  "data": {
    "accessToken": "jwt...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "displayName": "Super Admin",
      "roleKey": "super_admin",
      "permissions": ["*"]
    }
  },
  "meta": { "requestId": "req_xxx" }
}
```

副作用：设置 httpOnly cookie `linkqin_refresh`。refresh token 明文只在 cookie 中，
服务端存 SHA-256 哈希（`refresh_tokens` 表）。失败返回 `INVALID_CREDENTIALS`（401）。

### `POST /api/auth/refresh`

无需请求体，读取 `linkqin_refresh` cookie。轮换语义：旧 refresh token 立即撤销、
签发新的并写入 cookie，同时返回新 access token。响应结构同 login。

### `POST /api/auth/logout`

撤销当前 refresh token 并清除 cookie。返回 `{ data: { ok: true } }`。

### `GET /api/auth/me`

需 `Authorization: Bearer <accessToken>`。返回当前用户的 `AuthUser`：

```json
{ "data": { "id", "username", "displayName", "roleKey", "permissions": [] } }
```

### `GET /api/admin/whoami`

后台保护端点，需登录（JwtAuthGuard）。返回当前 `AuthUser`。

### `GET /api/admin/system`

需 `system:settings` 权限（PermissionsGuard + `@RequirePermissions`）。
`super_admin` 角色短路放行，其余角色无该权限返回 `FORBIDDEN`（403）。

## 后续 Phase

按 `docs/PROJECT_DEVELOPMENT_GUIDE.md` 第 7 节补全：

- `/api/admin/*`：内容类型、条目、媒体、用户/角色管理
- `/api/content/*`：公开内容消费接口
- `/api/assets/*`、`/api/webhooks/*`、`/api/plugins/*`
