# API 文档

本目录记录 REST API 契约与 OpenAPI 片段。

Phase 0 仅交付健康检查：

- `GET /api/health` → `{ data: { status, service, uptime, timestamp } }`
- `GET /api/health/live` → `{ data: { status: "alive" } }`

后续 Phase 按 `docs/PROJECT_DEVELOPMENT_GUIDE.md` 第 7 节补全：

- `/api/admin/*`：后台管理接口
- `/api/content/*`：公开内容消费接口
- `/api/auth/*`、`/api/assets/*`、`/api/webhooks/*`、`/api/plugins/*`

统一响应格式见开发文档 7.2 节。
