S2-2 流式对话与执行追踪

## 切片概述

这是 Phase 1 Stage 2 的第二个切片（S2-2），依赖 S2-1（统一网关最小协议）。S2-1 已建立 OpenAI 兼容的网关 API、SSE 流式通道、降级策略和 Trace 机制。S2-2 的目标是在此基础上实现完整的对话用户体验：

1. **核心对话**：用户发起多轮实时对话，接收流式响应，停止生成
2. **对话管理**：对话历史列表、搜索、重命名、删除、固定、归档
3. **消息交互**：复制、编辑重发、重新生成、赞/踩反馈
4. **内容增强**：LaTeX 数学公式渲染、AI 推荐下一问题
5. **文件处理**：上传/下载/预览（50MB P95 ≤ 10s）
6. **高级能力**：Artifacts 产物管理、HITL 结构化交互、对话只读分享

本切片完成后，用户将能够完成完整的 AI 对话体验，这是整个产品的核心用户价值。

## 覆盖的 Feature（共 11 个）

### P0 核心功能

- **F-CHAT-001** 实时文本对话：用户可进行多轮实时对话交互并获取 AI 回复。统一体验屏蔽底层平台差异。首 Token 时间 P95 ≤ 1.5s。
- **F-CHAT-002** 流式响应展示：支持以流式方式展示生成内容，提升响应体感。与停止生成联动。
- **F-CHAT-005** 停止生成：用户可停止生成。后端支持则取消执行（硬停），否则停止渲染并提示"后端仍可能执行"（软停）。点击后 ≤ 500ms 停止渲染。必须可追溯审计。
- **F-CHAT-006** 对话会话管理：提供对话列表与会话级管理能力——搜索、重命名、删除、固定、归档/分组。

### P1 企业级增强

- **F-CHAT-003** 数学公式渲染：在对话内容中支持 LaTeX 数学公式渲染展示。
- **F-CHAT-007** 对话只读分享链接：生成可撤销的只读分享链接。启用登录（默认）时仅同 Tenant/同 Group 可见；关闭登录则为公开链接。默认永久有效直至撤销，Tenant 可配置有效期。
- **F-CHAT-008** 消息交互与反馈：提供消息维度的交互能力——复制、编辑重发、重新生成、赞/踩反馈。
- **F-FILE-001** 文件上传/下载/预览：支持在对话中上传文件并下载或预览结果文件。单文件默认 50MB（可配 ≤ 200MB）；单次默认 10 个（可配 ≤ 20 个）；保留期默认 90 天。配置层级：Tenant 级默认值 → 应用级可收紧。

### P2 高级能力

- **F-CHAT-004** AI 推荐下一问题：在对话中提供下一步问题建议以提升完成任务效率。
- **F-ART-001** Artifacts 产物管理与预览：将代码/文档/可视化从对话中抽离为可管理产物。每次输出自动生成草稿，用户显式保存为稳定版本。草稿最近 10 个，超出自动清理。可执行内容预览以安全为先（沙箱）。
- **F-HITL-001** Human-in-the-loop 结构化交互：支持确认/选择/审批/补充信息等受控交互。前端只渲染与回传；协议 schema 统一且来自后端结构化输出；不扩展为低代码编排。

## 与前置切片的接口依赖

### 依赖 S2-1 的能力（不重复实现）
- OpenAI 兼容 API 入口（POST /v1/chat/completions）
- SSE 流式响应通道
- 统一错误结构
- PlatformAdapter 后端适配器
- DegradationGuard 降级检测
- Trace ID 注入和传递

### 依赖 S1-1~S1-3 的能力（不重复实现）
- 用户认证和 JWT Token、RBAC 权限判定
- Active Group 上下文、应用授权
- 配额预检查和扣减
- 审计事件写入

### S2-2 新增/扩展的数据实体
- **Conversation（S2-2 激活使用）**：S1-3 已定义但未完整使用，S2-2 激活全部字段（title、status、pinned、clientId、inputs）
- **Message（新增）**：会话中的单条消息（role、content、contentParts、metadata、model、provider、traceId、clientId、error）
- **MessageFeedback（新增）**：消息反馈（messageId、userId、rating=like/dislike、comment）
- **ConversationShare（新增）**：对话分享链接（conversationId、shareCode、permission、requireLogin、expiresAt、createdBy）
- **FileAttachment（新增）**：文件附件（messageId、fileName、fileType、fileSize、storageUrl、scanStatus、retainUntil）
- **Artifact（新增）**：对话产物（conversationId、messageId、type=code/document/visualization、title、content、version、isDraft、createdAt）

## 必须参考的文档

1. **docs/roadmap/PHASE1_BACKLOG.md** → S2-2 章节
2. **docs/prd/PRD.md** → 读以下章节：
   - §6 核心使用体验（§6.1~6.9 全部，对话、文件、停止生成、Artifacts、HITL、持久化、验收标准）
3. **docs/feature-list/feature-list.json** → 读 F-CHAT-001~008、F-FILE-001、F-ART-001、F-HITL-001 共 11 个条目
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 读 §3.5 对话与消息（Conversation/Message 完整字段和 contentParts 结构）
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → §3.2 S2-2 验收条目（AC-S2-2-01~06）
6. **specs/003-s1-3-app-workbench-quota/spec.md** → 了解 Conversation 表已有字段
7. **specs/004-unified-gateway/spec.md**（如果已生成）→ 了解网关 API 和 SSE 协议

## User Story 组织建议

- **US1（P0）实时流式对话**：F-CHAT-001 + F-CHAT-002 + F-CHAT-005 → 用户选择应用后发起对话，输入文本，实时接收 AI 流式响应。可随时停止生成（硬停/软停），首 Token P95 ≤ 1.5s。
- **US2（P0）对话会话管理**：F-CHAT-006 → 用户在侧边栏查看对话历史列表，可搜索/重命名/删除/固定/归档会话。
- **US3（P1）消息交互与内容增强**：F-CHAT-008 + F-CHAT-003 + F-CHAT-004 → 消息气泡支持复制、编辑重发、重新生成、赞/踩反馈。对话内容支持 LaTeX 公式渲染。AI 在回复后推荐 2-3 个后续问题。
- **US4（P1）文件处理与对话分享**：F-FILE-001 + F-CHAT-007 → 用户可在对话中上传文件（50MB P95 ≤ 10s），下载/预览结果文件。可生成只读分享链接并配置可见范围和有效期。
- **US5（P2）Artifacts 与 HITL**：F-ART-001 + F-HITL-001 → AI 产出的代码/文档自动提取为 Artifact 草稿，用户可保存为稳定版本并导出。后端返回结构化交互（确认/选择/审批）时，前端渲染对应 UI 并回传选择结果。

## Edge Cases 提示

- **流式中断恢复**：流式响应中途断开 → 前端展示已接收的部分内容 + 错误提示 + 可重新生成
- **编辑重发历史分叉**：用户编辑第 3 条消息重新发送 → 后续消息标记为 overridden（不删除），新分支从编辑点开始
- **并发对话**：用户在多个标签页同时进行不同对话 → 每个对话独立管理，状态互不干扰
- **分享链接权限校验**：A 用户分享给 B，但 B 不在同 Tenant → 启用登录模式下拒绝访问
- **文件类型校验**：上传可执行文件（.exe/.sh）→ 根据白名单拒绝并提示
- **Artifact 草稿溢出**：草稿超过 10 个 → 自动清理最早的草稿，保留最近 10 个
- **HITL 超时**：后端等待用户响应 HITL 选择超时 → 取消当前 Run + 提示
- **停止生成后的 Token 计量**：用户停止后后端可能仍在执行 → 实际消耗的 Token 仍需计量扣费
- **大文件上传中断**：200MB 文件上传到一半网络断开 → 不支持断点续传（v1.0），需重新上传

## 边界约束

- ❌ 不涉及 Agent/Workflow Run 执行状态（属于 S2-3）
- ❌ 不涉及 RAG 引用结果展示（属于 S2-3）
- ❌ 不涉及数据持久化策略和回源同步（属于 S2-3）
- ❌ 不涉及对话内容安全检测（属于 S2-3 的 F-SEC-001）
- ❌ 不涉及对话的管理后台管理（属于 S3-1）
- ❌ 不涉及网盘功能（文件仅用于对话输入和结果交付）
- ❌ 不涉及 HITL 低代码编排能力
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
