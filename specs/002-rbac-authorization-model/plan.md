# Implementation Plan: RBAC Authorization Model (S1-2)

**Branch**: `002-rbac-authorization-model` | **Date**: 2025-02-11 | **Spec**: [spec.md](./spec.md)

## Summary

S1-2 切片实现 AgentifUI 的 RBAC 授权模型，包括三级 RBAC 角色（ROOT ADMIN/Tenant Admin/User）、Group级 Manager（通过 GroupMember.role 判定）、权限判定引擎（50ms P95）、多群组权限合并、Break-glass 紧急访问机制。系统基于 Redis 缓存 + Pub/Sub 实现权限变更即时生效（≤5s），并通过 Drizzle ORM 在 PostgreSQL 18 中存储角色、权限、授权数据。

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode)
**Primary Dependencies**:
- Backend: Fastify 5.x, Drizzle ORM, better-auth
- Frontend: Next.js 16, React 19, Zustand, TanStack Query
- Database: PostgreSQL 18 (primary), Redis 7.x (cache/sessions)

**Storage**:
- PostgreSQL 18: roles, permissions, role_permissions, user_roles, app_grants
- Redis 7.x: permission cache (TTL 5s), Pub/Sub invalidation

**Testing**:
- Unit: Vitest
- E2E: Playwright
- Performance: k6 or Apache Bench (P95 ≤ 50ms verification)

**Target Platform**: Node.js 22.x LTS, modern browsers (ES2022+)

**Project Type**: Monorepo (pnpm workspace) - web application

**Performance Goals**:
- 权限判�� P95 ≤ 50ms
- 权限变更 ≤ 5s 全平台生效
- 群组切换响应 ≤ 300ms

**Constraints**:
- Manager 不是 Role 表实体，通过 GroupMember.role 判定
- ROOT ADMIN 默认关闭，需环境变量启用
- Deny 优先级最高，无自动过期
- 最后一个 Tenant Admin 不可降级或删除

**Scale/Scope**:
- 预置角色：3 个（root_admin, tenant_admin, user）
- 核心权限：9 个
- API 端点：~15 个
- 单 Tenant 支持 ≥5 万用户

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

基于 `.specify.specify/memory/constitution.md` 的合规检查：

- [x] **切片驱动开发**：功能可端到端演示（角色分配→权限判定→授权创建→权限校验），切片契约已冻结
- [x] **MVP 优先**：优先实现核心权限判定引擎（P1），Break-glass 和智能上下文切换为 P2
- [x] **TypeScript 全栈**：严格类型检查，共享类型定义在 `@agentifui/shared`
- [x] **可观测性优先**：Trace ID 贯穿全链路，所有授权操作记录审计日志
- [x] **多租户原生**：UserRole 包含 tenantId，数据按租户隔离
- [x] **统一接口网关**：API 契约符合 RESTful 规范，前端通过网关调用
- [x] **技术栈锁定**：遵循 Fastify 5.x + Drizzle ORM + PostgreSQL 18 选型
- [x] **目录结构规范**：apps/api/src/modules/rbac/ 符合模块化组织原则

## Project Structure

### Documentation (this feature)

```text
specs/002-rbac-authorization-model/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
├── quickstart.md        # Phase 1 output ✅
├── contracts/           # Phase 1 output ✅
│   └── rbac-api.md      # API 契约
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── web/                 # Next.js 16 + React 19 frontend
│   └── src/
│       ├── features/
│       │   └── rbac/           # RBAC 前端模块
│       │       ├── hooks/      # usePermission, useActiveGroup
│       │       ├── stores/     # rbac store (Zustand)
│       │       └── components/ # GroupSwitcher, PermissionGate
│       └── lib/
│           └── api/           # API client (TanStack Query)
│
├── api/                 # Fastify 5.x backend service
│   └── src/
│       ├── modules/
│       │   └── rbac/           # RBAC 后端模块
│       │       ├── routes/     # API routes
│       │       ├── services/   # permission service
│       │       ├── repositories/ # data access
│       │       └── plugins/    # Fastify plugins
│       └── plugins/
│           └── auth.ts        # better-auth integration
│
└── worker/              # BullMQ background worker
    └── src/
        └── jobs/
            └── rbac/           # 过期记录清理

packages/
├── shared/              # Shared TypeScript types
│   └── src/
│       └── rbac/        # RBAC shared types
│           ├── role.ts
│           ├── permission.ts
│           └── grant.ts
│
└── db/                  # Drizzle ORM schemas
    └── src/
        └── schema/
            └── rbac.ts  # Role, Permission, UserRole, AppGrant
```

**Structure Decision**: Monorepo with apps (web/api/worker) and packages (shared/db/ui)。后端采用 Controller → Service → Repository 分层，前端使用 features 模块化组织。

## Complexity Tracking

> **No violations requiring justification**

---

## Phase 0: Research ✅

**Output**: [research.md](./research.md)

| Unknown | Decision | Rationale |
|---------|----------|-----------|
| 权限判定引擎架构 | 实时判定 + Redis 缓存 + Pub/Sub 失效 | 平衡性能（50ms P95）与一致性（≤5s 生效） |
| 多群组权限合并 | 访问权限并集（OR），配额归因 Active Group | 符合最小权限原则，支持成本追踪 |
| Manager 角色模型 | GroupMember.role='manager' 判定 | 简化模型，避免冗余数据 |
| Break-glass 实现 | 临时角色提升 + Critical 审计 | 环境变量启用，指定 Tenant 范围可控 |
| Deny 实现 | AppGrant.permission='deny' | 最高优先级，手动撤销 |

---

## Phase 1: Design & Contracts ✅

### 1.1 Data Model

**Output**: [data-model.md](./data-model.md)

**Entities Created**:
- `roles`: RBAC 角色定义（3 个预置角色）
- `permissions`: 权限定义（9 个核心权限）
- `role_permissions`: 角色-权限关联
- `user_roles`: 用户-角色关联（支持临时角色）
- `app_grants`: 应用授权记录（支持群组/用户、use/deny）

**Integration with S1-1**:
- `User`: 通过 UserRole 关联 Role
- `GroupMember`: 使用 role 字段判定 Manager
- `Tenant`: UserRole 的租户范围
- `AuditEvent`: 新增 10 个审计事件类型

### 1.2 API Contracts

**Output**: [contracts/rbac-api.md](./contracts/rbac-api.md)

**API Endpoints** (15 个):
- **角色管理**: GET /roles, GET /roles/{id}
- **权限判定**: POST /permissions/check, POST /permissions/check-batch
- **授权管理**: POST /grants, GET /grants, DELETE /grants/{id}
- **用户角色**: POST /users/{id}/roles, DELETE /users/{id}/roles/{roleId}
- **Break-glass**: POST /breakglass/activate, GET /breakglass/status
- **应用可见性**: GET /apps/accessible, GET /apps/{id}/context-options
- **通知**: GET /notifications/unread-count, GET /notifications/breakglass

### 1.3 Quickstart Guide

**Output**: [quickstart.md](./quickstart.md)

**Developer Setup**:
- 数据库迁移命令
- 种子数据加载
- 开发服务器启动
- 本地验证步骤

---

## Phase 2: Implementation (NOT in scope for /speckit.plan)

**Next Command**: `/speckit.tasks` to generate actionable task list

---

## Re-evaluated Constitution Check (Post-Design)

- [x] **切片驱动开发**：设计完整，可端到端演示
- [x] **MVP 优先**：P1 功能（权限判定、群组授权）优先，P2（Break-glass）可延后
- [x] **TypeScript 全栈**：shared types 定义完整
- [x] **可观测性优先**：审计事件 100% 覆盖，Trace ID 设计
- [x] **多租户原生**：UserRole.tenantId 确保租户隔离
- [x] **统一接口网关**：RESTful API，OpenAPI 规范
- [x] **技术栈锁定**：Fastify + Drizzle + PostgreSQL
- [x] **目录结构规范**：模块化组织，依赖方向正确

---

*本文档基于 .specify/templates/plan-template.md 生成*
