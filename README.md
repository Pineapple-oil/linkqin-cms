# linkqin-cms

轻量级、插件化、API-first 的 Node.js Headless CMS。

> 本仓库当前处于 **Phase 0：工程骨架**。详细背景、架构、领域模型、API 规范、插件系统、权限模型、开发路线图见 [`docs/PROJECT_DEVELOPMENT_GUIDE.md`](./docs/PROJECT_DEVELOPMENT_GUIDE.md)。

## 技术栈

- **Monorepo**：pnpm workspace + TypeScript strict
- **后端**：NestJS + Fastify Adapter + Drizzle ORM + PostgreSQL
- **后台**：React + Vite + Ant Design + TanStack Query
- **校验**：Zod
- **质量**：ESLint + Prettier + Vitest
- **依赖服务**：PostgreSQL（必需）、Redis（可选）

## 目录结构

```
apps/
  api/        # NestJS + Fastify 后端服务
  admin/      # React + Vite 后台管理端
packages/
  shared/     # 通用类型、错误码、Zod schema、API DTO
  core/       # CMS 核心领域模型、字段注册表、内容引擎、插件宿主
  db/         # Drizzle schema、migration、数据库访问
  plugin-sdk/ # 插件开发 SDK
plugins/      # 官方插件（Phase 5+）
docs/         # 项目开发文档、ADR、API
```

## 环境要求

- Node.js ≥ 22（LTS 推荐）
- pnpm ≥ 9（仓库已指定 `pnpm@11.8.0`）
- Docker（用于本地 PostgreSQL/Redis）

## 本地启动

```bash
# 1. 安装依赖
pnpm install

# 2. 启动数据库（PostgreSQL + Redis）
docker compose up -d

# 3. 配置环境变量
cp .env.example .env
#   生成 JWT 密钥：openssl rand -hex 32

# 4. 生成并执行数据库迁移（需要 DATABASE_URL 指向运行中的 Postgres）
pnpm db:generate
pnpm db:migrate

# 5. 同时启动 API（:3000）和 Admin（:5173）
pnpm dev
```

启动后：

- API 健康检查：http://localhost:3000/api/health
- 后台管理端：http://localhost:5173

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动所有 app 和 package 的 watch/dev |
| `pnpm build` | 构建所有 package 和 app |
| `pnpm lint` | 全仓库 ESLint |
| `pnpm typecheck` | 全仓库类型检查 |
| `pnpm test` | 运行所有单元 / 集成测试（Vitest） |
| `pnpm format` | Prettier 格式化 |
| `pnpm db:generate` | 由 Drizzle schema 生成迁移 |
| `pnpm db:migrate` | 执行数据库迁移 |

## 开发规则摘要（AI agent 与人类开发者必读）

摘自开发文档第 14 节，关键约束：

1. 先读 `docs/PROJECT_DEVELOPMENT_GUIDE.md`，再动代码。
2. 按垂直切片开发，不要一次实现多个大模块。
3. 后台 UI 不得直接拼后端内部字段，必须通过 `@linkqin/shared` 的类型和 API client。
4. 插件只能依赖 `@linkqin/plugin-sdk`，不得 import `apps/api` 或 `apps/admin` 内部代码；核心模块不得依赖具体插件。
5. 动态内容字段必须走字段注册表和 Zod schema，禁止字符串拼接校验。
6. 所有错误使用统一错误码（`@linkqin/shared` 的 `ERROR_CODES`）。
7. 所有数据写入接口必须写 audit log。

## 路线图

- ✅ **Phase 0**：工程初始化（当前）
- ⬜ **Phase 1**：认证和基础后台（用户、角色、权限、JWT）
- ⬜ **Phase 2**：内容类型和字段系统
- ⬜ **Phase 3**：内容 Entry 管理（草稿/发布/版本）
- ⬜ **Phase 4**：媒体库
- ⬜ **Phase 5**：插件系统 MVP
- ⬜ **Phase 6**：发布集成（Webhook、API token、OpenAPI）
