# AgentifUI Phase 1 切片开发路线图

**创建日期**：2026-02-11
**关联文档**：`docs/roadmap/PHASE1_BACKLOG.md`、`docs/roadmap/PHASE1_ACCEPTANCE.md`

---

## 进度总览

| # | 切片 ID | 名称 | 预估工时 | Feature 数 | 状态 |
|---|---------|------|----------|-----------|------|
| 1 | S1-1 | 多租户身份认证基座 | 8h | 11 | ✅ Spec 完成 |
| 2 | S1-2 | RBAC 与授权模型 | 8h | 8 | 🔲 待开始 |
| 3 | S1-3 | 应用入口与工作台 | 6h | 6 | 🔲 待开始 |
| 4 | S2-1 | 统一网关最小协议 | 8h | 7 | 🔲 待开始 |
| 5 | S2-2 | 流式对话与执行追踪 | 12h | 11 | 🔲 待开始 |
| 6 | S2-3 | 执行状态与数据持久化 | 8h | 9 | 🔲 待开始 |
| 7 | S3-1 | 管理后台核心闭环 | 10h | 13 | 🔲 待开始 |
| 8 | S3-2 | 审计与安全合规闭环 | 8h | 11 | 🔲 待开始 |
| 9 | S3-3 | 平台管理与用户体验完善 | 10h | 18 | 🔲 待开始 |

**Phase 1 总计**：~78h，94 个 Feature

---

## 每个切片的 SpecKit 流程

每个切片都需要依次执行以下命令：

```
/speckit.specify <描述>     → 生成 spec.md
/speckit.clarify <补充>     → 澄清模糊点，更新 spec.md
/speckit.plan               → 生成 plan.md（技术方案）
/speckit.tasks              → 生成 tasks.md（任务列表）
/speckit.analyze            → 一致性检查
/speckit.implement          → 开始编码
```

---

## 切片 1：S1-1 多租户身份认证基座 ✅

**状态**：Spec + Clarify + Plan + Tasks 已完成
**分支**：`1-multi-tenant-auth`
**文件**：`specs/1-multi-tenant-auth/`
**依赖**：无（首个切片）

### 覆盖 Feature
F-ORG-001~003（租户/群组/成员）、F-AUTH-001~008（登录/SSO/JIT/审核/密码/MFA/资料/邀请）

### 下一步
进入 `/speckit.implement` 或直接开始下一个切片 S1-2

---

## 切片 2：S1-2 RBAC 与授权模型 👈 下一个

**状态**：🔲 待开始
**依赖**：S1-1（需要 Tenant/Group/User 实体和认证基础）
**预估**：8h

### 覆盖 Feature（8 个）

| Feature ID | 名称 | 优先级 | 说明 |
|------------|------|--------|------|
| F-IAM-001 | 角色体系（RBAC） | P0 | ROOT ADMIN/Tenant Admin/Manager/User 四级角色 |
| F-IAM-002 | Break-glass 紧急访问机制 | P1 | 运维紧急访问，强制留痕，Severity=Critical |
| F-IAM-003 | 应用访问授权（群组→应用） | P0 | 通过 Group 授予 App 访问权，即时生效 |
| F-IAM-004 | 用户直授例外授权 | P1 | 个别用户直授，需原因+有效期（默认7天，最长90天） |
| F-IAM-005 | 授权优先级与显式拒绝 | P0 | Deny > 直授 Allow > 群组授权 > 默认拒绝，判定 ≤50ms |
| F-IAM-006 | 多群组权限合并与归因 | P0 | 权限并集，扣费归因到当前工作群组 |
| F-IAM-007 | 内容可见性边界 | P0 | User 仅看自己对话，Manager 看团队统计（不看内容） |
| F-IAM-008 | 智能上下文切换 | P1 | 点击应用自动/提示切换群组上下文 |

### 验收标准
- AC-S1-2-01：权限判定 P95 ≤ 50ms
- AC-S1-2-02：四级角色权限分离正确
- AC-S1-2-07：多群组权限合并为并集

### Specify 参考描述

```
/speckit.specify S1-2 RBAC 与授权模型：基于 S1-1 的 Tenant/Group/User 实体，实现四级角色体系（ROOT ADMIN/Tenant Admin/Manager/User）和应用访问授权。涵盖 F-IAM-001~008 共 8 个 Feature。核心能力包括：角色-权限关联（Role/Permission/UserRole 实体）、群组→应用授权（AppGrant）、用户直授例外（需原因+有效期）、授权优先级判定（Deny > 直授 > 群组 > 默认拒绝，P95 ≤50ms）、多群组权限并集合并与配额归因、内容可见性边界（User 仅看自己对话，Manager 看统计不看内容）、智能群组上下文切换、Break-glass 紧急访问（Critical 审计）。请参考 docs/roadmap/PHASE1_BACKLOG.md 的 S1-2 切片定义、docs/feature-list/feature-list.json 中 F-IAM-001~008 条目、docs/tech/data-model/DOMAIN_MODEL_P1.md 的 Role/Permission/UserRole/AppGrant 实体、docs/prd/PRD.md §4 权限与治理章节、docs/roadmap/PHASE1_ACCEPTANCE.md 的 S1-2 验收条目。
```

### Clarify 关键预判
1. **ROOT ADMIN 默认关闭**：如何启用？环境变量？超级密钥？
2. **权限缓存策略**：50ms 判定要求是否需要 Redis 缓存？变更时如何失效？
3. **AppGrant 与 S1-1 的 Group 关系**：授权粒度是 Group→App 还是 Group→App→Permission？
4. **Group Switcher 交互**：单群组用户隐藏切换器的具体条件？

---

## 切片 3：S1-3 应用入口与工作台

**状态**：🔲 待开始
**依赖**：S1-2（需要 RBAC 和应用授权）
**预估**：6h

### 覆盖 Feature（6 个）

| Feature ID | 名称 | 优先级 | 说明 |
|------------|------|--------|------|
| F-APP-001 | AI 应用目录与选择入口 | P0 | 统一入口选择 AI 应用，覆盖 Chatbot/Chatflow/Agent |
| F-APP-004 | 应用发现与工作台 | P0 | 分类浏览/搜索/最近使用/收藏/全部应用 |
| F-QUOTA-001 | 多层级配额管理 | P0 | Tenant/Group/User 三级配额限制 |
| F-QUOTA-002 | Token 计量与计费口径 | P1 | 按输入+输出 Token 计量，可配按请求计量 |
| F-QUOTA-003 | 配额超限拦截 | P0 | 达到限制拒绝新请求，给出可解释反馈 |
| F-QUOTA-004 | 配额阈值告警 | P1 | 80%/90%/100% 告警，告警延迟 ≤5min |

### 验收标准
- AC-S1-3-01：应用列表正确展示授权应用
- AC-S1-3-04：配额超限拦截率 100%
- AC-S1-3-05：配额告警触发（80%/90%/100%），延迟 ≤5min

### Specify 参考描述

```
/speckit.specify S1-3 应用入口与工作台：基于 S1-2 的 RBAC 授权，实现应用发现和配额管理。涵盖 F-APP-001、F-APP-004、F-QUOTA-001~004 共 6 个 Feature。核心能力包括：AI 应用目录（Chatbot/Chatflow/Agent 类型）、应用工作台（最近使用/收藏/全部应用/分类浏览/搜索 P95 ≤300ms）、三级配额管理（Tenant/Group/User，重置周期默认自然月）、Token 计量（输入+输出，usage-based 归因）、配额超限拦截（拒绝新请求+可解释反馈）、阈值告警（80%/90%/100%，延迟 ≤5min）。请参考 docs/roadmap/PHASE1_BACKLOG.md S1-3、docs/feature-list/feature-list.json 中对应 Feature 条目、docs/tech/data-model/DOMAIN_MODEL_P1.md App 实体、docs/prd/PRD.md §5 应用中心和 §6 配额章节。
```

---

## 切片 4：S2-1 统一网关最小协议

**状态**：🔲 待开始
**依赖**：S1-3（需要应用入口和配额检查）
**预估**：8h

### 覆盖 Feature（7 个）

| Feature ID | 名称 | 优先级 | 说明 |
|------------|------|--------|------|
| F-GW-001 | OpenAI API 兼容的统一调用入口 | P0 | 对前端提供 OpenAI 风格接口 |
| F-GW-002 | 统一错误处理与响应结构一致性 | P0 | 一致的错误语义 |
| F-GW-003 | 会话主键统一生成与映射管理 | P0 | 平台生成主键，维护外部映射 |
| F-GW-004 | 能力降级与只读可用性保障 | P0 | 后端不可用时降级，历史/统计/审计只读可用 |
| F-GW-005 | 身份与凭证传递边界 | P0 | 前端→网关→后端的身份传递规则 |
| F-OBS-001 | Trace ID 全链路关联与展示 | P0 | 每次 Run 有 Trace，兼容 OpenTelemetry/W3C |
| F-OBS-002 | 外部观测平台跳转 | P1 | 配置 URL 模板，一键跳转外部观测平台 |

### 验收标准
- AC-S2-1-01：OpenAI 兼容 API 可调通
- AC-S2-1-02：SSE 流式响应正常，首 Token P95 ≤ 1.5s
- AC-S2-1-03：100% 请求包含 Trace ID

### Specify 参考描述

```
/speckit.specify S2-1 统一网关最小协议：实现 OpenAI API 兼容的统一调用入口，屏蔽后端平台差异。涵盖 F-GW-001~005、F-OBS-001~002 共 7 个 Feature。核心能力包括：OpenAI 风格统一接口（对话+流式+最小工具调用）、统一错误处理（一致的错误格式和语义）、会话主键生成和外部 ID 映射、能力降级（编排不可用时历史/统计/审计只读可用）、身份凭证传递（默认不透传后端 access_token）、Trace ID 全链路注入（兼容 OpenTelemetry/W3C traceparent）、外部观测平台跳转。请参考 docs/roadmap/PHASE1_BACKLOG.md S2-1、docs/feature-list/feature-list.json 中 F-GW 和 F-OBS 条目、docs/tech/architecture/SYSTEM_BOUNDARY.md、docs/prd/PRD.md 网关相关章节。
```

---

## 切片 5：S2-2 流式对话与执行追踪

**状态**：🔲 待开始
**依赖**：S2-1（需要统一网关和 Trace ID）
**预估**：12h（最大切片）

### 覆盖 Feature（11 个）

| Feature ID | 名称 | 优先级 | 说明 |
|------------|------|--------|------|
| F-CHAT-001 | 实时文本对话 | P0 | 多轮实时对话，首 Token P95 ≤1.5s |
| F-CHAT-002 | 流式响应展示 | P0 | SSE 流式渲染 |
| F-CHAT-003 | 数学公式渲染 | P1 | LaTeX 公式渲染 |
| F-CHAT-004 | AI 推荐下一问题 | P2 | 下一步问题建议 |
| F-CHAT-005 | 停止生成 | P0 | ≤500ms 停止渲染，审计记录 |
| F-CHAT-006 | 对话会话管理 | P0 | 搜索/重命名/删除/固定/归档 |
| F-CHAT-007 | 对话只读分享链接 | P1 | 可撤销分享，按 Tenant/Group 控制 |
| F-CHAT-008 | 消息交互与反馈 | P1 | 复制/编辑重发/重新生成/赞踩 |
| F-FILE-001 | 文件上传/下载/预览 | P1 | 单文件 ≤50MB，50MB P95 ≤10s |
| F-ART-001 | Artifacts 产物管理 | P2 | 代码/文档从对话中抽离为可管理产物 |
| F-HITL-001 | Human-in-the-loop | P2 | 确认/选择/审批/补充信息 |

### 验收标准
- AC-S2-2-01：完整对话端到端成功
- AC-S2-2-02：停止生成 ≤500ms
- AC-S2-2-03：50MB 文件上传 P95 ≤10s

### Specify 参考描述

```
/speckit.specify S2-2 流式对话与交互体验：基于 S2-1 统一网关，实现完整的对话交互体验。涵盖 F-CHAT-001~008、F-FILE-001、F-ART-001、F-HITL-001 共 11 个 Feature。核心能力包括：实时多轮对话（首 Token P95 ≤1.5s）、SSE 流式渲染、停止生成（≤500ms）、LaTeX 公式渲染、AI 推荐下一问题、对话会话管理（搜索/重命名/删除/固定/归档）、只读分享链接（Tenant/Group 可见性控制）、消息交互（复制/编辑重发/重新生成/赞踩）、文件上传下载预览（单文件 ≤50MB）、Artifacts 产物管理（代码/文档版本化）、Human-in-the-loop 结构化交互。请参考 docs/roadmap/PHASE1_BACKLOG.md S2-2、docs/feature-list/feature-list.json 中 F-CHAT/F-FILE/F-ART/F-HITL 条目、docs/tech/data-model/DOMAIN_MODEL_P1.md Conversation/Message 实体、docs/prd/PRD.md 对话系统章节。
```

---

## 切片 6：S2-3 执行状态与数据持久化

**状态**：🔲 待开始
**依赖**：S2-2（需要对话和执行基础）
**预估**：8h

### 覆盖 Feature（9 个）

| Feature ID | 名称 | 优先级 | 说明 |
|------------|------|--------|------|
| F-APP-002 | 运行 Agent/Workflow | P0 | 统一 UI 查看状态与结果 |
| F-APP-003 | RAG 引用结果展示 | P1 | 展示检索引用（来源/页码/相关度） |
| F-RUN-001 | Run 类型统一入口 | P0 | Workflow/Agent/Generation 统一展示 |
| F-RUN-002 | 执行状态展示 | P0 | 状态变更 ≤3s 反映到 UI |
| F-RUN-003 | 执行详情与失败原因 | P0 | 步骤数/耗时/Token/失败原因 |
| F-DATA-001 | 会话与执行数据持久化 | P0 | 本地持久化，应用删除后只读保留 |
| F-DATA-002 | 数据回源同步与降级 | P1 | 本地缺失时回源，失败降级展示 |
| F-SEC-001 | 提示词注入检测策略 | P1 | 记录/告警/拦截可配 |
| F-SEC-002 | 会话隔离与应用上下文隔离 | P0 | 避免串话与跨域引用 |

### 验收标准
- AC-S2-3-01：Run 状态变更 ≤3s 反映到 UI
- AC-S2-3-03：会话数据持久化成功
- AC-S2-3-05：会话隔离正确

### Specify 参考描述

```
/speckit.specify S2-3 执行状态与数据持久化：基于 S2-2 对话能力，实现执行追踪和数据管理。涵盖 F-APP-002~003、F-RUN-001~003、F-DATA-001~002、F-SEC-001~002 共 9 个 Feature。核心能力包括：运行 Agent/Workflow（统一 UI）、RAG 引用展示、Run 类型统一入口（Workflow/Agent/Generation）、执行状态实时展示（≤3s）、执行详情（步骤/耗时/Token/失败原因）、会话与执行数据本地持久化（应用删除后只读保留）、数据回源同步与降级、提示词注入检测（记录/告警/拦截）、会话隔离与上下文隔离。请参考 docs/roadmap/PHASE1_BACKLOG.md S2-3、docs/feature-list/feature-list.json 中对应条目、docs/tech/data-model/DOMAIN_MODEL_P1.md Run/RunStep 实体。
```

---

## 切片 7：S3-1 管理后台核心闭环

**状态**：🔲 待开始
**依赖**：S2-3（需要完整的数据和执行基础）
**预估**：10h
**Feature 数**：13 个

### 核心能力
- 用户管理 CRUD（列表/搜索/状态变更/批量操作）
- 群组管理 CRUD（创建/编辑/成员管理）
- 应用管理（注册/编辑/启停/删除）
- 授权管理（群组→应用授权/用户直授/批量操作）
- 配额管理（三级配额配置/使用量查看）
- Manager 权限范围控制（仅限本群组）

### Specify 参考描述

```
/speckit.specify S3-1 管理后台核心闭环：为 Tenant Admin 和 Manager 提供完整的管理后台。涵盖 13 个 Feature，核心能力包括：用户管理 CRUD（列表搜索 P95 ≤500ms@1万用户，状态变更，批量操作）、群组管理 CRUD、应用注册和管理（启停/删除/配置）、授权管理（群组→应用/用户直授/批量操作）、配额三级配置和使用量查看、Manager 权限范围控制。请参考 docs/roadmap/PHASE1_BACKLOG.md S3-1、docs/roadmap/PHASE1_ACCEPTANCE.md S3-1 验收条目、docs/feature-list/feature-list.json 中 F-MGR 系列条目。
```

---

## 切片 8：S3-2 审计与安全合规闭环

**状态**：🔲 待开始
**依赖**：S3-1
**预估**：8h
**Feature 数**：11 个

### 核心能力
- 审计日志采集（5 类事件 100% 覆盖，写入 ≤5s）
- 审计日志查询（30 天 P95 ≤2s）
- 审计日志导出（10 万条 ≤30s）
- 审计日志不可篡改与权限控制
- 高风险访问事由记录
- PII 去敏配置（检出率 ≥95%）
- 输出内容合规检测与拦截

### Specify 参考描述

```
/speckit.specify S3-2 审计与安全合规闭环：实现完整的审计和安全合规能力。涵盖 F-AUDIT-001~003、F-SEC-003~004 等 11 个 Feature。核心能力包括：审计日志采集（5 类事件 100% 覆盖，写入 ≤5s）、审计查询（30 天 P95 ≤2s）、导出（10 万条 ≤30s）、不可篡改和权限控制、高风险访问事由记录、PII 去敏（检出率 ≥95%）、输出合规检测与拦截。请参考 docs/roadmap/PHASE1_BACKLOG.md S3-2、docs/roadmap/PHASE1_ACCEPTANCE.md S3-2 验收条目、docs/feature-list/feature-list.json 中 F-AUDIT 和 F-SEC 条目。
```

---

## 切片 9：S3-3 平台管理与用户体验完善

**状态**：🔲 待开始
**依赖**：S3-2
**预估**：10h
**Feature 数**：18 个（最大 Feature 数切片）

### 核心能力
- ROOT ADMIN 管理（Tenant 创建 ≤30s 可用）
- 多语言切换（中/英文）
- Webhook 通知（首次投递 P95 ≤30s）
- 成本估算与价格表配置
- Open API（用户/群组、对话、统计、配额查询）
- 平台可用性（月度 ≥99.9%）
- 单 Tenant 容量（≥5 万用户）

### Specify 参考描述

```
/speckit.specify S3-3 平台管理与用户体验完善：实现平台级管理和用户体验完善。涵盖 18 个 Feature，核心能力包括：ROOT ADMIN 管理（Tenant 生命周期，创建 ≤30s）、多语言切换（中/英文）、Webhook 通知（首次投递 P95 ≤30s）、成本估算与价格表、Open API（查询与集成）、平台可用性（≥99.9%）、单 Tenant 容量（≥5 万用户）。请参考 docs/roadmap/PHASE1_BACKLOG.md S3-3、docs/roadmap/PHASE1_ACCEPTANCE.md S3-3 验收条目、docs/feature-list/feature-list.json 中 F-OPEN/F-COST 条目。
```

---

## 你现在该做什么

### 1. 决定 S1-1 是否先实现

你有两个选择：

**选项 A：先实现 S1-1 再 Specify S1-2**
```
/speckit.implement    ← 在 S1-1 分支上开始编码
```
实现完成后再切到 S1-2。

**选项 B：先把所有切片 Specify 完再统一实现**
```
git checkout main     ← 回到主分支
/speckit.specify <S1-2 描述>   ← 开始 S1-2 的 Specify
```

**建议选 A**：切片驱动开发的核心原则是"一个切片完整走完再开始下一个"。

### 2. 如果开始 S1-2

直接复制上面 S1-2 的 Specify 参考描述，在 Claude Code 中执行：

```
/speckit.specify <粘贴 S1-2 的描述>
```

然后用同样的方式准备 clarify 内容（我已在上面预判了 4 个关键问题）。
