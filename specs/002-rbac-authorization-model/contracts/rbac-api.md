# RBAC API Contracts (S1-2)

**Feature**: 002-rbac-authorization-model
**Version**: 1.0.0
**Format**: OpenAPI 3.1
**Base Path**: `/api/v1`

---

## Overview

本文档定义 S1-2 切片（RBAC 授权模型）的 API 契约，包括角色管理、权限查询、授权管理、Break-glass 紧急访问等接口。

---

## 通用约定

### 请求头

| Header | 说明 | 示例 |
|--------|------|------|
| Authorization | Bearer Token（better-auth JWT） | `Bearer eyJhbGc...` |
| X-Tenant-ID | 租户 ID（可选，从 Token 解析） | `uuid` |
| X-Active-Group-ID | 当前工作群组 ID（多群组场景） | `uuid` |
| X-Trace-ID | 追踪 ID（可选，系统自动生成） | `uuid` |

### 响应格式

```typescript
interface SuccessResponse<T> {
  data: T;
  meta?: {
    traceId: string;
    timestamp: string;
  };
}

interface ErrorResponse {
  errors: Array<{
    code: string;        // AFUI_IAM_xxx
    message: string;
    details?: unknown;
  }>;
  meta?: {
    traceId: string;
    timestamp: string;
  };
}
```

### 错误码

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| AFUI_IAM_001 | 权限不足 | 403 |
| AFUI_IAM_002 | 角色不存在 | 404 |
| AFUI_IAM_003 | 系统角色不可删除 | 400 |
| AFUI_IAM_004 | 最后一个 Admin 不可降级 | 400 |
| AFUI_IAM_005 | 授权不存在 | 404 |
| AFUI_IAM_006 | 授权过期 | 400 |
| AFUI_IAM_007 | ROOT ADMIN 未启用 | 403 |
| AFUI_IAM_008 | Break-glass 会话过期 | 403 |

---

## 1. 角色管理 API

### 1.1 获取角色列表

```http
GET /api/v1/roles
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": [
    {
      "id": 1,
      "name": "tenant_admin",
      "displayName": "Tenant Admin",
      "description": "租户管理员",
      "isSystem": true,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "traceId": "uuid",
    "timestamp": "2025-02-11T00:00:00Z"
  }
}
```

### 1.2 获取角色详情

```http
GET /api/v1/roles/{roleId}
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": {
    "id": 1,
    "name": "tenant_admin",
    "displayName": "Tenant Admin",
    "description": "租户管理员",
    "isSystem": true,
    "isActive": true,
    "permissions": [
      { "code": "tenant:manage", "name": "管理���户设置", "category": "tenant" },
      { "code": "group:create", "name": "创建群组", "category": "group" }
    ],
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

## 2. 权限判定 API

### 2.1 检查权限

```http
POST /api/v1/permissions/check
Authorization: Bearer {token}
Content-Type: application/json

{
  "resourceType": "app",
  "action": "use",
  "resourceId": "app-uuid"
}
```

**响应**：
```json
{
  "data": {
    "allowed": true,
    "reason": "group_grant",
    "matchedGrant": {
      "grantId": "grant-uuid",
      "grantType": "group",
      "source": "Engineering Team"
    }
  }
}
```

### 2.2 批量检查权限

```http
POST /api/v1/permissions/check-batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "checks": [
    { "resourceType": "app", "action": "use", "resourceId": "app-1" },
    { "resourceType": "conversation", "action": "view", "resourceId": "conv-1" }
  ]
}
```

**响应**：
```json
{
  "data": {
    "results": [
      { "allowed": true, "reason": "group_grant" },
      { "allowed": false, "reason": "default_deny" }
    ]
  }
}
```

---

## 3. 授权管理 API

### 3.1 创建授权（群组→应用）

```http
POST /api/v1/grants
Authorization: Bearer {token}
Content-Type: application/json

{
  "appId": "app-uuid",
  "granteeType": "group",
  "granteeId": "group-uuid",
  "permission": "use"
}
```

**响应**：
```json
{
  "data": {
    "id": "grant-uuid",
    "appId": "app-uuid",
    "granteeType": "group",
    "granteeId": "group-uuid",
    "permission": "use",
    "grantedBy": "user-uuid",
    "createdAt": "2025-02-11T00:00:00Z"
  }
}
```

### 3.2 创建用户直授

```http
POST /api/v1/grants
Authorization: Bearer {token}
Content-Type: application/json

{
  "appId": "app-uuid",
  "granteeType": "user",
  "granteeId": "user-uuid",
  "permission": "use",
  "reason": "临时项目授权",
  "expiresAt": "2025-02-18T00:00:00Z"
}
```

**响应**：同 3.1

### 3.3 创建显式拒绝

```http
POST /api/v1/grants
Authorization: Bearer {token}
Content-Type: application/json

{
  "appId": "app-uuid",
  "granteeType": "user",
  "granteeId": "user-uuid",
  "permission": "deny",
  "reason": "安全策略要求"
}
```

**响应**：同 3.1

### 3.4 获取授权列表

```http
GET /api/v1/grants?appId={appId}&granteeType={granteeType}
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": [
    {
      "id": "grant-uuid",
      "appId": "app-uuid",
      "appName": "Customer Service Bot",
      "granteeType": "group",
      "granteeId": "group-uuid",
      "granteeName": "Engineering Team",
      "permission": "use",
      "grantedBy": "user-uuid",
      "grantedByName": "Admin User",
      "createdAt": "2025-02-11T00:00:00Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

### 3.5 撤销授权

```http
DELETE /api/v1/grants/{grantId}
Authorization: Bearer {token}
```

**响应**：204 No Content

---

## 4. 用户角色管理 API

### 4.1 分配角色

```http
POST /api/v1/users/{userId}/roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "roleId": 2,
  "tenantId": "tenant-uuid"
}
```

**响应**：
```json
{
  "data": {
    "userId": "user-uuid",
    "roleId": 2,
    "roleName": "tenant_admin",
    "tenantId": "tenant-uuid",
    "createdAt": "2025-02-11T00:00:00Z"
  }
}
```

### 4.2 移除角色

```http
DELETE /api/v1/users/{userId}/roles/{roleId}
Authorization: Bearer {token}
```

**响应**：204 No Content

### 4.3 获取用户角色

```http
GET /api/v1/users/{userId}/roles
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": [
    {
      "userId": "user-uuid",
      "roleId": 3,
      "roleName": "user",
      "tenantId": "tenant-uuid",
      "expiresAt": null
    }
  ]
}
```

---

## 5. Break-glass 紧急访问 API

### 5.1 激活 Break-glass

```http
POST /api/v1/breakglass/activate
Authorization: Bearer {root-admin-token}
Content-Type: application/json

{
  "tenantId": "target-tenant-uuid",
  "reason": "生产环境故障排查"
}
```

**响应**：
```json
{
  "data": {
    "sessionId": "breakglass-session-uuid",
    "tenantId": "target-tenant-uuid",
    "expiresAt": "2025-02-11T01:00:00Z",
    "auditEventId": "audit-uuid"
  }
}
```

**错误响应**（ROOT ADMIN 未启用）：
```json
{
  "errors": [
    {
      "code": "AFUI_IAM_007",
      "message": "ROOT ADMIN 功能未启用"
    }
  ]
}
```

### 5.2 检查 Break-glass 状态

```http
GET /api/v1/breakglass/status
Authorization: Bearer {root-admin-token}
```

**响应**：
```json
{
  "data": {
    "isActive": true,
    "tenantId": "target-tenant-uuid",
    "expiresAt": "2025-02-11T01:00:00Z"
  }
}
```

### 5.3 延长 Break-glass 会话

```http
POST /api/v1/breakglass/extend
Authorization: Bearer {root-admin-token}
Content-Type: application/json

{
  "sessionId": "breakglass-session-uuid"
}
```

**响应**：
```json
{
  "data": {
    "sessionId": "breakglass-session-uuid",
    "expiresAt": "2025-02-11T02:00:00Z"
  }
}
```

---

## 6. 应用可见性 API

### 6.1 获取可用应用列表

```http
GET /api/v1/apps/accessible
Authorization: Bearer {token}
X-Active-Group-ID: {group-uuid}
```

**响应**：
```json
{
  "data": [
    {
      "id": "app-uuid",
      "name": "Customer Service Bot",
      "description": "智能客服机器人",
      "grantedBy": [
        { "type": "group", "name": "Engineering Team" },
        { "type": "user", "name": "Direct Grant" }
      ]
    }
  ]
}
```

### 6.2 获取应用上下文选项

```http
GET /api/v1/apps/{appId}/context-options
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": {
    "currentGroup": {
      "id": "group-a-uuid",
      "name": "Engineering Team",
      "hasAccess": true
    },
    "availableGroups": [
      {
        "id": "group-b-uuid",
        "name": "Sales Team",
        "hasAccess": true
      }
    ],
    "requiresSwitch": true
  }
}
```

---

## 7. 通知标记 API

### 7.1 获取未读通知数量

```http
GET /api/v1/notifications/unread-count
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": {
    "total": 2,
    "breakglass": 1,
    "other": 1
  }
}
```

### 7.2 获取 Break-glass 通知列表

```http
GET /api/v1/notifications/breakglass
Authorization: Bearer {token}
```

**响应**：
```json
{
  "data": [
    {
      "id": "notif-uuid",
      "type": "breakglass_activated",
      "message": "ROOT ADMIN 于 2025-02-11 10:00 访问了本租户",
      "metadata": {
        "rootAdminId": "admin-uuid",
        "reason": "生产环境故障排查",
        "expiresAt": "2025-02-11T11:00:00Z"
      },
      "createdAt": "2025-02-11T10:00:00Z",
      "isRead": false
    }
  ]
}
```

---

## OpenAPI 3.1 规范（简化版）

```yaml
openapi: 3.1.0
info:
  title: AgentifUI RBAC API
  version: 1.0.0
  description: S1-2 切片 RBAC 授权模型 API

servers:
  - url: http://localhost:3001/api/v1
    description: Local development

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Role:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
          enum: [root_admin, tenant_admin, user]
        displayName:
          type: string
        description:
          type: string
        isSystem:
          type: boolean
        isActive:
          type: boolean
        createdAt:
          type: string
          format: date-time

    AppGrant:
      type: object
      properties:
        id:
          type: string
          format: uuid
        appId:
          type: string
          format: uuid
        granteeType:
          type: string
          enum: [group, user]
        granteeId:
          type: string
          format: uuid
        permission:
          type: string
          enum: [use, deny]
        reason:
          type: string
        expiresAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time

    PermissionCheckRequest:
      type: object
      required: [resourceType, action]
      properties:
        resourceType:
          type: string
        action:
          type: string
        resourceId:
          type: string
          format: uuid

    PermissionCheckResponse:
      type: object
      properties:
        allowed:
          type: boolean
        reason:
          type: string
        matchedGrant:
          type: object
          properties:
            grantId:
              type: string
            grantType:
              type: string
            source:
              type: string

    BreakglassActivateRequest:
      type: object
      required: [tenantId, reason]
      properties:
        tenantId:
          type: string
          format: uuid
        reason:
          type: string
          minLength: 10
          maxLength: 500

    ErrorResponse:
      type: object
      required: [errors]
      properties:
        errors:
          type: array
          items:
            type: object
            required: [code, message]
            properties:
              code:
                type: string
                pattern: '^AFUI_IAM_\\d{3}$'
              message:
                type: string
              details:
                type: object

paths:
  /roles:
    get:
      summary: 获取角色列表
      tags: [Roles]
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Role'

  /permissions/check:
    post:
      summary: 检查权限
      tags: [Permissions]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PermissionCheckRequest'
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/PermissionCheckResponse'
        '403':
          description: 权限不足
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /grants:
    post:
      summary: 创建授权
      tags: [Grants]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AppGrant'
      responses:
        '201':
          description: 创建成功
        '400':
          description: 请求参数错误
        '403':
          description: 权限不足（仅 Tenant Admin）

  /breakglass/activate:
    post:
      summary: 激活 Break-glass
      tags: [Break-glass]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BreakglassActivateRequest'
      responses:
        '200':
          description: 激活成功
        '403':
          description: ROOT ADMIN 未启用

tags:
  - name: Roles
    description: 角色管理
  - name: Permissions
    description: 权限判定
  - name: Grants
    description: 授权管理
  - name: Break-glass
    description: 紧急访问
```

---

*本文档基于 GATEWAY_CONTRACT_P1.md 生成*
