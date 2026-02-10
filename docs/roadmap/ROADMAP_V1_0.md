# AgentifUI 开发路线图 v1.0

> **生成时间**：2026-01-26
> **基于**：PRD v1.0、PRD_ADMIN v1.0、Feature List SSOT、DEVELOPMENT_WORKFLOW v1.3

---

## 概览

本路线图严格遵循 `DEVELOPMENT_WORKFLOW.md` 定义的切片驱动原则，将 AgentifUI v1.0 的开发划分为 **3 个渐进式阶段**。每个阶段结束后系统必须「可运行、可使用、可演示」，禁止推倒重来。

| 阶段 | 核心目标 | 切片覆盖 | Feature 数量 |
|------|----------|----------|-------------|
| Stage 1 | 身份与组织上下文 | S1-1 ~ S1-3 | ~25 |
| Stage 2 | 网关与对话核心链路 | S2-1 ~ S2-3 | ~35 |
| Stage 3 | 治理闭环与可运营 | S3-1 ~ S3-3 | ~32 |

---

## Stage 1 — 身份与组织上下文

### 核心目标

**解决阻断性问题**：建立多租户隔离与身份认证基础，使用户能够登录系统、加入群组并看到授权应用列表。

### 用户故事

该阶段结束时：
- **User**：能够通过多种方式登录、查看个人资料、切换群组上下文、浏览授权应用列表
- **Admin**：能够在管理后台创建用户/群组、配置认证方式、执行基础授权操作

### Feature 类型侧重

| 类型 | 占比 | 理由 |
|------|------|------|
| Common | 70% | 身份认证、租户隔离、RBAC 为系统地基，属于基础设施能力 |
| Business | 30% | 登录交互、应用列表可见性为用户直接感知的业务能力 |

### 端到端切片

#### S1-1：多租户身份认证基座

- **覆盖 Feature ID**：F-ORG-001, F-ORG-002, F-ORG-003, F-AUTH-001, F-AUTH-002, F-AUTH-003, F-AUTH-004, F-AUTH-005, F-AUTH-006, F-AUTH-007, F-AUTH-008
- **接口冻结点**：切片启动会通过后冻结 `DOMAIN_MODEL` 中 Tenant/Group/User 实体字段
- **验收边界**：
  - ✅ 已具备：
    - Tenant 隔离机制生效，跨租户数据不可互访
    - 用户可通过邮箱密码完成登录
    - SSO 域名自动识别（≤500ms）
    - JIT 用户创建与待审核流程
    - 密码策略与 MFA（TOTP）配置
    - 用户资料与偏好设置
    - 用户邀请与激活链接
  - ❌ 不具备：
    - 手机号/第三方账号登录（需第三方集成，延后验证）
    - SCIM 用户同步（Out-of-Scope）
- **观测/审计/降级**：
  - Trace：需要 — 认证链路异常定位
  - 审计：需要 — 登录/登出/失败登录事件必须记录
  - 降级：不需要 — 认证为核心链路，无法降级

#### S1-2：RBAC 与授权模型

- **覆盖 Feature ID**：F-IAM-001, F-IAM-002, F-IAM-003, F-IAM-004, F-IAM-005, F-IAM-006, F-IAM-007, F-IAM-008
- **接口冻结点**：切片启动会通过后冻结 `DOMAIN_MODEL` 中 Role/Grant/ACL 实体字段
- **验收边界**：
  - ✅ 已具备：
    - ROOT ADMIN / Tenant Admin / Manager / User 四级角色体系
    - Break-glass 紧急访问机制（站内信通知 + Critical 审计）
    - 群组→应用授权主路径
    - 用户直授例外路径（需原因 + 有效期）
    - 权限优先级判定（Deny > 用户直授 > 群组授权 > 默认拒绝）
    - 多群组权限合并（并集）与归因（当前工作群组）
    - 内容可见性边界强制执行
    - 智能上下文切换（弹窗选择群组）
  - ❌ 不具备：
    - 应用级配额（v2.0+）
    - ABAC 复杂条件（仅作为 Allow/Deny 附加条件）
- **观测/审计/降级**：
  - Trace：需要 — 权限判定链路追踪
  - 审计：需要 — 权限变更、授权变更事件
  - 降级：不需要 — 授权为核心逻辑，无法降级

#### S1-3：应用入口与工作台

- **覆盖 Feature ID**：F-APP-001, F-APP-004, F-QUOTA-001, F-QUOTA-002, F-QUOTA-003, F-QUOTA-004
- **接口冻结点**：切片启动会通过后冻结 `DOMAIN_MODEL` 中 App/Quota 实体字段
- **验收边界**：
  - ✅ 已具备：
    - AI 应用目录与选择入口
    - 应用发现工作台（最近使用 / 我的收藏 / 全部应用）
    - 分类浏览与搜索
    - Tenant/Group/User 三级配额限制
    - Token 计量口径（输入 + 输出）
    - 配额超限拦截与告警（80%/90%/100%）
  - ❌ 不具备：
    - 应用实际对话能力（Stage 2）
    - 按模型分维度统计（Stage 3）
- **观测/审计/降级**：
  - Trace：需要 — 配额检查链路
  - 审计：需要 — 配额配置变更
  - 降级：需要 — 配额服务不可用时允许进入应用列表

### 基线规范（Baseline Specs）

该阶段必须先锁定的 v0.x 规范：
- `DOMAIN_MODEL_P1.md`：Tenant / Group / User / Role / App 核心实体 + 配额字段
- `GATEWAY_CONTRACT_P1.md`：身份鉴权 API、权限判定 API 契约
- `AUDIT_EVENTS_P1.md`：鉴权事件、权限变更事件枚举
- `DEGRADATION_MATRIX_P1.md`：配额服务不可用时只读可用路径
- `.agent/context/slice-status.json`：切片冻结状态追踪（机器可读）

### AI 任务粒度建议

针对碎片化时间团队的任务拆分建议：
1. 生成 `FRD-S1-AUTH`：身份认证切片 FRD（~2h）
2. 生成 `FRD-S1-RBAC`：RBAC 与授权切片 FRD（~2h）
3. 生成用户认证 API 骨架代码（~1h）
4. 实现邮箱密码登录 + 密码策略校验（~3h）
5. 实现 RBAC 权限判定引擎（~4h）
6. 实现群组切换与应用列表（~2h）
7. 实现配额检查与告警（~2h）
8. 端到端冒烟测试（~1h）

### 阶段验收（DoD-Stage）

- [ ] 用户可通过邮箱密码完成登录
- [ ] SSO 域名识别响应时间 ≤500ms
- [ ] 待审核用户登录后仅能访问个人设置页
- [ ] 权限判定延迟 ≤50ms
- [ ] 多群组权限合并逻辑正确（并集）
- [ ] 配额扣减归因到当前工作群组
- [ ] 配额超限时拒绝新请求并返回可解释错误
- [ ] 配额告警延迟 ≤5 分钟
- [ ] 关键鉴权事件 100% 写入审计日志
- [ ] Break-glass 操作产生 Critical 级审计并发送站内信

### 进入下一阶段时保留的能力

以下能力/资产必须保持不破坏：
- 登录态与 Session 管理机制
- RBAC 角色判定逻辑
- 群组上下文切换机制
- 配额检查与扣减接口
- 审计日志写入管道

---

## Stage 2 — 网关与对话核心链路

### 核心目标

**解决阻断性问题**：建立统一接口网关与对话核心链路，使用户能够与 AI 应用进行流式对话、停止生成并追踪执行状态。

### 用户故事

该阶段结束时：
- **User**：能够发起对话、接收流式响应、停止生成、上传文件、查看执行状态与 Trace、管理对话历史
- **Admin**：能够注册 AI 应用、配置后端连接、查看运行记录

### Feature 类型侧重

| 类型 | 占比 | 理由 |
|------|------|------|
| Common | 40% | 网关协议、Trace、数据持久化为基础设施 |
| Business | 60% | 对话交互、文件处理、执行状态为用户核心体验 |

### 端到端切片

#### S2-1：统一网关最小协议

- **覆盖 Feature ID**：F-GW-001, F-GW-002, F-GW-003, F-GW-004, F-GW-005, F-OBS-001, F-OBS-002
- **接口冻结点**：切片启动会通过后冻结 `GATEWAY_CONTRACT` 中 SSE/stop/error 字段
- **验收边界**：
  - ✅ 已具备：
    - OpenAI API 兼容的统一调用入口（对话 + 流式 + 最小工具调用）
    - 统一请求/响应/错误结构
    - 会话主键统一生成与后端映射
    - 能力降级与只读可用性（编排不可用时历史/统计/审计可用）
    - 身份与凭证传递（默认不透传用户后端 token）
    - Trace ID 全链路关联（兼容 OpenTelemetry/W3C）
    - 外部观测平台跳转配置
  - ❌ 不具备：
    - OpenAI 全量能力（仅最小可用集合）
    - 跨平台可续聊迁移
- **观测/审计/降级**：
  - Trace：需要 — 全链路追踪核心能力
  - 审计：需要 — 请求/响应记录
  - 降级：需要 — 编排不可用时只读可用

#### S2-2：流式对话与执行追踪

- **覆盖 Feature ID**：F-CHAT-001, F-CHAT-002, F-CHAT-003, F-CHAT-004, F-CHAT-005, F-CHAT-006, F-CHAT-007, F-CHAT-008, F-FILE-001, F-ART-001, F-HITL-001
- **接口冻结点**：切片启动会通过后冻结 `DOMAIN_MODEL` 中 Conversation/Message/Artifact 实体字段
- **验收边界**：
  - ✅ 已具备：
    - 实时文本对话（首 Token P95 ≤1.5s）
    - 流式响应展示
    - 数学公式渲染（LaTeX）
    - AI 推荐下一问题
    - 停止生成（硬停/软停 + 提示，≤500ms 停止渲染）
    - 对话会话管理（搜索/重命名/删除/固定/归档）
    - 对话只读分享链接（可配置登录/有效期）
    - 消息交互与反馈（复制/编辑重发/重新生成/赞踩）
    - 文件上传/下载/预览（单文件 50MB P95 ≤10s）
    - Artifacts 产物管理（草稿 10 个 + 稳定版本）
    - HITL 结构化交互
  - ❌ 不具备：
    - RAG 引用结果展示（延后至 Stage 2 后期）
    - Agent/Workflow 运行（延后至 S2-3）
- **观测/审计/降级**：
  - Trace：需要 — 每条消息关联 Trace ID
  - 审计：需要 — 对话创建/删除、分享创建/撤销
  - 降级：需要 — 流式中断时展示已生成内容 + 错误提示

#### S2-3：执行状态与数据持久化

- **覆盖 Feature ID**：F-APP-002, F-APP-003, F-RUN-001, F-RUN-002, F-RUN-003, F-DATA-001, F-DATA-002, F-SEC-001, F-SEC-002
- **接口冻结点**：切片启动会通过后冻结 `DOMAIN_MODEL` 中 Run/Execution 实体字段
- **验收边界**：
  - ✅ 已具备：
    - 运行 Agent/Workflow 并查看状态与结果
    - RAG 引用结果展示
    - Run 类型统一入口（Workflow Run / Agent Run / Generation Run）
    - 执行状态展示（待处理/运行中/已完成/失败/已停止，≤3s 反映到 UI）
    - 执行详情与失败原因呈现
    - 会话与执行数据本地持久化（默认永久保存）
    - 数据回源同步与降级
    - 提示词注入检测策略（默认记录 + 告警）
    - 会话隔离与应用上下文隔离
  - ❌ 不具备：
    - 创建/编辑/发布编排能力（Out-of-Scope）
    - 跨应用引用历史/统一记忆（Out-of-Scope）
- **观测/审计/降级**：
  - Trace：需要 — 100% Run 记录包含 Trace ID
  - 审计：需要 — 高风险访问、安全事件
  - 降级：需要 — 回源失败时展示本地数据 + 提示不完整

### 基线规范（Baseline Specs）

该阶段必须先锁定的 v0.x 规范：
- `DOMAIN_MODEL_P1.md`：Conversation / Message / Run / Execution / Artifact 实体
- `GATEWAY_CONTRACT_P1.md`：对话 API、流式 SSE、stop 信号、错误结构完整定义
- `AUDIT_EVENTS_P1.md`：对话事件、执行事件、安全事件枚举
- `DEGRADATION_MATRIX_P1.md`：编排不可用时降级路径完整定义
- `HITL_PROTOCOL_V0.md`：结构化交互 schema 定义

### AI 任务粒度建议

1. 生成 `FRD-S2-GATEWAY`：网关协议切片 FRD（~2h）
2. 生成 `FRD-S2-CHAT`：对话系统切片 FRD（~3h）
3. 生成 `FRD-S2-EXEC`：执行追踪切片 FRD（~2h）
4. 实现 SSE 流式响应通道（~3h）
5. 实现对话 UI 与消息渲染（~4h）
6. 实现 stop 信号与软停逻辑（~2h）
7. 实现文件上传与 Artifacts 管理（~3h）
8. 实现 Run 状态机与持久化（~3h）
9. 端到端对话冒烟测试（~2h）

### 阶段验收（DoD-Stage）

- [ ] 用户可完成一次完整对话并收到流式响应
- [ ] 首 Token 时间 P95 ≤1.5s
- [ ] 用户点击停止后 ≤500ms 停止渲染
- [ ] 50MB 文件上传 P95 ≤10s
- [ ] 执行状态变更 ≤3s 反映到 UI
- [ ] 100% Run 记录包含可复制的 Trace ID
- [ ] 编排平台不可用时登录/导航/历史/统计/审计仍可用
- [ ] 提示词注入检测正常记录并告警
- [ ] 不同用户会话与不同应用上下文强隔离
- [ ] 数据持久化成功，应用删除后历史只读保留

### 进入下一阶段时保留的能力

- Stage 1 全部能力（登录态/RBAC/配额）
- 网关协议与 Trace 机制
- 对话 UI 与消息渲染
- 执行状态机与持久化
- 文件上传通道

---

## Stage 3 — 治理闭环与可运营

### 核心目标

**解决阻断性问题**：建立管理后台最小闭环与审计追溯能力，使平台具备可运营条件，管理员能够完成日常治理操作，关键操作可追溯，失败可自查。

### 用户故事

该阶段结束时：
- **User**：能够使用完整的 v1.0 功能，包括多语言切换、主题定制、站内通知
- **Admin**：能够完成用户/群组/应用/权限/配额/审计全流程管理，配置安全合规策略，查看统计报表
- **Manager**：能够管理团队成员、查看团队统计与配额使用

### Feature 类型侧重

| 类型 | 占比 | 理由 |
|------|------|------|
| Common | 35% | 审计、安全合规、可靠性为基础设施 |
| Business | 65% | 管理后台操作、报表、通知为运营核心能力 |

### 端到端切片

#### S3-1：管理后台核心闭环

- **覆盖 Feature ID**：F-ADMIN-USER-001, F-ADMIN-USER-002, F-ADMIN-GROUP-001, F-ADMIN-APP-001, F-ADMIN-APP-002, F-ADMIN-AUTHZ-001, F-ADMIN-QUOTA-001, F-ADMIN-QUOTA-002, F-MGR-001, F-MGR-002, F-MGR-003, F-MGR-004, F-MGR-005
- **接口冻结点**：切片启动会通过后冻结管理 API 契约（CRUD 接口字段）
- **验收边界**：
  - ✅ 已具备：
    - 用户管理（列表/详情/邀请/审批/状态/删除/查看对话需审计）
    - 账号安全管理（重置密码/强制 MFA）
    - 群组管理（创建/编辑/删除/成员增删/指派 Manager）
    - 应用管理（注册/编辑/启停/删除/tags/凭证加密）
    - 应用授权管理
    - 授权管理（群组授权/用户直授/批量/撤销）
    - 配额管理（Tenant/Group/User 三级）
    - 配额告警配置
    - Manager 团队成员管理
    - Manager 团队应用授权管理（限于群组范围）
    - Manager 配额使用查看
    - Manager 团队统计报表
    - Manager 群组内用户级授权
  - ❌ 不具备：
    - ROOT ADMIN 平台管理（延后至 S3-3）
- **观测/审计/降级**：
  - Trace：需要 — 管理操作链路追踪
  - 审计：需要 — 所有管理操作 100% 记录
  - 降级：不需要 — 管理操作为关键流程

#### S3-2：审计与安全合规闭环

- **覆盖 Feature ID**：F-AUDIT-001, F-AUDIT-002, F-AUDIT-003, F-SEC-003, F-SEC-004, F-ADMIN-SEC-001, F-ADMIN-AUDIT-001, F-ADMIN-AUDIT-002, F-ADMIN-ANALYTICS-001, F-COST-001, F-ADMIN-COST-001
- **接口冻结点**：切片启动会通过后冻结 `AUDIT_EVENTS` 中事件类型与字段
- **验收边界**：
  - ✅ 已具备：
    - 审计日志采集（5 类事件 100% 覆盖，≤5s 可查询）
    - 审计日志不可篡改与权限控制（保留期 180 天～7 年）
    - 高风险访问事由记录
    - PII 去敏配置（敏感字段检出率 ≥95%）
    - 输出内容合规检测与拦截
    - 安全与合规策略配置（认证/SSO/MFA/注入检测）
    - 审计日志查询与详情查看（30 天 P95 ≤2s）
    - 审计日志导出与保留期配置（10 万条 ≤30s）
    - 统计与报表（5 维度，数据延迟 ≤5 分钟）
    - 成本估算与价格表配置
  - ❌ 不具备：
    - PII 关联追溯（v2.0+）
    - 对接外部审计存储（扩展预留）
- **观测/审计/降级**：
  - Trace：需要 — 审计查询链路
  - 审计：需要 — 导出行为本身需审计
  - 降级：不需要 — 审计为合规必需

#### S3-3：平台管理与用户体验完善

- **覆盖 Feature ID**：F-ADMIN-PLAT-001, F-ADMIN-PLAT-002, F-ADMIN-PLAT-003, F-ADMIN-SETTINGS-001～011, F-OPEN-001, F-OPEN-002, F-I18N-001, F-BRAND-001, F-A11Y-001, F-NOTIF-001, F-NOTIF-002, F-UX-001, F-REL-001, F-REL-002, F-REL-003, F-REL-004
- **接口冻结点**：切片启动会通过后冻结 `OPEN_API_SPEC` 与 `WEBHOOK_SPEC` 契约
- **验收边界**：
  - ✅ 已具备：
    - ROOT ADMIN 租户生命周期管理（创建 ≤30s 可用，禁用即时生效）
    - 租户级总配额上限配置
    - 平台全局配置
    - 租户基础信息/品牌/多语言/Webhook/观测平台/通知/公告/文件上传/对话分享/API Key 等系统设置
    - 保留策略汇总视图
    - 平台 Open API（OAuth2/OIDC + API Key）
    - Webhook 事件订阅与投递（P95 ≤30s，3 次重试 ≥99%）
    - 多语言（中文/英文）
    - 主题与品牌定制
    - 基础可访问性支持（键盘操作）
    - 站内通知中心（保留期 90 天）
    - 平台/租户系统公告广播
    - 响应式适配策略（Chat 移动端支持，管理后台 PC 专属）
    - 高可用与无单点部署
    - 关键体验与性能指标承诺
    - 规模容量承诺（单 Tenant ≥5 万用户）
    - 数据备份与恢复策略（RPO ≤24h，RTO ≤4h）
  - ❌ 不具备：
    - 邮件/短信通知（v2.0+）
    - 自定义域名白标（Out-of-Scope）
    - SCIM 用户同步（Out-of-Scope）
- **观测/审计/降级**：
  - Trace：需要 — 全链路覆盖
  - 审计：需要 — 平台管理操作（Critical 级）
  - 降级：需要 — 外部服务不可用时保持核心功能

### 基线规范（Baseline Specs）

该阶段必须锁定的 v1.0 规范：
- `DOMAIN_MODEL_V1.md`：全量实体模型定稿
- `GATEWAY_CONTRACT_V1.md`：全量 API 契约定稿
- `AUDIT_EVENTS_V1.md`：全量审计事件定稿
- `DEGRADATION_MATRIX_V1.md`：全量降级矩阵定稿
- `WEBHOOK_SPEC_V0.md`：Webhook 协议定义
- `OPEN_API_SPEC_V0.md`：平台 Open API 定义

### AI 任务粒度建议

1. 生成 `FRD-S3-ADMIN`：管理后台切片 FRD（~3h）
2. 生成 `FRD-S3-AUDIT`：审计合规切片 FRD（~2h）
3. 生成 `FRD-S3-PLATFORM`：平台管理切片 FRD（~2h）
4. 实现用户/群组/应用管理 CRUD（~4h）
5. 实现审计日志查询与导出（~3h）
6. 实现统计报表仪表盘（~3h）
7. 实现 Webhook 投递引擎（~2h）
8. 实现多语言与主题切换（~2h）
9. 全功能回归测试（~3h）

### 阶段验收（DoD-Stage）

- [ ] 用户列表加载 P95 ≤500ms（1 万用户）
- [ ] 群组/应用列表加载 P95 ≤300ms
- [ ] 权限/状态变更 ≤5s 全平台生效
- [ ] 审计日志写入 ≤5s 可查询
- [ ] 审计日志查询（30 天）P95 ≤2s
- [ ] 10 万条审计导出 ≤30s
- [ ] 配额告警延迟 ≤5 分钟
- [ ] Webhook 首次投递 P95 ≤30s，3 次重试成功率 ≥99%
- [ ] PII 敏感字段检出率 ≥95%
- [ ] 平台月度可用性 ≥99.9%
- [ ] 单 Tenant 支撑 ≥5 万用户、同时在线 ≥1000
- [ ] 中英文切换正常，品牌定制生效

### 进入生产时保留的能力

以下为 v1.0 完整能力集合：
- 多租户身份认证与 RBAC
- 统一接口网关与对话系统
- 执行追踪与数据持久化
- 管理后台全功能
- 审计日志与安全合规
- 多语言/主题/通知/Open API/Webhook
- 高可用与性能承诺

---

## 附录：Feature ID 阶段分布

| Feature ID | 名称 | 阶段 | 切片 |
|------------|------|------|------|
| F-ORG-001 | 多租户隔离与治理单元 | Stage 1 | S1-1 |
| F-ORG-002 | 群组组织与成员归属 | Stage 1 | S1-1 |
| F-ORG-003 | 多群组成员与管理者绑定 | Stage 1 | S1-1 |
| F-AUTH-001 | 多认证方式登录 | Stage 1 | S1-1 |
| F-AUTH-002 | 基于邮箱域名的 SSO 自动识别 | Stage 1 | S1-1 |
| F-AUTH-003 | JIT 用户创建与入驻 | Stage 1 | S1-1 |
| F-AUTH-004 | 用户状态与审核流 | Stage 1 | S1-1 |
| F-AUTH-005 | 密码策略管理 | Stage 1 | S1-1 |
| F-AUTH-006 | MFA（TOTP）与租户级策略 | Stage 1 | S1-1 |
| F-AUTH-007 | 用户资料与偏好设置 | Stage 1 | S1-1 |
| F-AUTH-008 | 用户邀请与激活链接 | Stage 1 | S1-1 |
| F-IAM-001 | 角色体系（RBAC） | Stage 1 | S1-2 |
| F-IAM-002 | Break-glass 紧急访问机制 | Stage 1 | S1-2 |
| F-IAM-003 | 应用访问授权（群组→应用） | Stage 1 | S1-2 |
| F-IAM-004 | 用户直授例外授权 | Stage 1 | S1-2 |
| F-IAM-005 | 授权优先级与显式拒绝 | Stage 1 | S1-2 |
| F-IAM-006 | 多群组权限合并与归因 | Stage 1 | S1-2 |
| F-IAM-007 | 内容可见性边界 | Stage 1 | S1-2 |
| F-IAM-008 | 智能上下文切换 | Stage 1 | S1-2 |
| F-QUOTA-001 | 多层级配额管理 | Stage 1 | S1-3 |
| F-QUOTA-002 | Token 计量与计费口径 | Stage 1 | S1-3 |
| F-QUOTA-003 | 配额超限拦截 | Stage 1 | S1-3 |
| F-QUOTA-004 | 配额阈值告警 | Stage 1 | S1-3 |
| F-APP-001 | AI 应用目录与选择入口 | Stage 1 | S1-3 |
| F-APP-004 | 应用发现与工作台 | Stage 1 | S1-3 |
| F-GW-001 | OpenAI API 兼容的统一调用入口 | Stage 2 | S2-1 |
| F-GW-002 | 统一错误处理与响应结构一致性 | Stage 2 | S2-1 |
| F-GW-003 | 会话主键统一生成与映射管理 | Stage 2 | S2-1 |
| F-GW-004 | 能力降级与只读可用性保障 | Stage 2 | S2-1 |
| F-GW-005 | 身份与凭证传递边界 | Stage 2 | S2-1 |
| F-OBS-001 | Trace ID 全链路关联与展示 | Stage 2 | S2-1 |
| F-OBS-002 | 外部观测平台跳转 | Stage 2 | S2-1 |
| F-CHAT-001 | 实时文本对话 | Stage 2 | S2-2 |
| F-CHAT-002 | 流式响应展示 | Stage 2 | S2-2 |
| F-CHAT-003 | 数学公式渲染 | Stage 2 | S2-2 |
| F-CHAT-004 | AI 推荐下一问题 | Stage 2 | S2-2 |
| F-CHAT-005 | 停止生成 | Stage 2 | S2-2 |
| F-CHAT-006 | 对话会话管理 | Stage 2 | S2-2 |
| F-CHAT-007 | 对话只读分享链接 | Stage 2 | S2-2 |
| F-CHAT-008 | 消息交互与反馈 | Stage 2 | S2-2 |
| F-FILE-001 | 文件上传/下载/预览 | Stage 2 | S2-2 |
| F-ART-001 | Artifacts 产物管理与预览 | Stage 2 | S2-2 |
| F-HITL-001 | Human-in-the-loop 结构化交互 | Stage 2 | S2-2 |
| F-APP-002 | 运行 Agent/Workflow | Stage 2 | S2-3 |
| F-APP-003 | RAG 引用结果展示 | Stage 2 | S2-3 |
| F-RUN-001 | Run 类型统一入口 | Stage 2 | S2-3 |
| F-RUN-002 | 执行状态展示 | Stage 2 | S2-3 |
| F-RUN-003 | 执行详情与失败原因呈现 | Stage 2 | S2-3 |
| F-DATA-001 | 会话与执行数据本地持久化 | Stage 2 | S2-3 |
| F-DATA-002 | 数据回源同步与降级 | Stage 2 | S2-3 |
| F-SEC-001 | 提示词注入检测策略 | Stage 2 | S2-3 |
| F-SEC-002 | 会话隔离与应用上下文隔离 | Stage 2 | S2-3 |
| F-ADMIN-USER-001 | 用户管理 | Stage 3 | S3-1 |
| F-ADMIN-USER-002 | 账号安全管理 | Stage 3 | S3-1 |
| F-ADMIN-GROUP-001 | 群组管理 | Stage 3 | S3-1 |
| F-ADMIN-APP-001 | 应用管理 | Stage 3 | S3-1 |
| F-ADMIN-APP-002 | 应用授权管理 | Stage 3 | S3-1 |
| F-ADMIN-AUTHZ-001 | 授权管理 | Stage 3 | S3-1 |
| F-ADMIN-QUOTA-001 | 配额管理 | Stage 3 | S3-1 |
| F-ADMIN-QUOTA-002 | 配额告警配置 | Stage 3 | S3-1 |
| F-MGR-001 | 团队成员管理 | Stage 3 | S3-1 |
| F-MGR-002 | 团队应用授权管理 | Stage 3 | S3-1 |
| F-MGR-003 | 团队配额使用查看 | Stage 3 | S3-1 |
| F-MGR-004 | 团队统计报表 | Stage 3 | S3-1 |
| F-MGR-005 | 群组内用户级授权 | Stage 3 | S3-1 |
| F-AUDIT-001 | 审计日志采集 | Stage 3 | S3-2 |
| F-AUDIT-002 | 审计日志不可篡改与权限控制 | Stage 3 | S3-2 |
| F-AUDIT-003 | 高风险访问事由记录 | Stage 3 | S3-2 |
| F-SEC-003 | PII 去敏配置 | Stage 3 | S3-2 |
| F-SEC-004 | 输出内容合规检测与拦截 | Stage 3 | S3-2 |
| F-ADMIN-SEC-001 | 安全与合规策略配置 | Stage 3 | S3-2 |
| F-ADMIN-AUDIT-001 | 审计日志查询与详情查看 | Stage 3 | S3-2 |
| F-ADMIN-AUDIT-002 | 审计日志导出与保留期配置 | Stage 3 | S3-2 |
| F-ADMIN-ANALYTICS-001 | 统计与报表 | Stage 3 | S3-2 |
| F-COST-001 | 成本估算与价格表配置 | Stage 3 | S3-2 |
| F-ADMIN-COST-001 | 成本估算配置 | Stage 3 | S3-2 |
| F-ADMIN-PLAT-001 | 租户生命周期管理 | Stage 3 | S3-3 |
| F-ADMIN-PLAT-002 | 租户级总配额上限配置 | Stage 3 | S3-3 |
| F-ADMIN-PLAT-003 | 平台全局配置 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-001 | 租户基础信息设置 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-002 | 品牌与主题设置 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-003 | 多语言默认与用户覆盖策略 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-004 | Webhook 配置与投递日志查看 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-005 | 外部观测平台配置 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-006 | 通知配置与保留期 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-007 | 系统公告管理 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-008 | 保留策略汇总视图 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-009 | Tenant 级文件上传策略配置 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-010 | 对话分享策略配置 | Stage 3 | S3-3 |
| F-ADMIN-SETTINGS-011 | API Key 管理 | Stage 3 | S3-3 |
| F-OPEN-001 | 平台 Open API | Stage 3 | S3-3 |
| F-OPEN-002 | Webhook 事件订阅与投递 | Stage 3 | S3-3 |
| F-I18N-001 | 多语言（中文/英文） | Stage 3 | S3-3 |
| F-BRAND-001 | 主题与品牌定制 | Stage 3 | S3-3 |
| F-A11Y-001 | 基础可访问性支持 | Stage 3 | S3-3 |
| F-NOTIF-001 | 站内通知中心 | Stage 3 | S3-3 |
| F-NOTIF-002 | 平台/租户系统公告广播 | Stage 3 | S3-3 |
| F-UX-001 | 响应式适配策略 | Stage 3 | S3-3 |
| F-REL-001 | 高可用与无单点部署 | Stage 3 | S3-3 |
| F-REL-002 | 关键体验与性能指标承诺 | Stage 3 | S3-3 |
| F-REL-003 | 规模容量承诺 | Stage 3 | S3-3 |
| F-REL-004 | 数据备份与恢复策略 | Stage 3 | S3-3 |

---

*文档结束*
