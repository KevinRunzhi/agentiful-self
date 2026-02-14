S2-1 统一网关最小协议

## 切片概述

这是 Phase 1 Stage 2 的第一个切片（S2-1），依赖 S1-3（应用入口与工作台）。S1-1~S1-3 已建立多租户认证、RBAC 授权、应用目录和配额管理。S2-1 的目标是建立统一接口网关层，为前端提供兼容 OpenAI API 规范的统一调用方式，屏蔽后端编排平台（Dify/Coze/n8n）的差异。

核心能力：
1. **OpenAI API 兼容调用入口**：对话 + 流式 + 最小工具调用
2. **统一错误处理**：一致的请求/响应/错误结构
3. **会话主键管理**：AgentifUI 统一生成会话 ID 并维护与后端的映射
4. **能力降级**：编排平台不可用时保持只读可用（历史/统计/审计）
5. **Trace 全链路**：每个请求注入 Trace ID，支持外部观测平台跳转

本切片完成后，前端将拥有统一的 AI 调用通道，为 S2-2 的对话 UI 提供后端接口基础。

## 覆盖的 Feature（共 7 个）

### P0 核心功能

- **F-GW-001** OpenAI API 兼容的统一调用入口：对前端提供 OpenAI 风格的统一调用接口，屏蔽后端平台差异。兼容范围以"最小可用集合"为承诺边界（对话 + 流式 + 最小工具调用），不承诺全量 OpenAI 能力。
- **F-GW-002** 统一错误处理与响应结构一致性：提供一致的请求/响应/错误语义，提升跨平台一致体验与可观测性。面向前端呈现为可解释错误提示。
- **F-GW-003** 会话主键统一生成与映射管理：平台统一生成会话主键，并维护与后端平台会话/执行标识的映射关系。不承诺跨平台可续聊迁移。
- **F-GW-004** 能力降级与只读可用性保障：在后端不支持或不可用时提供明确降级体验。覆盖：引用不可用、stop 不支持、工具调用不可用、编排平台不可用。生成入口需明确不可用提示。
- **F-GW-005** 身份与凭证传递边界：定义前端→网关与网关→后端的身份/凭证传递规则。前端发送平台登录态 + 身份声明；网关发送平台集成凭证。默认不透传用户在后端的 access_token。
- **F-OBS-001** Trace ID 全链路关联与展示：为每次 Run/请求提供 Trace 标识并在 UI 展示。Trace ID 由网关生成贯穿全链路，格式兼容 OpenTelemetry/W3C traceparent。UI 支持复制。

### P1 企业级增强

- **F-OBS-002** 外部观测平台跳转：支持配置外部观测平台 URL 模板并从运行记录一键跳转。全局默认 + Tenant 覆盖。未配置则仅提供复制 Trace。

## 与前置切片的接口依赖

### 依赖 S1-1/S1-2/S1-3 的能力（不重复实现）
- 用户认证和 JWT Token 校验（S1-1）
- RBAC 权限判定引擎（S1-2 checkPermission）
- AppGrant 应用授权校验（S1-2）
- Active Group 上下文（S1-2 X-Active-Group-ID 中间件）
- App 实体（S1-3 扩展后的完整 App 表）
- Quota 配额预检查（S1-3 quota-check.service）
- 审计事件写入管道（S1-2 audit.service）
- Trace ID 中间件（S1-2 trace.middleware）

### S2-1 新增/扩展的能力
- **GatewayRouter（新增）**：路由层，根据 App.externalPlatform 分发请求到不同后端适配器
- **PlatformAdapter 接口（新增）**：抽象后端平台适配器（DifyAdapter、CozeAdapter 等），统一对话/流式/stop 接口
- **SessionMapping（新增）**：会话 ID 映射表（platformSessionId, platformRunId, agentifuiConversationId）
- **SSE 流式通道（新增）**：Server-Sent Events 流式响应管道
- **ErrorNormalizer（新增）**：将各平台错误统一转换为 OpenAI 风格错误结构
- **DegradationGuard（新增）**：降级检测中间件，编排不可用时自动切换只读模式
- **ObservabilityConfig（新增）**：外部观测平台 URL 模板配置（tenantId, platformUrl, urlTemplate）

## 必须参考的文档

1. **docs/roadmap/PHASE1_BACKLOG.md** → 仅读 S2-1 章节
2. **docs/prd/PRD.md** → 读以下章节：
   - §5 系统架构与职责边界（§5.1~5.7，三层分工、网关能力、降级策略、凭证传递）
   - §7.4 Trace 与观测（Trace 归属、外部观测平台配置）
3. **docs/feature-list/feature-list.json** → 读 F-GW-001~005、F-OBS-001~002 共 7 个条目
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 读 §3.4 App 实体、§3.5 Conversation（会话主键字段）、§3.6 Run
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → 读 §3.1 S2-1 验收条目（AC-S2-1-01~05）
6. **specs/003-s1-3-app-workbench-quota/spec.md** → 了解已实现的 App 扩展字段和配额服务接口

## User Story 组织建议

- **US1（P0）OpenAI 兼容网关**：F-GW-001 + F-GW-002 + F-GW-005 → 建立统一的 OpenAI 风格 API 入口（/v1/chat/completions），支持对话和流式响应，统一错误结构，正确传递身份凭证到后端编排平台。
- **US2（P0）会话映射与追踪**：F-GW-003 + F-OBS-001 → AgentifUI 统一生成会话主键，维护与后端平台 ID 的映射关系。每个请求注入 Trace ID（W3C traceparent），在 Run 记录和 UI 中展示和可复制。
- **US3（P0）能力降级**：F-GW-004 → 当编排平台不可用时，系统自动检测并切换到降级模式：生成入口显示不可用提示，历史/统计/审计保持可用。针对 stop/引用/工具调用的降级分别处理。
- **US4（P1）外部观测集成**：F-OBS-002 → Tenant Admin 配置外部观测平台的 URL 模板（如 Grafana/Jaeger），用户可从 Run 记录页一键跳转到外部平台查看详细 Trace。

## Edge Cases 提示

- **后端平台超时**：请求后端 30 秒无响应 → 返回 504 + 统一错误结构 + 记录 Trace
- **SSE 连接中断**：网络断开或后端异常关闭 SSE 流 → 前端展示已生成内容 + 错误提示 + 自动重连策略
- **多平台并存**：同一 Tenant 下不同 App 对接不同后端（Dify + Coze）→ 路由层按 App.externalPlatform 分发
- **会话映射缺失**：用户请求一个没有映射记录的会话 → 尝试向后端回源查询，失败则返回 404
- **降级状态检测**：如何判断编排平台"不可用"？→ 健康检查 + 连续 N 次请求失败（Circuit Breaker）
- **Trace ID 格式校验**：前端携带非法 traceparent header → 网关忽略并重新生成
- **凭证过期**：平台集成凭证（API Key/Token）过期 → 返回 502 + 可解释错误 + 审计记录

## 边界约束

- ❌ 不涉及对话 UI 渲染（属于 S2-2）
- ❌ 不涉及 Run 状态机和持久化（属于 S2-3）
- ❌ 不涉及 OpenAI 全量能力（v1.0 仅最小可用集合）
- ❌ 不涉及跨平台可续聊迁移
- ❌ 不涉及应用注册/编辑（属于 S3-1 管理后台）
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
