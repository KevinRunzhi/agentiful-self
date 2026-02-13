# Implementation Plan: Multi-Tenant Authentication Base (S1-1)

**Branch**: `1-multi-tenant-auth` | **Date**: 2025-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/1-multi-tenant-auth/spec.md`

## Summary

构建多租户身份认证基座，支持用户通过邀请链接、邮箱密码、SSO 登录系统，实现租户级数据隔离、��组组织管理、用户审核工作流、MFA 多因素认证等功能。这是所有后续功能的入口和基础。

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode)
**Primary Dependencies**:
- Frontend: Next.js 16, React 19, Zustand, shadcn/ui, Tailwind CSS v4
- Backend: Fastify 5.x, better-auth (latest), Drizzle ORM
- Auth: better-auth with email/password, OAuth2, OIDC, SAML providers
**Storage**: PostgreSQL 18 (primary), Redis 7.x (sessions/cache)
**Testing**: Vitest, Playwright (E2E), better-auth test utilities
**Target Platform**: Node.js 22.x LTS, modern browsers (ES2022+)
**Project Type**: web (monorepo with frontend + backend + shared packages)
**Performance Goals**: Login P95 ≤ 500ms, Permission check P95 ≤ 50ms, SSO domain detection ≤ 500ms
**Constraints**: Multi-tenant isolation at all levels, no cross-tenant data access
**Scale/Scope**: Support ≥50k users per tenant, ≥10k concurrent sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

基于 `.specify.specify/memory/constitution.md` 的合规检查：

- [x] **切片驱动开发**：6 个用户故事按优先级排序，每个可独立测试和交付。P1 切片（邀请登录+群组管理）完成后系统即可运行演示。
- [x] **MVP 优先**：P1 功能阻塞性优先（登录入口+群组授权），P2/P3 增强功能可延后。SSO 降级方案：服务不可用时显示邮箱密码登录。
- [x] **TypeScript 全栈**：前后端统一 TypeScript，共享类型定义在 `@agentifui/shared`，API 契约优先定义。
- [x] **可观测性优先**：Trace ID 贯穿网关→后端→审计事件，登录/登出/状态变更/Token 发放均记录审计日志。
- [x] **多租户原生**：所有业务表包含 `tenant_id`（User 除外，通过 UserRole.tenantId 关联），查询强制携带租户上下文。
- [x] **统一接口网关**：前端调用网关统一 API，网关负责鉴权、权限判定、配额检查、协议适配。
- [x] **技术栈锁定**：遵循 TECHNOLOGY_STACK.md 选型，better-auth 作为认证层提供者。
- [x] **目录结构规范**：遵循 Monorepo 结构，`apps/web/src/features/auth/`、`apps/api/src/modules/auth/` 模块化组织。

无违反宪章的设计，无需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/1-multi-tenant-auth/
├── plan.md              # This file
├── research.md          # Phase 0: Technical research and decisions
├── data-model.md        # Phase 1: Entity definitions and relationships
├── quickstart.md        # Phase 1: Developer quick start guide
├── contracts/           # Phase 1: API contracts
│   ├── auth-api.md      # Authentication endpoints
│   ├── user-api.md      # User management endpoints
│   ├── tenant-api.md    # Tenant configuration endpoints
│   └── sso-api.md       # SSO detection and endpoints
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/web/src/features/auth/
├── components/
│   ├── LoginForm.tsx           # Email/password login
│   ├── SSOButton.tsx           # SSO login buttons
│   ├── TenantSelector.tsx      # Workspace switcher for multi-tenant users
│   ├── PasswordResetForm.tsx   # Password reset flow
│   ├── MFASetupForm.tsx        # TOTP setup
│   ├── MFALoginForm.tsx        # TOTP verification
│   └── InviteAcceptForm.tsx    # Invite link password setup
├── hooks/
│   ├── useAuth.ts              # Auth state management
│   ├── useTenant.ts            # Tenant context management
│   └── useSSO.ts               # SSO domain detection
├── stores/
│   └── authStore.ts            # Zustand auth store
├── services/
│   └── authApi.ts              # Auth API client
└── types/
    └── auth.ts                 # Auth types (shared)

apps/api/src/modules/auth/
├── controllers/
│   ├── auth.controller.ts      # Login/logout/register
│   ├── user.controller.ts      # User profile management
│   ├── tenant.controller.ts    # Tenant configuration
│   ├── sso.controller.ts       # SSO detection and flow
│   └── mfa.controller.ts       # MFA setup/verification
├── services/
│   ├── auth.service.ts         # Core auth logic
│   ├── user.service.ts         # User CRUD operations
│   ├── tenant.service.ts       # Tenant management
│   ├── sso.service.ts          # SSO provider matching
│   ├── mfa.service.ts          # TOTP generation/verification
│   ├── invitation.service.ts   # Invite link generation/validation
│   └── audit.service.ts        # Audit logging
├── repositories/
│   ├── user.repository.ts
│   ├── tenant.repository.ts
│   ├── group.repository.ts
│   └── audit.repository.ts
└── routes/
    └── auth.routes.ts          # Fastify route definitions

packages/shared/src/types/
├── auth.ts                     # Shared auth types
├── user.ts                     # Shared user types
├── tenant.ts                   # Shared tenant types
└── audit.ts                    # Shared audit types
```

**Structure Decision**: Monorepo with pnpm workspace, following REPO_STRUCTURE.md. Feature modules organized by domain (auth), with clear separation between frontend (components, hooks, stores, services) and backend (controllers, services, repositories, routes). Shared types in `packages/shared` ensure type consistency across frontend/backend boundary.

## Slice Breakdown

按优先级实现的切片顺序：

### Slice 1: 邀请链接登录与多租户隔离 (P1)
**入口点**：Tenant Admin 邀请用户 → 用户收到邮件 → 点击链接设置密码 → 登录成功
**价值**：所有用户进入系统的唯一入口，多租户隔离基础
**验收**：用户可通过邀请链接完成注册并登录，租户数据完全隔离

### Slice 2: 群组组织与成员管理 (P1)
**入口点**：Tenant Admin 创建群组 → 添加成员 → 指派 Manager
**价值**：应用授权和配额分配的组织单元
**验收**：群组创建成功，成员关联正确，Manager 权限边界正确

### Slice 3: SSO 自动识别与 JIT 入驻 (P2)
**入口点**：用户输入企业邮箱 → 系统推荐 SSO → 完成 SSO 认证
**价值**：企业级场景核心体验，降低使用门槛
**验收**：SSO 域名识别 ≤ 500ms，JIT 用户创建成功

### Slice 4: 用户审核与状态管理 (P2)
**入口点**：Tenant Admin 开启审核 → 用户邀请加入待审核 → 审批通过/拒绝
**价值**：企业治理能力，控制谁能进入系统
**验收**：待审核用户仅能访问个人设置页，状态转换正确

### Slice 5: MFA 多因素认证 (P3)
**入口点**：用户启用 TOTP → 绑定认证器 → 下次登录验证
**价值**：安全增强功能
**验收**：TOTP 验证成功，租户级策略生效

### Slice 6: 用户资料与邀请增强 (P3)
**入口点**：用户管理个人资料 → Tenant Admin 邀请用户
**价值**：用户体验增强
**验收**：资料修改生效，邀请邮件发送成功

---

*Next: See [research.md](./research.md) for Phase 0 technical research*
