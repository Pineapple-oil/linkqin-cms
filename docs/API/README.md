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

## Phase 2：内容类型管理

`/api/admin/content-types` 下的 CRUD，均需登录；按动作分别要求
`content-type:read|create|update|delete` 权限（`super_admin` 短路放行）。

### `GET /api/admin/content-types`

返回所有内容类型数组：

```json
{
  "data": [
    {
      "id": "uuid",
      "uid": "article",
      "kind": "collection",
      "displayName": "文章",
      "description": null,
      "fields": [{ "name": "title", "type": "text", "label": "标题", "required": true, "localized": false, "unique": false }],
      "options": { "draftAndPublish": true, "versions": true, "localized": false, "sortable": false },
      "schemaVersion": 1,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": { "requestId": "req_xxx" }
}
```

### `GET /api/admin/content-types/:id`

返回单个内容类型（同上结构）。不存在返回 `CONTENT_TYPE_NOT_FOUND`（404）。

### `POST /api/admin/content-types`

请求（`uid` 必填、kebab-case；`kind` 必填、`collection|single|component`；
`fields` 可选，默认 `[]`）：

```json
{ "uid": "article", "kind": "collection", "displayName": "文章", "fields": [] }
```

错误：`uid` 重复 → `CONTENT_TYPE_UID_DUPLICATE`（409）；
字段定义非法（name 非 camelCase、type 不存在等）→ `CONTENT_TYPE_FIELD_INVALID`（400）。

### `PATCH /api/admin/content-types/:id`

可更新 `displayName`/`description`/`fields`/`options`（`uid`/`kind` 不可改）。
字段结构变化时自动升 `schemaVersion`。

### `DELETE /api/admin/content-types/:id`

删前检查 entries：若该内容类型下存在条目，返回 `CONTENT_TYPE_HAS_ENTRIES`（409）。

## Phase 3：内容 Entry 管理

### `/api/admin/entries`（需登录 + `entry:*` 权限）

- `GET /api/admin/entries?contentType=&status=&locale=&page=&pageSize=&sort=`：分页列表。
  `sort` 形如 `-publishedAt`（前缀 `-` 表降序，字段：`publishedAt`/`updatedAt`/`createdAt`）。
- `GET /api/admin/entries/:id`：单条（含 draft `data` 与 `publishedData`）。
- `POST /api/admin/entries`：创建草稿。请求 `{ contentTypeId, data, slug?, locale? }`。
  内容类型不存在→`CONTENT_TYPE_NOT_FOUND`(404)；内容校验失败→`VALIDATION_ERROR`(400)。
- `PATCH /api/admin/entries/:id`：更新草稿 data/slug，`version` 自增并写版本记录。
- `DELETE /api/admin/entries/:id`：删除。
- `POST /api/admin/entries/:id/publish`：发布，把 `data` 快照到 `publishedData`（支持「已发布→重新发布」）。
- `POST /api/admin/entries/:id/unpublish`：撤回，清空 `publishedData`。
- `POST /api/admin/entries/:id/archive`：归档（保留快照以便恢复）。
- `GET /api/admin/entries/:id/versions`：版本历史。

草稿/发布隔离（开发文档 §10）：编辑只改 `data`；公开 API 只读 `publishedData`。重新发布才更新快照。

### `/api/content/*`（公开，无需登录）

公开接口默认只返回 `status=published` 的内容，且输出 `publishedData`（非草稿 `data`）。

- `GET /api/content/:contentType?page=&pageSize=&locale=&sort=`：列表。
- `GET /api/content/:contentType/:idOrSlug`：按 id 或 slug 取单条。
- `GET /api/content/single/:contentType`：取 single 类型的已发布内容。

响应为分页格式（开发文档 7.2），`data` 元素形态：`{ id, slug, title, locale, data(=publishedData), publishedAt }`。

## 后续 Phase

按 `docs/PROJECT_DEVELOPMENT_GUIDE.md` 第 7 节补全：

- `/api/admin/*`：媒体、用户/角色管理
- `/api/content/*`：filter/fields/populate DSL、navigation/search（Phase 6）
- `/api/assets/*`、`/api/webhooks/*`、`/api/plugins/*`
