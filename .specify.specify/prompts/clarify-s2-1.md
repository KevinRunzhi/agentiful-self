请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

---

## 一、网关协议与 API 设计（3 个澄清点）

### Q1：OpenAI 兼容的"最小可用集合"具体包含哪些 API？
- **影响级别**：🔴 高
- **文档依据**：PRD §5.4（最小可用集合：对话 + 流式 + 最小工具调用）
- **澄清结论**：
  - `POST /v1/chat/completions`：非流式对话
  - `POST /v1/chat/completions` with `stream: true`：SSE 流式对话
  - 请求体兼容 OpenAI ChatCompletion 格式：model、messages、stream、temperature、max_tokens、tools（最小集）
  - 响应体兼容 OpenAI ChatCompletion / ChatCompletionChunk 格式
  - **不实现**：Embeddings、Images、Audio、Files、Assistants、Batch 等 API
- **对 spec 的更新**：在 FR 中明确列出 API 端点和兼容字段

### Q2：统一错误结构的具体格式？
- **影响级别**：🟡 中
- **文档依据**：F-GW-002（面向前端的可解释错误提示）
- **澄清结论**：
  - 兼容 OpenAI 错误格式：`{ "error": { "message": string, "type": string, "code": string, "param"?: string } }`
  - 扩展字段：`traceId`、`degraded`（是否降级状态）
  - 错误类型映射：后端超时 → 504/timeout、后端拒绝 → 502/upstream_error、权限不足 → 403/permission_denied、配额超限 → 429/quota_exceeded、降级 → 503/service_degraded
  - 前端根据 `type` 展示本地化错误信息
- **对 spec 的更新**：在 FR 中定义错误响应结构和状态码映射

### Q3：网关层的请求处理管线是什么？
- **影响级别**：🔴 高
- **文档依据**：PRD §5.2~5.3（三层职责分工）
- **澄清结论**：
  - **管线顺序**：认证 → Trace 注入 → Active Group 解析 → 权限判定 → 配额预检查 → 平台路由 → 适配器调用 → 响应标准化 → 配额扣减（异步）→ 审计记录（异步）
  - **前 5 步**复用 S1-1~S1-3 已有中间件
  - **后 4 步**为 S2-1 新增能力
  - 任一步骤失败则短路返回统一错误结构
- **对 spec 的更新**：在 FR 中增加请求管线说明

---

## 二、后端平台适配（3 个澄清点）

### Q4：v1.0 需要适配哪些后端平台？
- **影响级别**：🟡 中
- **文档依据**：PRD §5.2（支持 Dify / Coze / n8n / LangChain 等）
- **澄清结论**：
  - **v1.0 必须适配**：Dify（首要目标，API 文档完善）
  - **v1.0 预留接口**：Coze、n8n（实现 PlatformAdapter 抽象接口，但不实现具体适配）
  - **适配器接口**：`sendMessage()`、`streamMessage()`、`stopGeneration()`、`getConversation()`
  - **选择逻辑**：根据 App.externalPlatform 字段路由到对应适配器
- **对 spec 的更新**：在 FR 中明确适配器抽象接口和首期实现范围

### Q5：会话 ID 映射的存储和生命周期？
- **影响级别**：🟡 中
- **文档依据**：F-GW-003（会话主键统一生成与映射管理）
- **澄清结论**：
  - **AgentifUI 会话 ID**：使用 Conversation.id（UUID），由前端或网关创建
  - **映射存储**：Conversation 表已有 externalId 字段存储后端平台会话 ID
  - **映射时机**：首次向后端发送消息时，后端返回其会话 ID，写入 Conversation.externalId
  - **查询**：后续请求通过 Conversation.externalId 关联到后端
  - **不新建表**：复用已有 Conversation.externalId，无需独立 SessionMapping 表
- **对 spec 的更新**：在 Key Entities 中说明 Conversation.externalId 的用法

### Q6：SSE 流式响应的具体协议？
- **影响级别**：🔴 高
- **文档依据**：PRD §5.4 + F-GW-001（流式返回一致性）
- **澄清结论**：
  - **协议**：标准 Server-Sent Events，Content-Type: text/event-stream
  - **消息格式**：每个 chunk 为 `data: {json}\n\n`，兼容 OpenAI 的 ChatCompletionChunk
  - **结束标记**：`data: [DONE]\n\n`
  - **心跳**：每 15 秒发送 `: heartbeat\n\n` 保持连接
  - **超时**：客户端 60 秒无数据（含心跳）视为断开
  - **背压**：如果前端消费速度跟不上后端产出速度 → 网关不做缓冲，直接透传
- **对 spec 的更新**：在 FR 中定义 SSE 协议细节

---

## 三、降级策略（2 个澄清点）

### Q7：4 类降级场景的具体处理方式？
- **影响级别**：🟡 中
- **文档依据**：PRD §5.5（能力降级策略）；F-GW-004
- **澄清结论**：
  - **编排平台不可用**：
    - 对话入口：禁用，显示"AI 服务暂不可用"
    - 历史/统计/审计：正常可用
    - 检测方式：Circuit Breaker（连续 5 次失败或 30s 内 3 次超时 → 开启降级，60s 后半开探测）
  - **不支持引用**：隐藏引用区域，不显示相关 UI
  - **不支持 stop**：按钮仍存在但执行软停止（停止渲染 + 提示"后端仍可能执行"）
  - **不支持工具调用**：降级为文本提示，显示"结构化交互不可用"
- **对 spec 的更新**：在 FR 中增加降级矩阵

### Q8：降级状态如何通知前端？
- **影响级别**：🟡 中
- **文档依据**：PRD §5.5
- **澄清结论**：
  - **API 响应**：在错误响应中增加 `degraded: true` 字段
  - **前端轮询**：提供 `GET /api/v1/gateway/health` 端点，返回各后端平台的可用状态
  - **健康检查格式**：`{ "platforms": { "dify": { "status": "available|degraded|unavailable", "lastCheckedAt": "..." } } }`
  - **前端行为**：检测到降级后，禁用对话入口 + 显示降级 Banner
- **对 spec 的更新**：在 FR 中定义健康检查 API

---

## 四、Trace 与观测（2 个澄清点）

### Q9：Trace ID 生成策略和格式？
- **影响级别**：🟡 中
- **文档依据**：PRD §7.4（兼容 OpenTelemetry/W3C traceparent）；F-OBS-001
- **澄清结论**：
  - **生成位置**：网关层（S2-1 新增，升级 S1-2 的 trace.middleware）
  - **格式**：W3C traceparent: `00-{trace-id}-{span-id}-{trace-flags}`
  - **传递**：
    - 前端 → 网关：可选携带 traceparent header（续接外部 trace）
    - 网关 → 后端：在请求头中传递 traceparent
    - 响应 → 前端：在响应头和响应体中返回 traceId
  - **存储**：写入 Run.traceId 和 Message.traceId
  - **复用 S1-2 的 trace.middleware**：升级为支持 W3C 格式（S1-2 用的是简单 UUID）
- **对 spec 的更新**：在 FR 中定义 Trace 格式和传递规则

### Q10：外部观测平台 URL 模板格式？
- **影响级别**：🟢 低
- **文档依据**：F-OBS-002（URL 模板 + 一键跳转）；PRD §7.4
- **澄清结论**：
  - **模板格式**：`https://grafana.example.com/explore?traceId=${traceId}`
  - **变量**：`${traceId}`、`${spanId}`、`${startTime}`、`${endTime}`
  - **配置层级**：全局默认 + Tenant 覆盖
  - **存储**：Tenant.customConfig.observability.urlTemplate（复用 Tenant.customConfig jsonb 字段）
  - **API**：`GET /api/v1/observability/trace-url?traceId=xxx` 返回渲染后的跳转 URL
- **对 spec 的更新**：在 FR 中定义 URL 模板配置

---

## 五、凭证与安全（2 个澄清点）

### Q11：平台集成凭证如何管理？
- **影响级别**：🟡 中
- **文档依据**：PRD §5.6（前端→网关→后端凭证传递）；F-GW-005
- **澄清结论**：
  - **凭证类型**：API Key（Dify 使用 Bearer Token）
  - **存储**：App.config jsonb 字段中，格式 `{ "apiKey": "encrypted_value", "baseUrl": "https://..." }`
  - **加密**：使用 AES-256-GCM 加密存储，运行时解密
  - **传递**：网关从 App.config 读取凭证，在请求后端时注入 Authorization header
  - **不透传用户 Token**：用户的 JWT Token 不传给后端，仅用于网关层鉴权
- **对 spec 的更新**：在 Key Entities 中说明 App.config 凭证结构

### Q12：网关是否需要独立的速率限制？
- **影响级别**：🟢 低
- **文档依据**：DOMAIN_MODEL App.apiRpm 字段
- **澄清结论**：
  - **v1.0**：复用配额系统（S1-3）做使用量限制，不单独实现 RPM 速率限制
  - **App.apiRpm 字段**：保留但默认值 0（不限制），实际速率限制在 S3-3 Open API 中实现
  - **防滥用**：依靠配额超限拦截 + 认证校验，不额外加限流中间件
- **对 spec 的更新**：在边界约束中说明速率限制不在 S2-1 范围
