# Gateway 内部 API 契约

* **规范版本**：v0.1
* **最后更新**：2026-01-27
* **状态**：草稿
* **关联**：[GATEWAY_CONTRACT_P1.md](../../tech/api-contracts/GATEWAY_CONTRACT_P1.md)（外部 API 契约）

---

## 1. 概述

本文档定义 **Gateway ↔ Core API** 之间的内部通信协议。这些 API 仅用于两个服务间的内部调用，不对外暴露。

### 设计原则

| 原则 | 说明 |
|------|------|
| **内部专用** | 仅限 Gateway 和 Core API 之间调用 |
| **Token 保护** | 使用内部 Token 认证，不走用户认证 |
| **最小权限** | 每个端点只暴露必要的信息 |
| **幂等设计** | 支持重试，不会产生副作用 |

---

## 2. 认证方式

所有内部 API 调用需携带内部 Token：

```
Authorization: Bearer {INTERNAL_API_TOKEN}
X-Request-ID: {trace_id}
```

**配置方式**：
- Gateway: `CORE_API_TOKEN` 环境变量
- Core API: `INTERNAL_API_TOKENS` 环境变量（支持多个 Token）

---

## 3. API 端点

### 3.1 授权检查

#### `POST /internal/authz`

检查用户对资源的操作权限。

**请求体**：

```typescript
interface AuthzRequest {
  user_id: string;          // 用户 ID
  tenant_id: string;        // 租户 ID
  group_ids: string[];      // 用户所属群组 ID
  resource_type: string;    // 资源类型: 'app' | 'conversation'
  resource_id: string;      // 资源 ID
  action: string;           // 操作: 'read' | 'write' | 'execute'
}
```

**响应体**：

```typescript
interface AuthzResponse {
  allowed: boolean;         // 是否允许
  reason?: string;          // 拒绝原因（仅当 allowed=false）
  cached_until?: string;    // 缓存过期时间（ISO 8601）
}
```

**响应示例**：

```json
// 成功
{
  "allowed": true,
  "cached_until": "2026-01-27T15:30:00Z"
}

// 失败
{
  "allowed": false,
  "reason": "User has no access to this app"
}
```

---

### 3.2 配额检查

#### `POST /internal/quota/check`

检查用户/群组的配额余量。

**请求体**：

```typescript
interface QuotaCheckRequest {
  user_id: string;              // 用户 ID
  tenant_id: string;            // 租户 ID
  group_id?: string;            // 群组 ID（可选，用于群组配额）
  resource_type: 'token' | 'request';  // 资源类型
  amount: number;               // 预计消耗量
}
```

**响应体**：

```typescript
interface QuotaCheckResponse {
  allowed: boolean;             // 是否有足够配额
  remaining: number;            // 剩余配额
  limit: number;                // 配额上限
  reset_at?: string;            // 重置时间（ISO 8601）
  reason?: string;              // 拒绝原因
}
```

---

### 3.3 配额扣减

#### `POST /internal/quota/deduct`

扣减用户/群组的配额。

**请求体**：

```typescript
interface QuotaDeductRequest {
  user_id: string;
  tenant_id: string;
  group_id?: string;
  resource_type: 'token' | 'request';
  amount: number;               // 实际消耗量
  trace_id: string;             // 关联的 Trace ID（用于审计）
}
```

**响应体**：

```typescript
interface QuotaDeductResponse {
  success: boolean;
  remaining: number;            // 扣减后剩余
}
```

---

### 3.4 用户信息查询

#### `GET /internal/users/{user_id}`

查询用户基本信息（用于审计日志等场景）。

**响应体**：

```typescript
interface UserInfoResponse {
  id: string;
  email: string;
  name?: string;
  tenant_id: string;
  roles: string[];
  status: 'active' | 'inactive' | 'suspended';
}
```

---

### 3.5 应用信息查询

#### `GET /internal/apps/{app_id}`

查询应用配置信息（用于路由决策）。

**响应体**：

```typescript
interface AppInfoResponse {
  id: string;
  name: string;
  tenant_id: string;
  backend: {
    type: 'dify' | 'coze' | 'n8n' | 'openai';
    endpoint: string;
    api_key_ref: string;        // 密钥引用（不返回明文）
  };
  capabilities: {
    streaming: boolean;
    stop: boolean;
    tools: boolean;
    files: boolean;
  };
  status: 'active' | 'inactive';
}
```

---

### 3.6 审计日志写入

#### `POST /internal/audit`

写入审计日志。

**请求体**：

```typescript
interface AuditEvent {
  trace_id: string;
  timestamp: string;            // ISO 8601
  
  actor: {
    type: 'user' | 'api_key' | 'system';
    id: string;
    tenant_id: string;
  };
  
  action: string;               // e.g., 'chat.completion.create'
  resource: {
    type: string;
    id: string;
  };
  
  outcome: 'success' | 'failure';
  reason?: string;
  
  request: {
    method: string;
    path: string;
    ip: string;
    user_agent?: string;
  };
  
  metadata?: Record<string, any>;
}
```

**响应体**：

```typescript
interface AuditResponse {
  id: string;                   // 审计记录 ID
  received: boolean;
}
```

> [!NOTE]
> Gateway 应采用 Fire-and-Forget 模式发送审计日志，不阻塞主请求。失败时本地缓存后重试。

---

## 4. 错误响应

所有内部 API 使用统一错误格式：

```typescript
interface InternalErrorResponse {
  error: {
    code: string;               // 错误码
    message: string;            // 错误描述
  };
}
```

**错误码**：

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 401 | `invalid_token` | 内部 Token 无效 |
| 403 | `forbidden` | 无权调用此端点 |
| 404 | `not_found` | 资源不存在 |
| 429 | `rate_limited` | 内部调用频率超限 |
| 500 | `internal_error` | 服务内部错误 |

---

## 5. 超时与重试

| 端点 | 超时 | 重试策略 |
|------|------|----------|
| `/internal/authz` | 2s | 2 次重试，指数退避 |
| `/internal/quota/check` | 2s | 2 次重试 |
| `/internal/quota/deduct` | 3s | 3 次重试（幂等） |
| `/internal/users/*` | 2s | 1 次重试 |
| `/internal/apps/*` | 2s | 1 次重试 |
| `/internal/audit` | 5s | 后台重试队列 |

---

## 6. 安全考虑

### 6.1 Token 管理

- 内部 Token 必须足够长（≥32 字符）且随机
- 定期轮换（建议每 90 天）
- 不同环境使用不同 Token

### 6.2 网络隔离

- 内部 API 端点应仅在内部网络可访问
- 生产环境通过 K8s NetworkPolicy 限制

### 6.3 日志脱敏

- 内部调用日志不记录 Token
- 不记录用户敏感数据

---

## 附录 A：端点汇总

| 端点 | 方法 | 用途 | Phase 1 |
|------|------|------|---------|
| `/internal/authz` | POST | 授权检查 | ✅ |
| `/internal/quota/check` | POST | 配额检查 | ❌ Phase 2 |
| `/internal/quota/deduct` | POST | 配额扣减 | ❌ Phase 2 |
| `/internal/users/{id}` | GET | 用户信息 | ⚠️ 可选 |
| `/internal/apps/{id}` | GET | 应用信息 | ⚠️ 可选 |
| `/internal/audit` | POST | 审计写入 | ✅ |

---

## 附录 B：版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v0.1 | 2026-01-27 | 初始版本 |
