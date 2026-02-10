# AgentifUI Spec-Kit 骨架要求

* **版本**：v0.1
* **最后更新**：2026-01-27
* **状态**：待确认
* **依赖**：REPO_STRUCTURE.md, TECHNOLOGY_STACK.md, GATEWAY_CONTRACT_P1.md

---

## 1. 概述

本文档定义 Phase 1-D spec-kit（项目骨架）的生成要求。骨架不是空项目，而是 **能跑通最小链路的 "Hello World+"**。

---

## 2. 仓库信息

| 属性 | 值 |
|------|-----|
| **仓库名称** | `agentifui` |
| **仓库路径** | `/Users/zen/Github/agentifui` |
| **仓库类型** | pnpm Monorepo + Turborepo |

---

## 3. 包结构

```
agentifui/
├── apps/
│   ├── web/              # @agentifui/web - Next.js 15 前端
│   ├── api/              # @agentifui/api - Fastify 5 后端
│   └── worker/           # @agentifui/worker - BullMQ Worker
├── packages/
│   ├── shared/           # @agentifui/shared - 共享类型与常量
│   ├── ui/               # @agentifui/ui - shadcn/ui 组件库
│   └── db/               # @agentifui/db - Drizzle Schema
├── docker/
│   └── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 4. 骨架内容清单

### 4.1 前端 (`apps/web`)

| 内容 | 说明 | 状态 |
|------|------|------|
| **基础路由** | /login, /apps, /chat/[id], /admin | 🔲 |
| **Auth Wrapper** | 登录态检查 + 未登录跳转 | 🔲 |
| **API Client** | 统一请求封装 + 错误拦截 + Trace ID 注入 | 🔲 |
| **布局组件** | Header, Sidebar, MainLayout | 🔲 |
| **Mock 登录** | 模拟登录状态，便于开发 | 🔲 |

**技术栈**：Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui + Zustand

### 4.2 后端 (`apps/api`)

| 内容 | 说明 | 状态 |
|------|------|------|
| **Fastify 初始化** | 基础配置 + 插件注册 | 🔲 |
| **健康检查** | GET /health | 🔲 |
| **Auth Stub** | POST /api/v1/auth/login (Mock) | 🔲 |
| **OpenAI 兼容 Stub** | POST /api/v1/chat/completions (Mock SSE) | 🔲 |
| **Trace 插件** | 请求注入 Trace ID | 🔲 |
| **错误处理** | 统一错误格式 | 🔲 |
| **CORS 配置** | 开发环境允许 localhost | 🔲 |

**技术栈**：Fastify 5 + TypeScript + Pino + OpenTelemetry

### 4.3 数据库 (`packages/db`)

| 内容 | 说明 | 状态 |
|------|------|------|
| **Drizzle 配置** | drizzle.config.ts | 🔲 |
| **核心 Schema** | Tenant, User, Group, App (最小字段) | 🔲 |
| **迁移脚本** | 0001_initial.sql | 🔲 |
| **客户端导出** | db client + schema 导出 | 🔲 |

**技术栈**：Drizzle ORM + PostgreSQL

### 4.4 共享包 (`packages/shared`)

| 内容 | 说明 | 状态 |
|------|------|------|
| **类型定义** | User, Conversation, Message 类型 | 🔲 |
| **常量** | 角色、状态枚举 | 🔲 |
| **工具函数** | 格式化、验证 | 🔲 |

### 4.5 UI 包 (`packages/ui`)

| 内容 | 说明 | 状态 |
|------|------|------|
| **shadcn/ui 初始化** | 基础配置 | 🔲 |
| **核心组件** | Button, Input, Dialog, Card | 🔲 |
| **主题配置** | CSS 变量 + Dark Mode | 🔲 |

### 4.6 基础设施

| 内容 | 说明 | 状态 |
|------|------|------|
| **Docker Compose** | PostgreSQL + Redis | 🔲 |
| **ESLint 配置** | 统一代码规范 | 🔲 |
| **Prettier 配置** | 格式化规则 | 🔲 |
| **TypeScript 配置** | 基础 + 路径别名 | 🔲 |
| **环境变量模板** | .env.example | 🔲 |

---

## 5. 验收标准

骨架生成后必须满足：

| # | 验收条目 | 命令 |
|---|----------|------|
| 1 | 依赖安装成功 | `pnpm install` |
| 2 | 类型检查通过 | `pnpm type-check` |
| 3 | Lint 检查通过 | `pnpm lint` |
| 4 | 前端启动成功 | `pnpm dev --filter @agentifui/web` |
| 5 | 后端启动成功 | `pnpm dev --filter @agentifui/api` |
| 6 | 健康检查响应 | `curl localhost:3001/health` → 200 |
| 7 | Mock 登录可用 | 前端 /login 页面可操作 |
| 8 | Mock 对话可用 | 前端 /chat 页面显示 Mock 响应 |

---

## 6. 不包含（Out of Scope）

以下内容 **不在骨架范围内**，将在后续 FRD 实现：

- ❌ 真实认证逻辑（better-auth 集成）
- ❌ 真实数据库连接（仅 Schema 定义）
- ❌ 真实 AI 对话（仅 Mock SSE）
- ❌ 权限检查逻辑
- ❌ 审计日志
- ❌ Worker 任务

---

## 7. 生成命令预览

```bash
# 1. 创建仓库目录
mkdir -p /Users/zen/Github/agentifui
cd /Users/zen/Github/agentifui

# 2. 初始化 pnpm workspace
pnpm init

# 3. 创建 workspace 配置
# pnpm-workspace.yaml, turbo.json, tsconfig.base.json

# 4. 创建各包结构
# apps/web, apps/api, packages/db, packages/shared, packages/ui

# 5. 安装依赖并启动
pnpm install
pnpm dev
```

---

## 8. 确认清单

请确认以下事项：

- [ ] 仓库路径：`/Users/zen/Github/agentifui`
- [ ] 技术栈：Next.js 15 + Fastify 5 + Drizzle + shadcn/ui
- [ ] 包管理：pnpm + Turborepo
- [ ] 数据库：PostgreSQL（Docker Compose）
- [ ] 骨架范围：Mock 实现，可运行但无真实业务逻辑

---

*待确认后开始生成代码*
