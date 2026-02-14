# S1-3 API Contract

**Feature**: S1-3 应用入口与工作台  
**Version**: 0.1.0  
**Date**: 2026-02-13

## 1. Overview

本契约覆盖 S1-3 的两类接口：

1. 应用工作台接口（列表、搜索、收藏、最近使用）。  
2. 配额治理接口（检查、扣减、告警）。

## 2. Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <token>` |
| `X-Tenant-ID` | Yes | 租户上下文 |
| `X-Active-Group-ID` | Conditional | 多群组场景配额归因 |
| `X-Trace-ID` | No | 链路追踪 ID |

---

## 3. Workbench APIs

### 3.1 `GET /api/rbac/apps/accessible`

获取用户可访问应用（仅授权可见）。

**Query**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `view` | string | No | `all` \| `recent` \| `favorites` |
| `q` | string | No | 搜索关键词 |
| `category` | string | No | 分类过滤 |
| `limit` | number | No | 默认 20 |
| `cursor` | string | No | 分页游标 |

**Response 200**

```json
{
  "data": {
    "items": [
      {
        "id": "app_123",
        "name": "Sales Copilot",
        "description": "CRM assistant",
        "mode": "chat",
        "icon": "https://cdn/icon.png",
        "tags": ["sales", "crm"],
        "isFavorite": true,
        "lastUsedAt": "2026-02-13T08:00:00Z"
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "traceId": "tr_abc"
  }
}
```

### 3.2 `POST /api/rbac/apps/{appId}/favorite`

收藏应用。

**Response 204**: 无响应体。

### 3.3 `DELETE /api/rbac/apps/{appId}/favorite`

取消收藏应用。

**Response 204**: 无响应体。

### 3.4 `GET /api/rbac/apps/{appId}/context-options`

获取该应用可切换的群组上下文（延续 S1-2 能力）。

---

## 4. Quota APIs

### 4.1 `POST /internal/quota/check`

请求前配额检查。

**Request**

```json
{
  "tenantId": "ten_1",
  "groupId": "grp_1",
  "userId": "usr_1",
  "appId": "app_1",
  "meteringMode": "token",
  "estimatedUsage": 800
}
```

**Response 200**

```json
{
  "allowed": true,
  "limits": [
    { "scope": "tenant", "remaining": 12000, "limit": 50000 },
    { "scope": "group", "remaining": 3000, "limit": 10000 },
    { "scope": "user", "remaining": 1200, "limit": 4000 }
  ]
}
```

**Response 403 (`quota_exceeded`)**

```json
{
  "error": {
    "type": "permission_denied",
    "code": "quota_exceeded",
    "message": "Quota exceeded at group scope",
    "trace_id": "tr_abc"
  }
}
```

### 4.2 `POST /internal/quota/deduct`

请求完成后扣减与账本写入。

**Request**

```json
{
  "tenantId": "ten_1",
  "groupId": "grp_1",
  "userId": "usr_1",
  "appId": "app_1",
  "model": "gpt-4.1",
  "meteringMode": "token",
  "promptTokens": 300,
  "completionTokens": 500,
  "traceId": "tr_abc"
}
```

**Response 200**

```json
{
  "success": true
}
```

---

## 5. Alert Event Contract

阈值告警触发时，事件负载：

```json
{
  "tenantId": "ten_1",
  "policyId": "qp_1",
  "scope": "group",
  "threshold": 90,
  "usedValue": 9000,
  "limitValue": 10000,
  "periodStart": "2026-02-01T00:00:00Z",
  "traceId": "tr_alert_1"
}
```

---

## 6. Degradation Contract

当配额服务不可用：

- `GET /api/rbac/apps/accessible`：继续可用。  
- `POST /v1/chat/completions`：返回 `503 quota_service_unavailable` 或 `403 quota_guard_degraded_deny_new`（取决于实现策略）。  
- 错误消息必须可解释且包含 Trace ID。

---

## 7. Acceptance Mapping

- `AC-S1-3-01`/`02`/`03` → 3.x 接口  
- `AC-S1-3-04`/`06`/`07` → 4.x 接口  
- `AC-S1-3-05` → 5 节告警契约  
- `AC-S1-3-B01` → 6 节降级契约

---

## 8. Finalized Additions (2026-02-14)

### 8.1 Quota health API

`GET /internal/quota/health`

`POST /internal/quota/health`

Request:

```json
{
  "degraded": true,
  "reason": "manual failover test",
  "source": "manual"
}
```

### 8.2 Quota deduct response extension

`POST /internal/quota/deduct` response includes attribution:

```json
{
  "success": true,
  "attribution": {
    "groupId": "grp_1",
    "source": "requested"
  }
}
```

### 8.3 Chat execution entry

`POST /v1/chat/completions` integrates quota check + deduct and returns:

- `200` completion payload when quota allows
- `403 quota_exceeded` when any scope is exhausted
- `503 quota_guard_degraded_deny_new` when quota guard is degraded
