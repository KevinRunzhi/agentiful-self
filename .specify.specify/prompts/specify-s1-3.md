S1-3 应用入口与工作台

## 切片概述

这是 Phase 1 的第三个切片（S1-3），依赖 S1-1（多租户身份认证基座）和 S1-2（RBAC 与授权模型）。S1-1 提供了 Tenant/Group/User 实体和认证基础，S1-2 建立了角色体系、权限判定引擎、AppGrant 应用授权和 Active Group 上下文。S1-3 的目标是在此基础上实现两大能力：

1. **应用发现与工作台**：用户登录后看到有权访问的 AI 应用目录，通过最近使用/收藏/搜索快速找到目标应用
2. **配额管理与拦截**：为 Tenant/Group/User 三级实体设置使用额度，达到上限时实时拦截新请求，临近上限时告警通知

本切片完成后，系统将具备完整的"用户看到什么应用、能用多少"的治理闭环，为 S2-1 统一网关提供配额检查基础。

## 覆盖的 Feature（共 6 个）

### P0 核心功能（必须先实现）

- **F-APP-001** AI 应用目录与选择入口：用户可在统一入口选择不同 AI 应用并开始交互或执行。应用类型覆盖 Chatbot/Chatflow/Agent。应用可被禁用/删除但历史只读保留。用户只能看到通过授权（AppGrant）获得访问权的应用。
- **F-APP-004** 应用发现与工作台：提供应用发现页面，支持分类浏览（类型/标签）、搜索（名称和描述，P95 ≤ 300ms），以及工作台布局（最近使用/我的收藏/全部应用）。应用卡片展示图标/名称/简介/类型标签。用户可收藏常用应用。
- **F-QUOTA-001** 多层级配额管理：提供 Tenant/Group/User 三级配额限制与统一执行。Tenant 总上限不可突破。应用级配额为 v2.0+ 范围。配额重置周期默认自然月（Tenant 可配置为自然周）。优先级：细粒度约束优先（User < Group < Tenant），不允许突破上级限制。
- **F-QUOTA-003** 配额超限拦截：达到配额限制时拒绝新请求并给出可解释反馈。既有请求可按规则完成执行。拦截率 100%。

### P1 企业级增强

- **F-QUOTA-002** Token 计量与计费口径：支持按输入 + 输出 Token（默认）计量，并允许企业配置按请求计量。usage-based 归因；报表维度需包含 Model。
- **F-QUOTA-004** 配额阈值告警：提供配额阈值（80%/90%/100%）告警，并向 User/Manager/Tenant Admin 分发通知。站内通知必选；Webhook 可选。告警延迟 ≤ 5 分钟。

## 与前置切片的接口依赖

### 依赖 S1-1 的能力（不重复实现）
- Tenant、Group、GroupMember、User 实体和 CRUD
- 用户认证和会话管理（登录/Token/MFA）
- 租户数据隔离（tenant_id 上下文）
- 最小审计写入能力（认证事件）

### 依赖 S1-2 的能力（不重复实现）
- Role/Permission/UserRole 角色权限体系
- 权限判定引擎（checkPermission，P95 ≤ 50ms）
- AppGrant 应用授权模型（group→app / user→app 的 use/deny 授权记录）
- App 基本实体（id/tenantId/name/status，S1-2 已创建最小 App 表）
- Active Group 上下文服务（getActiveGroup、Group Switcher、X-Active-Group-ID 中间件）
- 权限缓存与失效机制（Redis + Pub/Sub）
- RBAC 审计事件写入能力

### S1-3 新增/扩展的数据实体
- **App（扩展）**：在 S1-2 最小 App 实体基础上补充完整字段：icon、iconType、description、mode（chat/workflow/agent/completion）、tags（用途标签，jsonb）、externalId、externalPlatform、config、enableApi、apiRpm、createdBy
- **UserFavorite（新增）**：用户收藏应用记录（userId, appId, tenantId, createdAt）
- **AppUsageHistory（新增）**：用户最近使用应用记录（userId, appId, tenantId, lastUsedAt），用于"最近使用"排序
- **Quota（新增）**：配额定义表（tenantId, scope=tenant/group/user, scopeId, quotaType=token/request, limitValue, resetPeriod=monthly/weekly, currentUsage, resetAt）
- **QuotaUsage（新增）**：配额消耗流水表（quotaId, delta, runId?, traceId, model, createdAt），用于实时扣减和归因分析
- **QuotaAlert（新增）**：配额告警记录表（quotaId, threshold=80/90/100, alertedAt, notifiedActors）

## 必须参考的文档

请按以下顺序阅读指定章节，不需要阅读未列出的部分：

1. **docs/roadmap/PHASE1_BACKLOG.md** → 仅读「S1-3：应用入口与工作台」章节，提取 Feature 映射（6 个）、验收映射（AC-S1-3-01~07、AC-S1-3-B01）、接口冻结点、DoD
2. **docs/prd/PRD.md** → 读以下章节：
   - §4.2.5 配额模型（Token 口径、配额作用域、重置周期、优先级）
   - §6.2a 应用发现与工作台（应用展示、工作台布局、应用卡片信息）
   - §10.5 通知系统（站内通知范围和保留期）
   - §11.2 延迟指标（配额告警延迟 ≤ 5min）
3. **docs/feature-list/feature-list.json** → 仅读 F-APP-001、F-APP-004、F-QUOTA-001~004 共 6 个 Feature 条目，提取 description/actors/notes/scope
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 读 §3.4 应用与授权（App 完整字段定义）和 §6 待确认项第 1 条（配额数据模型设计决策），以及 §3.6 执行追踪（Run 实体 totalTokens 字段，作为配额扣减归因的数据来源）
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → 仅读 §2.3 S1-3 验收条目（AC-S1-3-01~07 + AC-S1-3-B01）
6. **specs/002-rbac-authorization-model/spec.md** → 阅读 S1-2 的 spec，了解已确立的 App/AppGrant 实体定义、Active Group 服务接口、权限判定引擎接口，确保 S1-3 不重复定义且保持一致
7. **specs/1-multi-tenant-auth/spec.md** → 阅读 S1-1 的 spec，了解 Tenant/Group/User 实体定义和数据隔离边界

## User Story 组织建议

请将 6 个 Feature 按用户旅程组织为 4-5 个 User Story，而非 1:1 映射。建议分组：

- **US1（P0）应用目录与发现**：F-APP-001 + F-APP-004 → 用户登录后进入应用工作台，看到有权访问的 AI 应用列表（基于 AppGrant 授权并集），可以按类型/标签分类浏览、搜索应用（P95 ≤ 300ms），查看最近使用和收藏的应用，点击应用卡片进入交互。
- **US2（P0）配额定义与三级限制**：F-QUOTA-001 → Tenant Admin 为 Tenant/Group/User 设置 Token 或请求配额，系统逐级校验不允许下级突破上级限制，配额按自然月（或配置的自然周）自动重置。
- **US3（P0）配额实时拦截**：F-QUOTA-003 → 用户发起请求时系统实时检查配额，若任一层级（User/Group/Tenant）超限则拒绝请求并给出具体反馈（哪一层超限、当前用量/上限）。拦截率 100%。
- **US4（P1）Token 计量与归因**：F-QUOTA-002 → 每次 Run 完成后，按模型实际产出（inputTokens + outputTokens）扣减对应的 Tenant/Group/User 三级配额，扣费归因到 Active Group，流水记录包含 model 维度。
- **US5（P1）配额告警与通知**：F-QUOTA-004 → 配额消耗达到 80%/90%/100% 阈值时，系统在 5 分钟内向对应 Actor 发送站内通知：80% → User；90% → User + Manager；100% → User + Manager + Tenant Admin。同一阈值在同一重置周期内只触发一次。

以上仅供参考，可根据阅读材料调整，但必须覆盖全部 6 个 Feature。

## Edge Cases 提示

至少覆盖以下场景：

- **应用禁用/删除后的展示**：已禁用的应用在用户目录中不可见；已删除的应用标记为"不可用"但历史对话只读保留
- **收藏的应用被撤销授权**：用户收藏了应用 X，之后被撤销授权 → 收藏列表中应用 X 消失（不显示无权应用）
- **配额扣减与请求并发**：多个请求同时到达，扣减总和可能超出配额上限 → 需要原子性扣减或竞态保护
- **配额重置时机**：自然月最后一秒和新月第一秒的边界处理，确保不漏扣不多扣
- **上级配额不足但下级配额充足**：User 配额还有余额但 Group 配额已超限 → 应拦截（向上级传递限制）
- **配额服务不可用时降级**：配额检查服务故障时允许进入应用列表（只读浏览），但禁止创建新对话/执行
- **零配额用户**：User 配额设为 0 → 相当于停用，所有请求被拦截
- **告警去重**：配额从 79% 跳到 95%，应触发 80% 和 90% 两个告警（不跳过），但同一阈值不重复触发

## 边界约束

- ❌ 不涉及应用注册/编辑/删除（属于 S3-1 管理后台 F-ADMIN-APP-* 系列，S1-3 只做应用目录展示和发现）
- ❌ 不涉及应用的对话/执行能力（属于 S2-1/S2-2 统一网关和流式对话切片）
- ❌ 不涉及配额的管理后台 UI（属于 S3-1 的 F-ADMIN-QUOTA-* 系列，S1-3 只做配额引擎和 API）
- ❌ 不涉及应用级配额（明确为 v2.0+ 范围）
- ❌ 不涉及成本估算与价格表配置（属于 S3-3 的 F-COST-001）
- ❌ 不涉及 Webhook 告警投递（站内通知必选，Webhook 在 S3-3 实现）
- ❌ 不重复实现 S1-1 的认证/组织能力和 S1-2 的 RBAC/AppGrant/Active Group 能力
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
