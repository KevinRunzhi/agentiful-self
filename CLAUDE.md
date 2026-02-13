# Agentiful Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-02-10

## Active Technologies

### Branch: 1-multi-tenant-auth
- **Database**: PostgreSQL 18 (primary), Redis 7.x (sessions/cache)
- **Language/Framework**: TypeScript 5.8+ (strict mode)
  - Frontend: Next.js 16, React 19, Zustand, shadcn/ui, Tailwind CSS v4
  - Backend: Fastify 5.x, better-auth, Drizzle ORM
- **Testing**: Vitest, Playwright (E2E), better-auth test utilities
- **Target Platform**: Node.js 22.x LTS, modern browsers (ES2022+)

### Branch: master
- *No feature spec yet - inherits from 1-multi-tenant-auth*

## Project Structure

```text
agentiful/
├── apps/
│   ├── web/          # Next.js 16 + React 19 frontend
│   ├── api/          # Fastify 5.x backend service
│   └── worker/       # BullMQ background worker
├── packages/
│   ├── shared/       # Shared TypeScript types
│   ├── ui/           # shadcn/ui components
│   └── db/           # Drizzle ORM schemas
└── docs/
    └── tech/         # Architecture documentation
```

## Commands

```bash
# Install dependencies
pnpm install

# Database migration
pnpm --filter @agentifui/db db:generate
pnpm --filter @agentifui/db db:migrate

# Development servers
pnpm --filter @agentifui/web dev    # Frontend on :3000
pnpm --filter @agentifui/api dev    # Backend on :3001
pnpm --filter @agentifui/worker dev

# Testing
pnpm test               # Unit tests
pnpm test:e2e           # Playwright E2E

# Linting
pnpm lint               # Oxlint + ESLint
```

## Code Style

**TypeScript**: Strict mode enabled, no `any` type, use `unknown` + type guards

### Frontend Conventions
- Component files: `kebab-case.tsx`
- Hook files: `use-` prefix (e.g., `useAuth.ts`)
- Feature modules: `apps/web/src/features/{module}/`

### Backend Conventions
- Controller → Service → Repository pattern
- Module structure: `apps/api/src/modules/{module}/`
- File naming: `kebab-case` (e.g., `auth.service.ts`)

## Constitution Compliance

All features must follow:
- **Slice-Driven Development**: End-to-end demoable slices
- **MVP First**: Core functionality before enhancements
- **TypeScript Full-Stack**: Shared types in `@agentifui/shared`
- **Observability First**: Trace ID贯穿全链路
- **Multi-Tenant Native**: All business entities have `tenant_id`
- **Unified Gateway**: Frontend calls gateway only
- **Tech Stack Locked**: Follow TECHNOLOGY_STACK.md

See: `.specify.specify/memory/constitution.md`

## Recent Changes

- **002-rbac-authorization-model** (2025-02-11): Phase 1 planning complete
  - Research: Redis 缓存 + Pub/Sub 失效策略，权限判定引擎设计
  - Data Model: Role, Permission, RolePermission, UserRole, AppGrant
  - API Contracts: 15 endpoints for roles, permissions, grants, breakglass
  - Quickstart: Development environment setup guide

- **1-multi-tenant-auth** (2025-02-10): Phase 1 planning complete
  - Research: better-auth selected, multi-tenant User-UserRole-Tenant model
  - Data Model: User (global), Tenant, UserRole, Group, GroupMember, MFASecret, SSOConfig, Invitation, PasswordHistory, AuditEvent
  - API Contracts: auth-api.md, user-api.md, tenant-api.md
  - Quickstart: Development environment setup guide

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
