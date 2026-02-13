# Authentication API Contract

**Feature**: Multi-Tenant Authentication Base (S1-1)
**Version**: 1.0.0
**Date**: 2025-02-10

## Overview

本文档定义认证相关的 API 契约，包括邮箱密码登录、SSO 登录、会话管理、Token 刷新等。

## Base URL

```
POST /api/auth/*
```

## Common Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| Content-Type | string | Yes | `application/json` |
| X-Tenant-ID | string | Conditional | 租户 ID（租户上下文必需） |
| X-Trace-ID | string | No | Trace ID（用于全链路追踪） |
| Authorization | string | Conditional | Bearer token（已登录请求） |

## Common Responses

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "traceId": "string"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { /* optional error details */ }
  },
  "traceId": "string"
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | 未认证或 Token 无效 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `INVALID_CREDENTIALS` | 401 | 邮箱或密码错误 |
| `ACCOUNT_LOCKED` | 423 | 账号已锁定 |
| `ACCOUNT_PENDING` | 403 | 账号待审核 |
| `ACCOUNT_SUSPENDED` | 403 | 账号已暂停 |
| `INVALID_TOKEN` | 400 | Token 无效或过期 |
| `MFA_REQUIRED` | 403 | 需要完成 MFA 验证 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |

---

## Endpoints

### 1. Login (邮箱密码登录)

用户通过邮箱和密码登录系统。

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "tenantSlug": "workspace-alias" // 可选，指定租户
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatarUrl": "https://...",
      "status": "active",
      "mfaEnabled": false,
      "preferences": {
        "language": "en",
        "timezone": "UTC",
        "theme": "dark"
      }
    },
    "session": {
      "token": "access_token_jwt",
      "refreshToken": "refresh_token",
      "expiresAt": "2025-02-10T12:15:00Z",
      "tenantId": "uuid",
      "tenantName": "Workspace Name",
      "roles": ["USER"]
    },
    "requiresMFA": false,
    "availableTenants": [
      {
        "id": "uuid",
        "name": "Workspace 1",
        "slug": "workspace-1",
        "role": "USER"
      },
      {
        "id": "uuid",
        "name": "Workspace 2",
        "slug": "workspace-2",
        "role": "TENANT_ADMIN"
      }
    ]
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `401 INVALID_CREDENTIALS`: 邮箱或密码错误
- `423 ACCOUNT_LOCKED`: 账号已锁定（含剩余锁定时间）
- `403 ACCOUNT_PENDING`: 账号待审核
- `403 ACCOUNT_SUSPENDED`: 账号已暂停
- `403 MFA_REQUIRED`: 需要完成 MFA 验证

**Account Locked Response**:
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account has been locked due to multiple failed login attempts",
    "details": {
      "lockedUntil": "2025-02-10T12:30:00Z",
      "remainingMinutes": 15
    }
  },
  "traceId": "trace-id-here"
}
```

**MFA Required Response**:
```json
{
  "success": false,
  "error": {
    "code": "MFA_REQUIRED",
    "message": "Multi-factor authentication required",
    "details": {
      "mfaToken": "temp_token_for_mfa_verification",
      "expiresAt": "2025-02-10T12:05:00Z"
    }
  },
  "traceId": "trace-id-here"
}
```

---

### 2. Verify MFA (MFA 验证)

完成 TOTP 验证码验证。

**Endpoint**: `POST /api/auth/mfa/verify`

**Request Body**:
```json
{
  "mfaToken": "temp_token_from_login_response",
  "code": "123456"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "session": { /* session object */ }
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `400 INVALID_MFA_TOKEN`: MFA 临时 Token 无效或过期
- `400 INVALID_CODE`: 验证码错误
- `400 INVALID_MFA_TOKEN`: MFA 临时 Token 无效

---

### 3. Refresh Token (刷新令牌)

使用 Refresh Token 获取新的 Access Token。

**Endpoint**: `POST /api/auth/refresh`

**Request Body**:
```json
{
  "refreshToken": "refresh_token_string"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "token": "new_access_token_jwt",
    "refreshToken": "new_refresh_token",
    "expiresAt": "2025-02-10T12:30:00Z"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `401 INVALID_TOKEN`: Refresh Token 无效或过期

---

### 4. Logout (登出)

用户登出并撤销当前会话。

**Endpoint**: `POST /api/auth/logout`

**Headers**:
```
Authorization: Bearer access_token
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "traceId": "trace-id-here"
}
```

---

### 5. SSO Detect (检测 SSO 配置)

根据邮箱域名检测可用的 SSO 登录方式。

**Endpoint**: `GET /api/auth/sso/detect?email=user@example.com`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "providers": [
      {
        "tenantId": "uuid",
        "tenantName": "Company Workspace",
        "providerType": "google",
        "loginUrl": "/api/auth/sso/google?tenantId=uuid&redirect=..."
      }
    ]
  },
  "traceId": "trace-id-here"
}
```

**No SSO Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "providers": [],
    "availableMethods": ["emailPassword"]
  },
  "traceId": "trace-id-here"
}
```

---

### 6. SSO Login URLs (SSO 登录链接)

获取各 SSO 提供商的登录 URL。

**Endpoint**: `GET /api/auth/sso/{provider}/login`

**Path Parameters**:
- `provider`: `google` | `github` | `wechat` | `oidc` | `saml` | `oauth2`

**Query Parameters**:
- `tenantId`: 目标租户 ID（必需）
- `redirectUri`: 登录成功后的重定向 URI
- `state`: CSRF 保护 token

**Response (302 Redirect)**:
重定向到 SSO 提供商的授权页面。

---

### 7. SSO Callback (SSO 回调)

SSO 提供商认证成功后的回调端点。

**Endpoint**: `GET /api/auth/sso/{provider}/callback`

**Query Parameters**:
- `code`: 授权码
- `state`: CSRF 保护 token
- `tenantId`: 目标租户 ID

**Response (302 Redirect)**:
重定向到应用前端并携带 session token。

```
Redirect: {FRONTEND_URL}/auth/callback?session_token=xxx&tenant_id=xxx
```

---

### 8. Switch Tenant (切换租户)

用户切换到另一个租户上下文。

**Endpoint**: `POST /api/auth/switch-tenant`

**Headers**:
```
Authorization: Bearer access_token
```

**Request Body**:
```json
{
  "tenantId": "target_tenant_uuid"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "session": {
      "token": "new_access_token_with_new_tenant_context",
      "refreshToken": "new_refresh_token",
      "expiresAt": "2025-02-10T13:00:00Z",
      "tenantId": "new_tenant_uuid",
      "tenantName": "New Workspace",
      "roles": ["TENANT_ADMIN"]
    }
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 NOT_MEMBER`: 用户不属于目标租户
- `404 TENANT_NOT_FOUND`: 租户不存在

---

### 9. Accept Invite (接受邀请并设置密码)

用户通过邀请链接设置密码并激活账号。

**Endpoint**: `POST /api/auth/accept-invite`

**Request Body**:
```json
{
  "token": "invite_token_from_email",
  "password": "SecurePass123",
  "name": "John Doe" // 可选，更新用户名称
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "session": { /* session object */ },
    "invitation": {
      "tenantName": "Inviting Workspace",
      "role": "USER"
    }
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `400 INVALID_TOKEN`: 邀请 Token 无效
- `400 TOKEN_EXPIRED`: 邀请链接已过期
- `400 TOKEN_USED`: 邀请链接已被使用
- `400 TOKEN_REVOKED`: 邀请已被撤销
- `400 WEAK_PASSWORD`: 密码强度不足

---

### 10. Forgot Password (忘记密码)

发起密码重置流程。

**Endpoint**: `POST /api/auth/forgot-password`

**Request Body**:
```json
{
  "email": "user@example.com",
  "tenantSlug": "workspace-alias" // 可选，帮助定位租户
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a password reset link has been sent"
  },
  "traceId": "trace-id-here"
}
```

**注意**: 无论邮箱是否存在，都返回相同响应（防止邮箱枚举攻击）。

---

### 11. Reset Password (重置密码)

使用重置 Token 设置新密码。

**Endpoint**: `POST /api/auth/reset-password`

**Request Body**:
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `400 INVALID_TOKEN`: 重置 Token 无效
- `400 TOKEN_EXPIRED`: 重置链接已过期

---

### 12. Get Current Session (获取当前会话)

获取当前用户和会话信息。

**Endpoint**: `GET /api/auth/session`

**Headers**:
```
Authorization: Bearer access_token
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "session": { /* session object */ },
    "availableTenants": [ /* tenant list */ ]
  },
  "traceId": "trace-id-here"
}
```

---

### 13. Revoke Sessions (撤销会话)

管理员撤销指定用户的所有会话（强制登出）。

**Endpoint**: `POST /api/auth/revoke-sessions`

**Headers**:
```
Authorization: Bearer access_token
X-Tenant-ID: tenant_uuid
```

**Request Body**:
```json
{
  "userId": "target_user_uuid",
  "allTenants": false // true: 撤销所有租户的会话, false: 仅当前租户
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "revokedCount": 3
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足（需要 TENANT_ADMIN 或更高）

---

## TypeScript Types

```typescript
// Shared types (packages/shared/src/types/auth.ts)

interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

interface LoginResponse {
  user: User;
  session: Session;
  requiresMFA: boolean;
  availableTenants: TenantInfo[];
}

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: 'active' | 'pending' | 'suspended' | 'rejected';
  mfaEnabled: boolean;
  preferences: UserPreferences;
}

interface UserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
}

interface Session {
  token: string;
  refreshToken: string;
  expiresAt: string; // ISO 8601
  tenantId: string;
  tenantName: string;
  roles: UserRole[];
}

type UserRole = 'ROOT_ADMIN' | 'TENANT_ADMIN' | 'USER';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

interface MFAPromptResponse {
  mfaToken: string;
  expiresAt: string;
}

interface SSOProvider {
  tenantId: string;
  tenantName: string;
  providerType: SSOProviderType;
  loginUrl: string;
}

type SSOProviderType = 'google' | 'github' | 'wechat' | 'oidc' | 'saml' | 'oauth2';

interface SwitchTenantRequest {
  tenantId: string;
}

interface AcceptInviteRequest {
  token: string;
  password: string;
  name?: string;
}

interface ForgotPasswordRequest {
  email: string;
  tenantSlug?: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

interface RevokeSessionsRequest {
  userId: string;
  allTenants?: boolean;
}
```

---

*本文档由 `/speckit.plan` 命令 Phase 1 生成*
