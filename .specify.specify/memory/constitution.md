<!--
Sync Impact Report:
- Version: 1.0.0 (initial version)
- Created: 2025-02-10
- Added sections: All (initial constitution)
- Templates status:
  - plan-template.md: ✅ updated with AgentifUI constitution checks
  - spec-template.md: ✅ updated with constitution reference
  - tasks-template.md: ✅ updated with constitution reference
  - checklist-template.md: ✅ reviewed, compatible
  - agent-file-template.md: ✅ reviewed, compatible
- Follow-up TODOs: None
-->

# AgentifUI Constitution

## Core Principles

### I. 切片驱动开发 (Slice-Driven Development)

每个功能必须通过端到端切片实现，确保可独立演示、测试和交付。

**规则**：
- 每个切片 (Slice) 必须跨越前端、网关、后端完整链路
- 切片完成后系统必须「可运行、可使用、可演示」
- 禁止推倒重来，每个阶段保留的能力不得破坏
- 切片冻结后，相关接口契约不可变更

**验收标准**：
- 切片启动前冻结相关实体字段与 API 契约
- 切片结束后通过端到端冒烟测试
- 已交付切片在下个阶段仍可正常运行

**依据**：ROADMAP_V1_0.md 定义的 Stage 1/2/3 渐进式开发策略

---

### II. MVP 优先 (MVP First)

先跑起来再优化，避免过度设计与提前优化。

**规则**：
- 优先实现核心用户价值路径，阻塞性问题优先解决
- 每个用户故事 (User Story) 必须可独立测试和交付
- 性能优化、代码重构放在核心功能可用之后
- 依赖外部服务的功能必须有降级方案

**验收标准**：
- 核心路径可端到端执行
- 外部服务不可用时保持只读可用性
- 简单场景无需复杂配置即可使用

**依据**：PRD.md 第 1 节产品定位，DEGRADATION_MATRIX_P1.md

---

### III. TypeScript 全栈 (TypeScript Full-Stack)

前后端统一使用 TypeScript，严格类型检查贯穿全链路。

**规则**：
- 所有代码必须通过 TypeScript 严格模式检查 (`strict: true`)
- 禁止使用 `any` 类型，使用 `unknown` + 类型守卫
- 前后端共享类型定义通过 `@agentifui/shared` 包
- API 契约优先定义，类型自动推导

**验收标准**：
- `tsc --noEmit` 无错误
- 无 `@ts-ignore` 或 `@ts-expect-error`（除非有明确注释）
- 共享类型变更自动同步前后端

**依据**：TECHNOLOGY_STACK.md，ENGINEERING_GUIDELINES.md

---

### IV. 可观测性优先 (Observability First)

Trace ID 贯穿全链路，支持端到端追踪与问题排查。

**规则**：
- 网关生成 Trace ID (W3C/OTEL 格式) 并贯穿所有下游请求
- 每个请求、审计事件、执行记录必须包含 Trace ID
- 前端展示 Trace ID 并支持一键跳转外部观测平台
- 关键操作必须记录审计日志

**验收标准**：
- 100% Run 记录包含 Trace ID
- 审计事件 100% 可查询（5s 延迟内）
- 任意错误可通过 Trace ID 追溯完整调用链

**依据**：SYSTEM_BOUNDARY.md，GATEWAY_CONTRACT_P1.md，AUDIT_EVENTS_P1.md

---

### V. 多租户原生 (Multi-Tenant Native)

所有业务实体包含 `tenant_id`，数据隔离由底层保证。

**规则**：
- 所有业务表必须包含 `tenant_id` 列
- 查询必须携带租户上下文，禁止跨租户数据访问
- 配额、权限、统计数据按租户强隔离
- 租户数据 100% 隔离，任何情况下不可互访

**验收标准**：
- 任意租户无法访问其他租户数据
- 支持单 Tenant ≥ 5 万用户规模
- 权限判定延迟 ≤ 50ms

**依据**：DOMAIN_MODEL_P1.md，PRD.md 第 2 节

---

### VI. 统一接口网关 (Unified Gateway)

屏蔽后端编排平台差异，提供 OpenAI 兼容的统一调用方式。

**规则**：
- 前端只调用网关，不直接访问后端编排平台
- 网关负责身份鉴权、权限判定、配额检查、审计记录
- 协议适配由网关完成，后端差异对前端透明
- 支持能力降级与只读可用性

**验收标准**：
- OpenAI 基础 API 兼容测试通过
- 后端不可用时登录/导航/历史/统计/审计仍可用
- 停止生成请求 ≤ 500ms 响应

**依据**：GATEWAY_CONTRACT_P1.md，SYSTEM_BOUNDARY.md

---

## 开发模式

### 单人开发，AI 辅助 (Solo Development with AI)

针对单人开发场景的协作规范。

**规则**：
- 代码审查由 AI 辅助完成，遵循 ENGINEERING_GUIDELINES.md
- 使用 Git 分支策略：`feature/[slice]-[module]` 格式
- Commit Message 遵循 Conventional Commits 格式
- 单人模式下 PR 作为代码归档 checkpoint

**验收标准**：
- 每次 Slice 完成后创建 PR 归档
- 代码通过 Oxlint + ESLint 双层检查
- 关键变更有 AI 审查记录

**依据**：ENGINEERING_GUIDELINES.md，DEVELOPMENT_WORKFLOW.md

---

## 技术约束

### 技术栈锁定 (Technology Stack)

基于 TECHNOLOGY_STACK.md 的技术选型不可随意变更。

**规则**：
- 前端：Next.js 16 + React 19 + TypeScript + Zustand + shadcn/ui + Tailwind CSS v4
- 后端：Fastify 5.x + Drizzle ORM + PostgreSQL 18 + Redis 7.x
- 认证：better-auth + 自建 RBAC
- 可观测性：OpenTelemetry + Pino

**变更流程**：
- 技术栈变更需 RFC 讨论
- 评估对现有代码的影响范围
- 更新相关文档与模板

**依据**：TECHNOLOGY_STACK.md

---

### 目录结构规范 (Repository Structure)

遵循 REPO_STRUCTURE.md 定义的 Monorepo 目录组织。

**规则**：
- Monorepo 使用 pnpm workspace 管理
- apps/ 存放可部署应用，packages/ 存放共享库
- 前端：`apps/web/src/features/{module}/` 模块化组织
- 后端：`apps/api/src/modules/{module}/` Controller→Service→Repository 分层

**验收标准**：
- 新功能模块放在正确目录
- 依赖方向正确（Controller → Service → Repository）
- 无跨模块直接调用 Repository

**依据**：REPO_STRUCTURE.md

---

## Governance

### 修订流程 (Amendment Process)

1. 本宪章优先级高于所有其他开发规范
2. 宪章修订需通过 RFC 讨论并获得批准
3. 修订后必须更新所有受影响的模板与文档
4. 重大变更需保留迁移期与兼容性方案

### 版本策略 (Versioning)

遵循语义化版本 (Semantic Versioning)：

- **MAJOR**：移除或重定义核心原则/治理规则（向后不兼容）
- **MINOR**：新增原则或章节，或实质性扩展指导
- **PATCH**：措辞澄清、错别字修复、非语义性优化

当前版本：1.0.0

批准日期：2025-02-10

最后修订：2025-02-10

---

### 合规检查 (Compliance Review)

所有代码审查与设计评审必须验证：

- [ ] 切片端到端可演示
- [ ] 核心路径优先实现
- [ ] TypeScript 严格类型检查通过
- [ ] Trace ID 全链路可追溯
- [ ] 多租户数据隔离正确
- [ ] 网关契约符合规范
- [ ] 目录结构与依赖方向正确

**运行时参考文档**：
- 开发工作流：`docs/DEVELOPMENT_WORKFLOW.md`
- 工程规范：`docs/tech/practices/ENGINEERING_GUIDELINES.md`
- 目录规范：`docs/tech/practices/REPO_STRUCTURE.md`

---

*本文档基于 .specify/templates/constitution-template.md 生成*
