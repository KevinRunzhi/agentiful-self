# AgentifUI 网关契约 v0

* **规范版本**：v0.1
* **最后更新**：2026-01-26
* **状态**：草稿，待评审
* **参考**：OpenAI Chat Completions API + Dify Service API + LibreChat

---

## 1. 概述

本文档定义 AgentifUI 统一接口网关的 API 契约，作为前端与后端编排平台之间的协议规范。

### 设计目标

1. **OpenAI 兼容**：核心 API 兼容 OpenAI Chat Completions 规范
2. **统一体验**：屏蔽底层编排平台差异（Dify/Coze/n8n）
3. **可追踪**：全链路 Trace ID 支持
4. **可治理**：内置权限、配额、审计能力

### 兼容范围（v1.0 最小集）

| 能力 | OpenAI 规范 | AgentifUI 支持 |
|------|-------------|----------------|
| 对话消息 | `POST /v1/chat/completions` | ✅ 完整支持 |
| 流式响应 | `stream: true` | ✅ 完整支持 |
| 停止生成 | 无标准定义 | ✅ 自定义扩展 |
| 模型列表 | `GET /v1/models` | ✅ 返回可用应用 |
| 函数调用 | `tools` / `function_call` | ⚠️ 透传，不解析 |
| 图片输入 | `content: [image_url]` | ⚠️ 依赖后端能力 |
| 嵌入向量 | `POST /v1/embeddings` | ❌ Out of Scope |
| 文件上传 | `POST /v1/files` | ❌ 使用平台 API |

---

## 2. API 端点

### 2.1 对话完成

#### `POST /v1/chat/completions`

创建对话完成，支持阻塞和流式响应。

**请求头**：

| Header | 必填 | 说明 |
|--------|------|------|
| `Authorization` | ✅ | `Bearer {token}` |
| `X-Active-Group-ID` | ⚠️ | 多群组用户必填，配额归因 |
| `X-Trace-ID` | ❌ | 客户端 Trace ID（可选，网关会生成） |
| `Content-Type` | ✅ | `application/json` |

**请求体**：

```typescript
interface ChatCompletionRequest {
  // 应用标识（AgentifUI 扩展）
  app_id: string;                          // 必填，应用 ID
  
  // OpenAI 兼容字段
  messages: Message[];                     // 必填，消息列表
  model?: string;                          // 可选，模型名称（用于展示）
  stream?: boolean;                        // 可选，默认 false
  max_tokens?: number;                     // 可选，最大输出 token
  temperature?: number;                    // 可选，温度
  top_p?: number;                          // 可选，采样参数
  
  // 工具调用（透传）
  tools?: Tool[];                          // 可选，工具定义
  tool_choice?: 'auto' | 'none' | object;  // 可选，工具选择
  
  // AgentifUI 扩展字段
  conversation_id?: string;                // 可选，会话 ID（续聊）
  inputs?: Record<string, any>;            // 可选，应用输入变量
  files?: FileReference[];                 // 可选，上传文件引用
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

interface FileReference {
  type: 'local' | 'remote';
  url?: string;                            // remote URL
  file_id?: string;                        // local file ID
  transfer_method: 'local_file' | 'remote_url';
}
```

**响应（阻塞模式）**：

```typescript
interface ChatCompletionResponse {
  id: string;                              // 消息 ID
  object: 'chat.completion';
  created: number;                         // Unix 时间戳
  model: string;                           // 使用的模型
  
  choices: [{
    index: 0;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }];
  
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  
  // AgentifUI 扩展
  conversation_id: string;                 // 会话 ID
  trace_id: string;                        // Trace ID
  metadata?: {
    citations?: Citation[];                // 引用来源
    artifacts?: Artifact[];                // 生成产物
  };
}
```

**响应（流式模式）**：

当 `stream: true` 时，返回 SSE（Server-Sent Events）流：

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Trace-ID: {trace_id}
```

**SSE 事件格式**：

```
data: {"id":"msg_xxx","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"msg_xxx","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"msg_xxx","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]
```

**AgentifUI 扩展事件**（可选）：

```
event: agentif.metadata
data: {"conversation_id":"conv_xxx","trace_id":"xxx"}

event: agentif.citation
data: {"citations":[{"source":"doc.pdf","content":"..."}]}

event: agentif.artifact
data: {"artifact":{"id":"art_xxx","type":"code","language":"python","content":"..."}}

event: agentif.human_input_required
data: {"type":"confirmation","message":"是否继续执行?","options":["是","否"]}
```

---

### 2.2 停止生成

#### `POST /v1/chat/completions/{task_id}/stop`

停止正在执行的生成任务。

**请求头**：同 2.1

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| task_id | string | 任务 ID（从流式响应的 `id` 获取） |

**请求体**：无

**响应**：

```json
{
  "result": "success",
  "stop_type": "hard" | "soft"
}
```

**stop_type 说明**：
- `hard`：后端已终止执行
- `soft`：后端不支持停止，仅停止渲染

---

### 2.3 应用列表

#### `GET /v1/models`

获取用户可访问的应用列表（兼容 OpenAI `/v1/models`）。

**请求头**：

| Header | 必填 | 说明 |
|--------|------|------|
| `Authorization` | ✅ | `Bearer {token}` |
| `X-Active-Group-ID` | ❌ | 可选，按群组筛选 |

**响应**：

```typescript
interface ModelsResponse {
  object: 'list';
  data: AppModel[];
}

interface AppModel {
  id: string;                              // 应用 ID
  object: 'model';
  created: number;                         // 创建时间戳
  owned_by: string;                        // 租户 ID
  
  // AgentifUI 扩展
  name: string;                            // 应用名称
  description?: string;                    // 描述
  mode: 'chat' | 'workflow' | 'agent' | 'completion';
  icon?: string;                           // 图标 URL
  capabilities: {
    streaming: boolean;
    stop: boolean;
    tools: boolean;
    files: boolean;
    citations: boolean;
  };
}
```

---

### 2.4 会话管理

#### `GET /v1/conversations`

获取用户的会话列表。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| app_id | string | 可选，按应用筛选 |
| limit | number | 可选，返回数量，默认 20 |
| cursor | string | 可选，分页游标 |

**响应**：

```typescript
interface ConversationsResponse {
  object: 'list';
  data: Conversation[];
  has_more: boolean;
  next_cursor?: string;
}

interface Conversation {
  id: string;
  app_id: string;
  title: string;
  status: 'active' | 'archived';
  message_count: number;
  created_at: string;
  updated_at: string;
}
```

---

#### `GET /v1/conversations/{id}/messages`

获取会话的消息历史。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| limit | number | 可选，返回数量，默认 50 |
| before | string | 可选，在此消息 ID 之前 |

**响应**：

```typescript
interface MessagesResponse {
  object: 'list';
  data: MessageItem[];
  has_more: boolean;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string;
  created_at: string;
  metadata?: {
    trace_id?: string;
    tokens?: { prompt: number; completion: number };
    citations?: Citation[];
  };
}
```

---

## 3. 错误响应

### 3.1 错误格式

所有错误响应遵循统一格式：

```typescript
interface ErrorResponse {
  error: {
    message: string;                       // 人类可读错误描述
    type: string;                          // 错误类型
    code: string;                          // 错误代码
    param?: string;                        // 相关参数
    trace_id?: string;                     // Trace ID（便于排查）
  };
}
```

### 3.2 错误代码

| HTTP 状态码 | type | code | 说明 |
|-------------|------|------|------|
| 400 | `invalid_request_error` | `invalid_app_id` | 应用 ID 无效 |
| 400 | `invalid_request_error` | `invalid_conversation_id` | 会话 ID 无效 |
| 400 | `invalid_request_error` | `invalid_messages` | 消息格式错误 |
| 401 | `authentication_error` | `invalid_token` | Token 无效或过期 |
| 403 | `permission_denied` | `app_not_authorized` | 无应用访问权限 |
| 403 | `permission_denied` | `quota_exceeded` | 配额已用尽 |
| 404 | `not_found_error` | `app_not_found` | 应用不存在 |
| 404 | `not_found_error` | `conversation_not_found` | 会话不存在 |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | 请求频率超限 |
| 500 | `internal_error` | `provider_error` | 后端编排平台错误 |
| 503 | `service_unavailable` | `provider_unavailable` | 后端编排平台不可用 |

### 3.3 错误示例

```json
{
  "error": {
    "message": "You have exceeded your quota limit. Please contact your administrator.",
    "type": "permission_denied",
    "code": "quota_exceeded",
    "trace_id": "tr_abc123xyz"
  }
}
```

---

## 4. Trace ID 规范

### 4.1 生成规则

Trace ID 由网关生成，格式遵循 W3C Trace Context 规范：

```
traceparent: 00-{trace_id}-{span_id}-{flags}

示例: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

### 4.2 传递方式

| 阶段 | 传递方式 |
|------|----------|
| 客户端 → 网关 | `X-Trace-ID` 请求头（可选） |
| 网关 → 服务 | `traceparent` 请求头 |
| 网关 → 客户端 | `X-Trace-ID` 响应头 + 响应体 `trace_id` 字段 |
| 流式响应 | SSE `agentif.metadata` 事件 |

### 4.3 跳转模板

外部观测平台跳转 URL 模板：

```
{observability_url}/trace/{trace_id}
```

---

## 5. 认证与授权

### 5.1 认证方式

| 方式 | 场景 | Header |
|------|------|--------|
| Bearer Token | 用户登录态 | `Authorization: Bearer {jwt}` |
| API Key | 系统集成 | `Authorization: Bearer {api_key}` |

### 5.2 JWT Claims

```typescript
interface JWTClaims {
  sub: string;           // 用户 ID
  tenant_id: string;     // 租户 ID
  email: string;
  roles: string[];       // 角色列表
  iat: number;
  exp: number;
}
```

### 5.3 权限检查

每个请求网关执行以下检查：

1. **AuthN**：验证 Token 有效性
2. **AuthZ**：检查用户对 `app_id` 的访问权限
3. **Quota**：检查用户/群组配额
4. **Rate Limit**：检查请求频率

---

## 6. 降级处理

### 6.1 后端不可用

当后端编排平台不可用时：

```json
{
  "error": {
    "message": "The AI service is temporarily unavailable. Please try again later.",
    "type": "service_unavailable",
    "code": "provider_unavailable",
    "trace_id": "tr_xxx"
  }
}
```

前端应：
- 保持登录、导航、历史可用
- 生成入口显示不可用提示

### 6.2 不支持停止

当后端不支持停止时，`/stop` 返回：

```json
{
  "result": "success",
  "stop_type": "soft"
}
```

前端应：
- 立即停止渲染
- 提示 "后端可能仍在执行"

---

## 7. 与 Dify API 对比

| 能力 | AgentifUI Gateway | Dify Service API |
|------|-------------------|------------------|
| 端点 | `/v1/chat/completions` | `/chat-messages` |
| 流式参数 | `stream: true` | `response_mode: "streaming"` |
| 停止端点 | `/{task_id}/stop` | `/{task_id}/stop` |
| Trace ID | `X-Trace-ID` 请求头 | `external_trace_id` 请求体 |
| 会话 ID | `conversation_id` | `conversation_id` |
| 文件 | `files` 数组 | `files` 数组 |
| 输入变量 | `inputs` | `inputs` |

---

## 8. 待确认项

> [!IMPORTANT]
> 以下设计决策需在 FRD 阶段确认：

1. **Human-in-the-loop schema**：HITL 事件的具体结构定义
2. **Artifact types**：支持的 Artifact 类型枚举
3. **Rate limiting 策略**：具体的限流规则配置
4. **Webhook 回调**：是否需要 Webhook 推送 API

---

## 附录 A：相关文档

- [系统边界与职责图](../architecture/SYSTEM_BOUNDARY.md)
- [核心领域模型 v0](../data-model/DOMAIN_MODEL_P1.md)
- [审计事件 v0](../security/AUDIT_EVENTS_P1.md)（待创建）
