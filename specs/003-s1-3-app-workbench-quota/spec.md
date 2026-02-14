# Feature Specification: S1-3 应用入口与工作台

**Feature Branch**: `003-s1-3-app-workbench-quota`  
**Created**: 2026-02-13  
**Status**: Draft  
**Input**: S1-3（应用入口与工作台）来自 `docs/roadmap/ROADMAP_V1_0.md`、`docs/roadmap/PHASE1_BACKLOG.md`、`docs/roadmap/PHASE1_ACCEPTANCE.md`、`docs/feature-list/feature-list.json`

## Clarifications

### Session 2026-02-13

- **Q: 配额是否按 App 维度做硬限制？** → **A**: v1.0 只做 Tenant/Group/User 三级硬限制（`AC-S1-3-07`），使用记录保留 `appId` 用于统计与追溯；App 级硬配额留给 v2.0+。
- **Q: 配额超限后的处理边界？** → **A**: 拒绝新请求（新对话/新执行），已有请求允许按既有规则完成（符合 F-QUOTA-003）。
- **Q: 配额服务不可用时的 UX 最小闭环？** → **A**: 允许进入应用列表，禁用“新对话”入口并展示降级提示（`AC-S1-3-B01`）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 授权应用工作台与发现（Priority: P1)

用户在应用工作台看到自己有权访问的应用，支持“最近使用 / 我的收藏 / 全部应用”、分类浏览和搜索，不展示无权应用。

**Why this priority**: 对用户可感知价值最高，是进入 AI 能力的主入口，且是 S2-1 之前的必要前置。

**Independent Test**: 准备“有授权/无授权”混合应用数据，验证列表可见性、分类、搜索性能、收藏与最近使用写入。

**Acceptance Scenarios**:

1. **Given** 用户已登录且存在群组授权，**When** 打开应用工作台，**Then** 只展示授权应用（`AC-S1-3-01`）。
2. **Given** 用户存在收藏与最近使用记录，**When** 切换标签，**Then** 最近使用/收藏/全部分类正常（`AC-S1-3-02`）。
3. **Given** 用户输入关键词搜索，**When** 返回结果，**Then** 搜索响应 P95 ≤ 300ms（`AC-S1-3-03`）。
4. **Given** 用户无某应用访问权，**When** 查看列表，**Then** 该应用完全不可见（与 S1-2 可见性规则一致）。

---

### User Story 2 - 配额检查与超限拦截（Priority: P1)

系统在请求进入执行链路前，按 Tenant/Group/User 三级配额检查，超限时拒绝新请求并返回可解释错误。

**Why this priority**: 直接决定成本上限与治理边界，属于 Stage 1 必须能力。

**Independent Test**: 构造不同层级配额与使用量，验证“通过/拦截”路径及错误返回一致性。

**Acceptance Scenarios**:

1. **Given** 用户发起新请求，**When** 任一层级超限，**Then** 请求被拦截（`AC-S1-3-04`）。
2. **Given** 用户发起新请求，**When** Tenant/Group/User 都未超限，**Then** 请求通过并进入执行链路。
3. **Given** 触发配额扣减，**When** 记录使用账本，**Then** 归因到当前工作群组（`AC-S1-3-06`）。
4. **Given** 存在多层级限制，**When** 请求执行，**Then** 三层限制都生效（`AC-S1-3-07`）。

---

### User Story 3 - 配额告警与可观测（Priority: P1)

系统在 80% / 90% / 100% 阈值触发告警，并在规定时延内完成分发与审计记录。

**Why this priority**: 是配额治理闭环，不仅要“拦截”，还要“提前预警”。

**Independent Test**: 通过回放/压测将使用量推进到阈值，验证告警触发、去重、延迟与审计事件。

**Acceptance Scenarios**:

1. **Given** 使用量达到阈值，**When** 告警任务运行，**Then** 80%/90%/100% 各阈值被触发（`AC-S1-3-05`）。
2. **Given** 同一阈值已发送，**When** 重复触发窗口内再次检测，**Then** 不重复发送（阈值去重）。
3. **Given** 告警发送，**When** 查询审计日志，**Then** 可看到 `gov.quota.warning` / `gov.quota.exceeded` 事件。

---

### User Story 4 - 配额服务降级（Priority: P1)

当配额服务不可用时，系统按降级矩阵保持“可浏览、不可新建”。

**Why this priority**: 降级是 S1-3 明确验收边界，不可省略。

**Independent Test**: 模拟 quota service 超时/不可用，验证应用列表可用且新对话被禁止。

**Acceptance Scenarios**:

1. **Given** 配额服务不可用，**When** 用户进入应用列表，**Then** 列表仍可访问（`AC-S1-3-B01`）。
2. **Given** 配额服务不可用，**When** 用户点击新对话，**Then** 系统拒绝并提示降级原因（`AC-S1-3-B01`）。

---

### Edge Cases

- 同一用户属于多个群组且都授权应用时，必须以当前 `X-Active-Group-ID` 归因扣减。
- 单群组用户未传 `X-Active-Group-ID` 时，系统自动回落到默认活跃群组。
- 告警任务重试时，必须幂等，避免同阈值重复通知。
- 配额检查通过但扣减失败时，必须进入补偿/重试队列并记录审计。
- 搜索关键字为空、超长、包含特殊字符时，结果和性能都需可控。

## Requirements *(mandatory)*

### Functional Requirements

**应用工作台（F-APP-001 / F-APP-004）**

- **FR-001**: 系统 MUST 提供应用工作台入口，支持“最近使用 / 我的收藏 / 全部应用”视图。
- **FR-002**: 系统 MUST 仅展示当前用户有权访问的应用（无权应用不可见）。
- **FR-003**: 系统 MUST 支持按关键词搜索与按类型/标签分类浏览。
- **FR-004**: 系统 MUST 记录最近使用应用并支持收藏/取消收藏。
- **FR-005**: 应用列表查询 MUST 支持按当前工作群组上下文过滤。

**配额管理与计量（F-QUOTA-001 / F-QUOTA-002）**

- **FR-006**: 系统 MUST 支持 Tenant/Group/User 三级配额限制并统一执行。
- **FR-007**: 系统 MUST 默认使用 `prompt_tokens + completion_tokens` 口径计量。
- **FR-008**: 系统 MUST 支持租户级切换为按请求数计量（企业配置）。
- **FR-009**: 系统 MUST 将每次扣减归因到当前工作群组（`AC-S1-3-06`）。
- **FR-010**: 系统 MUST 记录包含 `tenantId/groupId/userId/appId/model` 的使用账本。

**超限拦截与告警（F-QUOTA-003 / F-QUOTA-004）**

- **FR-011**: 系统 MUST 在请求执行前完成配额检查，超限时拒绝新请求。
- **FR-012**: 超限响应 MUST 返回可解释错误（`quota_exceeded`）与 Trace ID。
- **FR-013**: 系统 MUST 在 80%/90%/100% 阈值触发告警。
- **FR-014**: 告警处理延迟 MUST ≤ 5 分钟（`AC-S1-3-05`）。
- **FR-015**: 告警 MUST 至少支持站内通知；Webhook 为可选通道。

**降级与可观测**

- **FR-016**: 配额服务不可用时 MUST 允许访问应用列表（只读路径保持可用）。
- **FR-017**: 配额服务不可用时 MUST 禁止新对话/新执行请求。
- **FR-018**: 配额检查链路 MUST 贯穿 Trace ID。
- **FR-019**: 配额告警与超限 MUST 写入审计事件。
- **FR-020**: 关键路径 MUST 输出结构化错误码与可监控指标。

### Scope Boundaries

**In Scope (S1-3)**:
- 应用目录入口、工作台分类、搜索、最近使用、收藏。
- Tenant/Group/User 三级配额检查与扣减。
- 80%/90%/100% 阈值告警。
- 配额服务不可用降级（可进列表，禁新对话）。

**Out of Scope (defer)**:
- 应用级硬配额（v2.0+）。
- 复杂成本报表与管理后台配额配置 UI（S3-1）。
- 多渠道告警编排策略（仅保留 webhook 扩展点）。

### Key Entities

- **App**: AI 应用实体，S1-3 补齐 S1-2 之外字段（description/mode/icon/tags/config 等）。
- **AppFavorite**: 用户收藏关系（user + app + tenant）。
- **AppRecentUse**: 最近使用关系（user + app + tenant + lastUsedAt）。
- **QuotaPolicy**: 配额策略（scope=tenant/group/user，limit，period，meteringMode）。
- **QuotaCounter**: 当前周期累计使用值（按策略维度聚合）。
- **QuotaUsageLedger**: 每次请求的使用账本，支持追溯与补偿。
- **QuotaAlertEvent**: 告警事件记录，包含阈值、分发状态、traceId。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `AC-S1-3-01` 通过，授权应用可见性正确率 100%。
- **SC-002**: `AC-S1-3-02` 通过，最近使用/收藏/全部分类功能通过 E2E。
- **SC-003**: `AC-S1-3-03` 通过，应用搜索 P95 ≤ 300ms。
- **SC-004**: `AC-S1-3-04` 通过，超限请求拦截率 100%。
- **SC-005**: `AC-S1-3-05` 通过，阈值告警延迟 ≤ 5 分钟。
- **SC-006**: `AC-S1-3-06` 通过，配额扣减归因正确率 100%。
- **SC-007**: `AC-S1-3-07` 通过，Tenant/Group/User 三层限制全部生效。
- **SC-008**: `AC-S1-3-B01` 通过，降级状态下“可浏览、不可新建”。

### Performance Targets

- **SC-101**: 应用列表/搜索查询 P95 ≤ 300ms（50 应用规模）。
- **SC-102**: 配额检查耗时 P95 ≤ 50ms。
- **SC-103**: 告警任务端到端触达 ≤ 5 分钟。

### Security & Compliance

- **SC-201**: 无授权应用不可见，越权读取拦截率 100%。
- **SC-202**: 超限与告警事件审计覆盖率 100%。
- **SC-203**: 配额降级触发写入治理事件（可追溯）。
