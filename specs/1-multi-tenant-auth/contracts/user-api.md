# User Management API Contract

**Feature**: Multi-Tenant Authentication Base (S1-1)
**Version**: 1.0.0
**Date**: 2025-02-10

## Overview

本文档定义用户管理相关的 API 契约，包括用户资料管理、用户状态管理、用户列表查询等。

## Base URL

```
GET /api/users/*
POST /api/users/*
PATCH /api/users/*
DELETE /api/users/*
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

### 1. Get Current User Profile

获取当前登录用户的资料信息。

**Endpoint**: `GET /api/users/me`

**Headers**:
```
Authorization: Bearer access_token
X-Tenant-ID: tenant_uuid
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "phone": "+1234567890",
    "status": "active",
    "emailVerified": true,
    "mfaEnabled": false,
    "mfaForced": false,
    "preferences": {
      "language": "en",
      "timezone": "UTC",
      "theme": "dark"
    },
    "lastActiveAt": "2025-02-10T10:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z",
    "roles": [
      {
        "tenantId": "uuid",
        "tenantName": "Workspace",
        "role": "USER"
      }
    ],
    "groups": [
      {
        "id": "uuid",
        "name": "Engineering",
        "role": "manager"
      }
    ]
  },
  "traceId": "trace-id-here"
}
```

---

### 2. Update Current User Profile

更新当前用户的资料信息。

**Endpoint**: `PATCH /api/users/me`

**Request Body**:
```json
{
  "name": "John Doe",
  "avatarUrl": "https://...",
  "phone": "+1234567890",
  "preferences": {
    "language": "zh",
    "timezone": "Asia/Shanghai",
    "theme": "light"
  }
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    // ... other fields
  },
  "traceId": "trace-id-here"
}
```

---

### 3. Get User by ID

获取指定用户的资料（需要权限）。

**Endpoint**: `GET /api/users/:userId`

**Path Parameters**:
- `userId`: 用户 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "status": "active",
    "groups": [ /* ... */ ],
    "roles": [ /* ... */ ]
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足
- `404 NOT_FOUND`: 用户不存在

---

### 4. List Users

获取租户内的用户列表（支持分页和过滤）。

**Endpoint**: `GET /api/users`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | 页码，默认 1 |
| limit | integer | No | 每页数量，默认 20 |
| status | string | No | 过滤状态：active, pending, suspended, rejected |
| search | string | No | 搜索邮箱或名称 |
| groupId | string | No | 过滤群组成员 |
| sortBy | string | No | 排序字段：name, email, createdAt |
| sortOrder | string | No | 排序方向：asc, desc |

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "status": "active",
        "groups": [ /* ... */ ],
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "traceId": "trace-id-here"
}
```

---

### 5. Update User Status

管理员更新用户状态（激活/暂停/拒绝）。

**Endpoint**: `PATCH /api/users/:userId/status`

**Path Parameters**:
- `userId`: 用户 UUID

**Request Body**:
```json
{
  "status": "suspended",
  "reason": "Violation of company policy"
}
```

**Status Values**:
- `active`: 激活
- `suspended`: 暂停
- `rejected`: 拒绝（待审核状态不能通过此接口设置，需使用 approve/reject）

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "suspended"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足（需要 TENANT_ADMIN）
- `404 NOT_FOUND`: 用户不存在

---

### 6. Approve Pending User

审核通过待审核用户。

**Endpoint**: `POST /api/users/:userId/approve`

**Path Parameters**:
- `userId`: 用户 UUID

**Request Body** (optional):
```json
{
  "groupId": "group-uuid",  // 可选，指定加入的群组
  "message": "Welcome aboard!"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active",
    "approvedAt": "2025-02-10T10:00:00Z"
  },
  "traceId": "trace-id-here"
}
```

---

### 7. Reject Pending User

拒绝待审核用户。

**Endpoint**: `POST /api/users/:userId/reject`

**Path Parameters**:
- `userId`: 用户 UUID

**Request Body**:
```json
{
  "reason": "Does not meet requirements"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "rejected",
    "rejectedAt": "2025-02-10T10:00:00Z"
  },
  "traceId": "trace-id-here"
}
```

---

### 8. Get User Groups

获取用户所属的群组列表。

**Endpoint**: `GET /api/users/me/groups`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "uuid",
        "name": "Engineering",
        "description": "Engineering team",
        "role": "manager",
        "memberCount": 15,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ]
  },
  "traceId": "trace-id-here"
}
```

---

### 9. Change Password

用户修改自己的密码。

**Endpoint**: `POST /api/users/me/change-password`

**Request Body**:
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `400 INVALID_PASSWORD`: 当前密码错误
- `400 WEAK_PASSWORD`: 新密码强度不足
- `400 PASSWORD_REUSED`: 新密码与历史密码重复

---

### 10. Reset User Password (Admin)

管理员重置用户密码。

**Endpoint**: `POST /api/users/:userId/reset-password`

**Path Parameters**:
- `userId`: 用户 UUID

**Request Body** (optional):
```json
{
  "sendEmail": true,  // 默认 true，发送重置邮件
  "newPassword": "TempPass123!"  // sendEmail=false 时必需
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Password reset email sent"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足（需要 TENANT_ADMIN）

---

### 11. Force MFA

管理员强制用户启用 MFA。

**Endpoint**: `POST /api/users/:userId/force-mfa`

**Path Parameters**:
- `userId`: 用户 UUID

**Request Body**:
```json
{
  "enabled": true  // true: 强制启用, false: 取消强制
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "mfaForced": true
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足（需要 TENANT_ADMIN）

---

### 12. Delete User

删除用户（软删除）。

**Endpoint**: `DELETE /api/users/:userId`

**Path Parameters**:
- `userId`: 用户 UUID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  },
  "traceId": "trace-id-here"
}
```

**Error Responses**:
- `403 FORBIDDEN`: 权限不足
- `400 CANNOT_DELETE_SELF`: 不能删除自己

---

## TypeScript Types

```typescript
// Shared types (packages/shared/src/types/user.ts)

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaForced: boolean;
  preferences: UserPreferences;
  lastActiveAt?: string;
  createdAt: string;
}

type UserStatus = 'active' | 'pending' | 'suspended' | 'rejected';

interface UserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
}

interface UserWithRoles extends User {
  roles: UserRoleInTenant[];
  groups: UserGroup[];
}

interface UserRoleInTenant {
  tenantId: string;
  tenantName: string;
  role: 'ROOT_ADMIN' | 'TENANT_ADMIN' | 'USER';
}

interface UserGroup {
  id: string;
  name: string;
  description?: string;
  role: 'member' | 'manager';
  memberCount?: number;
  createdAt: string;
}

interface UpdateUserProfileRequest {
  name?: string;
  avatarUrl?: string;
  phone?: string;
  preferences?: Partial<UserPreferences>;
}

interface UpdateUserStatusRequest {
  status: 'active' | 'suspended' | 'rejected';
  reason?: string;
}

interface ApproveUserRequest {
  groupId?: string;
  message?: string;
}

interface RejectUserRequest {
  reason: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface ResetUserPasswordRequest {
  sendEmail?: boolean;
  newPassword?: string;
}

interface ForceMFARequest {
  enabled: boolean;
}

interface ListUsersQuery {
  page?: number;
  limit?: number;
  status?: UserStatus;
  search?: string;
  groupId?: string;
  sortBy?: 'name' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedUsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

*本文档由 `/speckit.plan` 命令 Phase 1 生成*
