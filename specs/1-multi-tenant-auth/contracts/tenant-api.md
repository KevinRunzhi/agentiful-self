# Tenant Management API Contract

**Feature**: Multi-Tenant Authentication Base (S1-1)
**Version**: 1.0.0
**Date**: 2025-02-10

## Overview

本文档定义租户管理相关的 API 契约，包括租户配置、租户策略管理、租户成员查询等。

## Base URL

```
GET /api/tenants/*
POST /api/tenants/*
PATCH /api/tenants/*
```

## Common Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| Content-Type | string | Yes | `application/json` |
| X-Tenant-ID | string | Yes | 租户 ID |
| X-Trace-ID | string | No | Trace ID（用于全链路追踪） |
| Authorization | string | Yes | Bearer token |

---

## Endpoints

### 1. Get Tenant Details

获取当前租户的详细信息。

**Endpoint**: `GET /api/tenants/:tenantId`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "status": "active",
    "plan": "enterprise",
    "customConfig": { /* ... */ },
    "createdAt": "2025-01-01T00:00:00Z",
    "stats": {
      "userCount": 150,
      "groupCount": 12,
      "appCount": 5
    }
  },
  "traceId": "trace-id-here"
}
```

---

### 2. Get Tenant Configuration

获取租户的配置信息（认证、密码策略、MFA 策略等）。

**Endpoint**: `GET /api/tenants/:tenantId/config`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "tenantId": "uuid",
    "config": {
      "auth": {
        "emailPasswordEnabled": true,
        "requireEmailVerification": false
      },
      "passwordPolicy": {
        "minLength": 8,
        "requireUppercase": true,
        "requireLowercase": true,
        "requireNumbers": true,
        "requireSpecialChars": false,
        "expireDays": null,
        "historyLimit": 5
      },
      "accountLockout": {
        "enabled": true,
        "maxAttempts": 5,
        "lockoutDurationMinutes": 30
      },
      "mfaPolicy": "optional",
      "userApproval": {
        "enabled": false,
        "ssoBypassApproval": true
      },
      "defaultLanguage": "en",
      "defaultTheme": "system"
    }
  },
  "traceId": "trace-id-here"
}
```

---

### 3. Update Tenant Configuration

更新租户配置（需要 TENANT_ADMIN 权限）。

**Endpoint**: `PATCH /api/tenants/:tenantId/config`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Request Body**:
```json
{
  "auth": {
    "emailPasswordEnabled": true,
    "requireEmailVerification": true
  },
  "passwordPolicy": {
    "minLength": 10,
    "requireSpecialChars": true,
    "expireDays": 90
  },
  "mfaPolicy": "required",
  "userApproval": {
    "enabled": true,
    "ssoBypassApproval": true
  },
  "defaultLanguage": "zh"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "tenantId": "uuid",
    "config": { /* updated config */ }
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足（需要 TENANT_ADMIN）
- `400 INVALID_CONFIG`: 配置值无效

---

### 4. Get Tenant Members

获取租户成员列表。

**Endpoint**: `GET /api/tenants/:tenantId/members`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | 页码，默认 1 |
| limit | integer | No | 每页数量，默认 20 |
| role | string | No | 过滤角色：ROOT_ADMIN, TENANT_ADMIN, USER |
| status | string | No | 过滤状态：active, pending, suspended |
| search | string | No | 搜索邮箱或名称 |

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "userId": "uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "role": "TENANT_ADMIN",
        "status": "active",
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  },
  "traceId": "trace-id-here"
}
```

---

### 5. Update Member Role

更新成员在租户中的角色。

**Endpoint**: `PATCH /api/tenants/:tenantId/members/:userId/role`

**Path Parameters**:
- `tenantId`: 租户 UUID
- `userId`: 用户 UUID

**Request Body**:
```json
{
  "role": "TENANT_ADMIN"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "tenantId": "uuid",
    "role": "TENANT_ADMIN"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足
- `400 CANNOT_MODIFY_SELF`: 不能修改自己的角色
- `400 LAST_ADMIN`: 不能移除最后一个管理员

---

### 6. Remove Member from Tenant

从租户中移除成员。

**Endpoint**: `DELETE /api/tenants/:tenantId/members/:userId`

**Path Parameters**:
- `tenantId`: 租户 UUID
- `userId`: 用户 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Member removed successfully"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足
- `400 CANNOT_REMOVE_SELF`: 不能移除自己
- `400 LAST_ADMIN`: 不能移除最后一个管理员

---

### 7. Get Tenant SSO Configurations

获取租户的 SSO 配置列表。

**Endpoint**: `GET /api/tenants/:tenantId/sso`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "configs": [
      {
        "id": "uuid",
        "emailDomain": "company.com",
        "providerType": "google",
        "enabled": true,
        "priority": 0,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ]
  },
  "traceId": "trace-id-here"
}
```

---

### 8. Add SSO Configuration

添加新的 SSO 配置。

**Endpoint**: `POST /api/tenants/:tenantId/sso`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Request Body**:
```json
{
  "emailDomain": "company.com",
  "providerType": "google",
  "config": {
    "clientId": "google-client-id",
    "clientSecret": "google-client-secret",
    "hd": "company.com"
  },
  "enabled": true,
  "priority": 0
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "emailDomain": "company.com",
    "providerType": "google",
    "enabled": true
  },
  "traceId": "trace-id-here"
}
```

---

### 9. Update SSO Configuration

更新 SSO 配置。

**Endpoint**: `PATCH /api/tenants/:tenantId/sso/:ssoId`

**Path Parameters**:
- `tenantId`: 租户 UUID
- `ssoId`: SSO 配置 UUID

**Request Body**:
```json
{
  "enabled": false
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "enabled": false
  },
  "traceId": "trace-id-here"
}
```

---

### 10. Delete SSO Configuration

删除 SSO 配置。

**Endpoint**: `DELETE /api/tenants/:tenantId/sso/:ssoId`

**Path Parameters**:
- `tenantId`: 租户 UUID
- `ssoId`: SSO 配置 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "SSO configuration deleted successfully"
  },
  "traceId": "trace-id-here"
}
```

---

### 11. Get Tenant Statistics

获取租户统计数据。

**Endpoint**: `GET /api/tenants/:tenantId/stats`

**Path Parameters**:
- `tenantId`: 租户 UUID

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | No | 统计周期：day, week, month, year，默认 month |

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "tenantId": "uuid",
    "period": "month",
    "stats": {
      "users": {
        "total": 150,
        "active": 140,
        "pending": 8,
        "suspended": 2,
        "newThisPeriod": 15
      },
      "groups": {
        "total": 12,
        "active": 12
      },
      "sessions": {
        "active": 45,
        "totalThisPeriod": 1250
      },
      "mfa": {
        "enabled": 120,
        "enabledPercentage": 80
      }
    },
    "traceId": "trace-id-here"
  }
}
```

---

## TypeScript Types

```typescript
// Shared types (packages/shared/src/types/tenant.ts)

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  plan: string;
  customConfig: TenantConfig;
  createdAt: string;
}

interface TenantConfig {
  auth: {
    emailPasswordEnabled: boolean;
    requireEmailVerification: boolean;
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expireDays: number | null;
    historyLimit: number;
  };
  accountLockout: {
    enabled: boolean;
    maxAttempts: number;
    lockoutDurationMinutes: number;
  };
  mfaPolicy: 'required' | 'optional' | 'disabled';
  userApproval: {
    enabled: boolean;
    ssoBypassApproval: boolean;
  };
  defaultLanguage: string;
  defaultTheme: 'light' | 'dark' | 'system';
}

interface SSOConfig {
  id: string;
  tenantId: string;
  emailDomain: string;
  providerType: SSOProviderType;
  config: SSOProviderConfig;
  enabled: boolean;
  priority: number;
  createdAt: string;
}

type SSOProviderType = 'google' | 'github' | 'wechat' | 'oidc' | 'saml' | 'oauth2';

interface SSOProviderConfig {
  // Google OAuth2
  clientId?: string;
  clientSecret?: string;
  hd?: string;
  // OIDC
  issuer?: string;
  scopes?: string[];
  // SAML
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpX509Cert?: string;
  // Common
  redirectUri?: string;
}

interface TenantMember {
  userId: string;
  email: string;
  name: string;
  role: 'ROOT_ADMIN' | 'TENANT_ADMIN' | 'USER';
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
}

interface TenantStats {
  users: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    newThisPeriod: number;
  };
  groups: {
    total: number;
    active: number;
  };
  sessions: {
    active: number;
    totalThisPeriod: number;
  };
  mfa: {
    enabled: number;
    enabledPercentage: number;
  };
}

interface UpdateTenantConfigRequest {
  auth?: {
    emailPasswordEnabled?: boolean;
    requireEmailVerification?: boolean;
  };
  passwordPolicy?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    expireDays?: number | null;
    historyLimit?: number;
  };
  accountLockout?: {
    enabled?: boolean;
    maxAttempts?: number;
    lockoutDurationMinutes?: number;
  };
  mfaPolicy?: 'required' | 'optional' | 'disabled';
  userApproval?: {
    enabled?: boolean;
    ssoBypassApproval?: boolean;
  };
  defaultLanguage?: string;
  defaultTheme?: 'light' | 'dark' | 'system';
}

interface AddSSOConfigRequest {
  emailDomain: string;
  providerType: SSOProviderType;
  config: SSOProviderConfig;
  enabled?: boolean;
  priority?: number;
}
```

---

*本文档由 `/speckit.plan` 命令 Phase 1 生成*
