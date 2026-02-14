# Implementation Plan: S1-3 应用入口与工作台

**Branch**: `003-s1-3-app-workbench-quota` | **Date**: 2026-02-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-s1-3-app-workbench-quota/spec.md`

## Summary

S1-3 目标是把“可访问应用入口 + 工作台体验 + 配额治理 + 降级”打通为一个端到端闭环：

1. 用户可在工作台看到授权应用并高效发现（最近使用/收藏/搜索/分类）。  
2. 新请求进入执行链路前执行三级配额检查（Tenant/Group/User），并按当前工作群组归因。  
3. 达到 80%/90%/100% 触发告警；超限请求 100% 拦截。  
4. 配额服务异常时维持只读可用（可进应用列表，禁新对话）。

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict)  
**Primary Dependencies**:
- Backend: Fastify 5.x, Drizzle ORM, PostgreSQL 18, Redis 7
- Frontend: Next.js 16, React 19, Zustand
- Observability: OpenTelemetry + structured logs
**Storage**: PostgreSQL（策略与账本），Redis（热计数与告警去重）  
**Testing**: Vitest, Playwright, integration tests  
**Target Platform**: Node.js 22.x  
**Project Type**: Monorepo (`apps/api`, `apps/web`, `packages/*`)  
**Performance Goals**:
- Search P95 ≤ 300ms
- Quota check P95 ≤ 50ms
- Alert delay ≤ 5min
**Constraints**:
- 必须复用 S1-2 的授权可见性规则
- 配额服务降级策略必须符合 `AC-S1-3-B01`
- v1.0 不引入 App 级硬配额
**Scale/Scope**:
- 单租户 50 应用量级可稳定满足性能目标

## Constitution Check

基于 `.specify.specify/memory/constitution.md` 的执行检查：

- [x] **切片驱动**：S1-3 保持独立验收路径（应用发现 + 配额闭环 + 降级）。
- [x] **MVP 优先**：先保证可见性、拦截、告警、降级，复杂报表与后台配置后移。
- [x] **TypeScript 全栈**：接口契约与共享类型统一落在 monorepo。
- [x] **可观测性优先**：配额检查与告警全链路要求 Trace + 审计。
- [x] **多租户原则**：所有配额策略与使用数据按 tenant scope 隔离。
- [x] **统一网关契约**：兼容 `GET /v1/models` 与 `POST /v1/chat/completions` 的治理链路。

无额外复杂度豁免项。

## Project Structure

### Documentation (this feature)

```text
specs/003-s1-3-app-workbench-quota/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── s1-3-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (planned target)

```text
apps/api/src/
├── modules/rbac/routes/apps.routes.ts
├── modules/rbac/services/app.service.ts
├── modules/quota/
│   ├── routes/quota.routes.ts
│   ├── services/quota-check.service.ts
│   ├── services/quota-deduct.service.ts
│   ├── services/quota-alert.service.ts
│   └── repositories/quota.repository.ts
└── middleware/quota-guard.ts

apps/web/src/
├── app/(main)/apps/page.tsx
└── features/apps/
    ├── components/
    ├── hooks/
    └── services/

packages/db/src/
├── schema/quota.ts
└── migrations/
```

**Structure Decision**:
- 在 API 侧新增 `quota` 模块，避免继续堆叠到 `rbac` 服务中。
- `rbac/apps` 继续负责“应用可见性和上下文”，配额由中间件与 quota 服务处理。
- 前端以 `/apps` 为统一入口页，聚合最近使用、收藏、搜索和降级提示。

## Slice Breakdown

### Slice A: 阻塞项收敛（Stage A）

**目标**：打通可实施基线，不做完整业务扩展。  
**内容**：
- 路由接入：把 rbac/apps 路由接入主服务。
- 最小 UI 入口：补 `/apps` 路由，避免工作台入口缺失。
- 编译基线：修复直接阻塞 S1-3 的类型/路由断裂。

### Slice B: 应用工作台（Stage B1）

**目标**：实现授权应用列表、搜索、分类、最近使用、收藏。  
**验收映射**：`AC-S1-3-01` `AC-S1-3-02` `AC-S1-3-03`

### Slice C: 配额检查与扣减（Stage B2）

**目标**：Tenant/Group/User 三级配额限制 + 请求拦截 + 归因账本。  
**验收映射**：`AC-S1-3-04` `AC-S1-3-06` `AC-S1-3-07`

### Slice D: 告警与降级（Stage B3）

**目标**：80/90/100 告警 + 配额服务不可用降级。  
**验收映射**：`AC-S1-3-05` `AC-S1-3-B01`

## Implementation Strategy

1. 先完成 Slice A，保证“可运行 + 可联调”。  
2. 按 B1 → B2 → B3 逐步收敛，每个切片可单独验证。  
3. 每个切片完成后回归 S1-2 能力，防止应用可见性与群组上下文回退。  
4. 最终输出 AC 对照验收报告与残留风险清单。
