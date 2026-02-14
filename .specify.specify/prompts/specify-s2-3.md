S2-3 执行状态与数据持久化

## 切片概述

这是 Phase 1 Stage 2 的第三个切片（S2-3），依赖 S2-2（流式对话与执行追踪）。S2-2 已实现完整的对话用户体验（流式对话、消息交互、文件上传、Artifacts）。S2-3 的目标是在此基础上完成最后三大能力：

1. **Agent/Workflow 运行**：支持多种 Run 类型（Workflow Run / Agent Run / Generation Run）的统一触发和结果展示
2. **执行状态追踪**：Run 状态机（pending → running → completed/failed/stopped），≤ 3s 反映到 UI
3. **数据持久化**：会话与执行数据的本地持久化、回源同步与降级展示
4. **安全控制**：提示词注入检测、会话隔离与应用上下文隔离

本切片完成后，Stage 2 的全部能力就位，用户可完成完整的 AI 应用交互闭环。

## 覆盖的 Feature（共 9 个）

### P0 核心功能

- **F-APP-002** 运行 Agent/Workflow：用户可在应用入口触发 Agent/Workflow 运行并查看状态与结果。覆盖 Chatbot/Chatflow/Agent/Workflow 等不同模式。
- **F-RUN-001** Run 类型统一入口：为 Workflow Run / Agent Run / Generation Run 提供一致的运行记录入口与展示体验。可查看状态/耗时/Token/失败原因等信息。
- **F-RUN-002** 执行状态展示：展示待处理/运行中/已完成/失败/已停止等状态并及时更新。状态变更 ≤ 3s 反映到 UI。
- **F-RUN-003** 执行详情与失败原因呈现：提供步骤数、耗时、Token 使用量、失败原因等执行详情展示。
- **F-DATA-001** 会话与执行数据本地持久化：平台本地持久化会话与执行数据，支撑历史、统计与审计。默认永久保存。应用删除后历史只读保留并标识"已删除/不可用"。
- **F-SEC-002** 会话隔离与应用上下文隔离：提供用户之间会话隔离与应用之间上下文隔离，避免串话与跨域引用。不启用跨应用引用历史/统一记忆。

### P1 企业级增强

- **F-APP-003** RAG 引用结果展示：在 AI 回复中展示 RAG 引用来源，用户可查看来源摘要和原文链接。
- **F-DATA-002** 数据回源同步与降级：支持在本地缺失、用户请求或管理员校验时向后端回源同步，失败时降级展示本地已有数据并提示不完整。
- **F-SEC-001** 提示词注入检测策略：提供注入风险检测与可配置处置策略（记录/告警/拦截）。默认记录 + 告警；Tenant 可配置拦截。

## 与前置切片的接口依赖

### 依赖 S2-2 的能力（不重复实现）
- 对话 UI 和消息渲染引擎（Message 组件、contentParts 渲染器）
- SSE 流式响应前端处理
- 文件上传/下载通道
- Artifacts 产物管理框架

### 依赖 S2-1 的能力（不重复实现）
- PlatformAdapter 后端适配器接口
- SSE 通道和错误标准化
- Trace ID 注入

### 依赖 S1-1~S1-3 的能力（不重复实现）
- 认证、RBAC、Active Group、配额检查/扣减、审计

### S2-3 新增/扩展的数据实体
- **Run（新增）**：执行记录（conversationId、appId、userId、type=workflow|agent|generation、trigger=user|api|schedule、status=pending|running|completed|failed|stopped、startedAt、finishedAt、duration、inputTokens、outputTokens、totalTokens、model、error、traceId）
- **RunStep（新增）**：执行步骤（runId、stepIndex、nodeId、nodeType、status、startedAt、finishedAt、duration、inputTokens、outputTokens、error）
- **DataSyncLog（新增）**：数据回源同步日志（tenantId、conversationId、syncType=full|incremental、status=pending|syncing|completed|failed、triggeredBy=auto|user|admin、error、createdAt）
- **PromptInjectionLog（新增）**：注入检测记录（tenantId、userId、conversationId、messageId、riskScore、riskType、action=log|alert|block、raw、createdAt）

## 必须参考的文档

1. **docs/roadmap/PHASE1_BACKLOG.md** → S2-3 章节
2. **docs/prd/PRD.md** → 读以下章节：
   - §6.8 数据持久化与一致性（保存策略、删除策略、应用删除后历史保留）
   - §6.9 验收式功能标准（Run 类型定义、状态机、Trace、Token 度量）
   - §8 安全与合规（§8.1 提示词注入检测、§8.2 PII 去敏、§8.3 输出合规）
   - §5 系统架构与职责边界（§5.5 降级策略中的数据回源部分）
3. **docs/feature-list/feature-list.json** → 读 F-APP-002~003、F-RUN-001~003、F-DATA-001~002、F-SEC-001~002 共 9 个条目
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 读 §3.6 Run/RunStep 实体完整定义
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → §3.3 S2-3 验收条目（AC-S2-3-01~05）

## User Story 组织建议

- **US1（P0）Agent/Workflow 运行**：F-APP-002 + F-RUN-001 → 用户从应用入口选择 Agent/Workflow 类应用，触发运行。系统创建 Run 记录，显示在统一运行记录列表中。可查看 Workflow Run、Agent Run 和 Generation Run。
- **US2（P0）执行状态追踪**：F-RUN-002 + F-RUN-003 → Run 状态实时更新（pending → running → completed/failed/stopped），≤ 3s 反映到 UI。用户可点击查看执行详情：步骤数、各步耗时、输入/输出 Token、失败原因、Trace ID。
- **US3（P0）数据持久化**：F-DATA-001 + F-SEC-002 → 会话数据和 Run 数据自动持久化到本地数据库。不同用户的会话严格隔离，不同应用的上下文严格隔离。应用被删除后，对应对话历史只读保留并标注"应用已删除"。
- **US4（P1）RAG 引用与数据回源**：F-APP-003 + F-DATA-002 → 在 AI 回复中展示知识库引用来源（摘要 + 链接）。本地数据缺失时自动回源同步，回源失败时展示已有数据并标注"数据可能不完整"。
- **US5（P1）安全检测**：F-SEC-001 → 用户发送的消息经过提示词注入检测。默认模式下仅记录日志并告警（不阻断对话），Tenant Admin 可配置为拦截模式（阻断并返回提示）。

## Edge Cases 提示

- **Run 状态不一致**：后端 Run 状态更新延迟，前端轮询 / WebSocket 获取不到最新状态 → 设置最大等待时间 + "刷新"按钮
- **Run 异常终止**：后端 Run 异常退出没有回调 → 定时轮询超时（默认 30 分钟无更新）→ 标记 status='failed' + error='timeout'
- **数据回源冲突**：本地数据和后端数据不一致 → 以后端为准，本地数据覆盖 + 审计记录
- **应用删除后的 Run**：用户查看已删除应用的历史 Run → 显示"应用已删除/不可用" + Run 详情只读
- **注入检测误报**：合法提示被误判为注入 → 记录风险分数和类型，Tenant Admin 可查看日志评估
- **并发 Run**：同一用户同时触发多个 Run → 每个 Run 独立状态，互不干扰
- **大 Token 量的 RunStep**：single RunStep 输出 100K+ Token → 分页展示详情
- **隔离边界验证**：用户 A 尝试访问用户 B 的会话 → API 层强制校验 userId + tenantId，返回 403
- **回源限流**：大量用户同时触发回源 → 限流 + 排队，避免对后端平台造成压力

## 边界约束

- ❌ 不涉及对话 UI 渲染（复用 S2-2 已完成的对话组件）
- ❌ 不涉及创建/编辑/发布编排能力（Out-of-Scope，AgentifUI 不做编排）
- ❌ 不涉及跨应用引用历史/统一记忆（边界声明，明确不支持）
- ❌ 不涉及管理后台对 Run/数据的管理功能（属于 S3-1）
- ❌ 不涉及 PII 去敏（属于 S3-2 的 F-SEC-003）
- ❌ 不涉及输出内容合规检测（属于 S3-2 的 F-SEC-004）
- ❌ 不涉及审计日志查询/导出 UI（属于 S3-2）
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
