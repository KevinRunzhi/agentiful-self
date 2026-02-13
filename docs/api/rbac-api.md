# RBAC API Documentation

**Feature**: 002-rbac-authorization-model
**Version**: 1.0.0
**Last Updated**: 2025-02-11

## Overview

The RBAC (Role-Based Access Control) API provides endpoints for managing roles, permissions, grants, and user access control within multi-tenant applications.

## Base URL

```
/api/rbac
```

## Authentication

All RBAC endpoints require authentication. Include the following headers:

```
Authorization: Bearer <token>
X-Tenant-ID: <tenant_id>
X-Active-Group-ID: <group_id>  # Optional, for context-aware operations
X-Trace-ID: <trace_id>  # Optional, for distributed tracing
```

## Error Codes

| Code | Message | Description |
|-------|----------|-------------|
| `AFUI_IAM_001` | Unauthorized | Authentication required or token invalid |
| `AFUI_IAM_002` | Role not found | Requested role does not exist |
| `AFUI_IAM_003` | System role not deletable | Cannot delete system role |
| `AFUI_IAM_004` | Last admin not removable | Cannot remove last tenant admin |
| `AFUI_IAM_005` | Grant not found | Requested grant does not exist |
| `AFUI_IAM_006` | Grant expired | Grant has expired |
| `AFUI_IAM_007` | Root admin disabled | Root admin functionality is disabled |
| `AFUI_IAM_008` | Session not found | Break-glass session not found |

---

## Endpoints

### Roles

#### List Roles

```http
GET /api/rbac/roles
```

**Description**: Get all roles in the system (optionally filtered by active status)

**Query Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `activeOnly` | boolean | No | If `true`, only returns active roles |

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1,
      "name": "root_admin",
      "displayName": "Root Administrator",
      "description": "Full system access",
      "isSystem": true,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

#### Get Role by ID

```http
GET /api/rbac/roles/:id
```

**Path Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `id` | integer | Yes | Role ID |

**Response** (200 OK):
```json
{
  "data": {
    "id": 1,
    "name": "root_admin",
    "displayName": "Root Administrator",
    "description": "Full system access",
    "isSystem": true,
    "isActive": true,
    "permissions": [
      {
        "id": 1,
        "code": "app:use",
        "name": "Use App",
        "category": "app"
      }
    ]
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

**Errors**:
- `404`: Role not found (`AFUI_IAM_002`)

---

### Permissions

#### Check Permission

```http
POST /api/rbac/permissions/check
```

**Description**: Check if a user has permission to perform an action on a resource

**Request Body**:
```json
{
  "resourceType": "app",
  "action": "use",
  "resourceId": "550e8400-e29b-41d4-a16c-20155584241e25"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "allowed": true,
    "reason": "role_permission"
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

**Response** (403 Forbidden):
```json
{
  "data": {
    "allowed": false,
    "reason": "default_deny"
  },
  "errors": [
    {
      "code": "AFUI_IAM_001",
      "message": "Insufficient permissions"
    }
  ]
}
```

#### Batch Permission Check

```http
POST /api/rbac/permissions/check-batch
```

**Description**: Check multiple permissions at once

**Request Body**:
```json
{
  "checks": [
    { "resourceType": "app", "action": "use", "resourceId": "<app_id>" },
    { "resourceType": "conversation", "action": "view", "resourceId": "<conversation_id>" }
  ]
}
```

---

### User Roles

#### Assign Role to User

```http
POST /api/rbac/users/:userId/roles
```

**Description**: Assign a role to a user in a tenant context

**Path Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `userId` | string | Yes | User ID |
| `roleId` | integer | Yes | Role ID |

**Request Body**:
```json
{
  "expiresAt": "2024-02-01T00:00:00.000Z"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "userId": "550e8400-e29b-41d4-a16c-20155584241e25",
    "roleId": 2,
    "tenantId": "550e8400-e29b-41d4-a16c-20155584241e25",
    "expiresAt": "2024-02-01T00:00:00.000Z",
    "createdAt": "2024-01-01T10:30:00.000Z"
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

**Errors**:
- `400`: Invalid request
- `403`: Forbidden - Last tenant admin cannot be removed (`AFUI_IAM_004`)
- `404`: User not found

#### Remove Role from User

```http
DELETE /api/rbac/users/:userId/roles/:roleId
```

**Description**: Remove a role assignment from a user

**Path Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `userId` | string | Yes | User ID |
| `roleId` | integer | Yes | Role ID |

**Response** (204 No Content): Successful removal

**Errors**:
- `403`: Forbidden - Last tenant admin cannot be removed
- `404`: User-role assignment not found

---

### Grants

#### Get Grants for App

```http
GET /api/rbac/grants?appId=<app_id>
```

**Description**: Get all grants for a specific application

**Query Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `appId` | string | Yes | Application ID |

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a16c-20155584241e25",
      "appId": "550e8400-e29b-41d4-a16c-20155584241e25",
      "granteeType": "group",
      "granteeId": "group-abc",
      "permission": "use",
      "reason": "Project team needs access",
      "grantedBy": "user-123",
      "expiresAt": null,
      "createdAt": "2024-01-01T10:30:00.000Z"
    }
  ],
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

#### Create Grant

```http
POST /api/rbac/grants
```

**Description**: Create a new grant (group or user access to an application)

**Request Body**:
```json
{
  "appId": "<app_id>",
  "granteeType": "user",
  "granteeId": "<user_id>",
  "permission": "use",
  "reason": "Temporary access for project X",
  "expiresAt": "2024-04-01T00:00:00.000Z"
}
```

**Validation Rules**:
- `granteeType: "user"`: Requires `reason` and `expiresAt` (max 90 days)
- `permission: "deny"`: Explicit deny record

**Response** (201 Created):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a16c-20155584241e25",
    "appId": "550e8400-e29b-41d4-a16c-20155584241e25",
    "granteeType": "user",
    "granteeId": "user-123",
    "permission": "use",
    "reason": "Temporary access",
    "expiresAt": "2024-04-01T00:00:00.000Z",
    "createdAt": "2024-01-01T10:30:00.000Z"
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

**Errors**:
- `400`: Invalid input (missing reason for user grants)
- `403`: Forbidden - Insufficient permissions (`app:grant` required)
- `404`: App not found

#### Revoke Grant

```http
DELETE /api/rbac/grants/:grantId
```

**Description**: Revoke (delete) an existing grant

**Path Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `grantId` | string | Yes | Grant ID |

**Response** (204 No Content): Successful revocation

**Errors**:
- `403`: Forbidden
- `404`: Grant not found

---

### Apps (Context-Aware)

#### Get Accessible Apps

```http
GET /api/rbac/apps/accessible
```

**Description**: Get all applications accessible to the current user, with context switching information

**Headers**:
| Name | Description |
|-------|-------------|
| `X-Active-Group-ID` | Override active group for this request |
| `X-Tenant-ID` | Tenant context from auth token |

**Response** (200 OK):
```json
{
  "data": {
    "apps": [
      {
        "id": "app-123",
        "name": "Project Dashboard",
        "currentGroup": {
          "groupId": "group-abc",
          "groupName": "Team Alpha",
          "hasAccess": true
        },
        "availableGroups": [
          {
            "groupId": "group-abc",
            "groupName": "Team Alpha",
            "hasAccess": true
          },
          {
            "groupId": "group-xyz",
            "groupName": "Team Beta",
            "hasAccess": false
          }
        ],
        "requiresSwitch": false
      }
    ]
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

#### Get App Context Options

```http
GET /api/rbac/apps/:id/context-options
```

**Description**: Get context switching options for a specific application

**Path Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `id` | string | Yes | Application ID |

**Response** (200 OK):
```json
{
  "data": {
    "currentGroup": {
      "groupId": "group-abc",
      "groupName": "Team Alpha",
      "hasAccess": true
    },
    "availableGroups": [
      {
        "groupId": "group-abc",
        "groupName": "Team Alpha",
        "hasAccess": true
      }
    ]
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

---

### Break-glass (Emergency Access)

#### Activate Break-glass

```http
POST /api/rbac/breakglass/activate
```

**Description**: Activate emergency access session for ROOT ADMIN

**Request Body**:
```json
{
  "tenantId": "550e8400-e29b-41d4-a16c-20155584241e25",
  "reason": "Production incident investigation required"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "sessionId": "bg_user123_abc_1234567890",
    "tenantId": "550e8400-e29b-41d4-a16c-20155584241e25",
    "tenantName": "ACME Corp",
    "expiresAt": "2024-01-01T11:00:00.000Z",
    "activatedAt": "2024-01-01T10:00:00.000Z"
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:00:00.000Z"
  }
}
```

**Errors**:
- `403`: Root admin disabled (`AFUI_IAM_007`)
- `400`: Invalid input (reason must be at least 10 characters)

#### Get Break-glass Status

```http
GET /api/rbac/breakglass/status?tenantId=<tenant_id>
```

**Query Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `tenantId` | string | Yes | Target tenant ID |

**Response** (200 OK):
```json
{
  "data": {
    "isActive": true,
    "session": {
      "sessionId": "bg_user123_abc_1234567890",
      "tenantId": "550e8400-e29b-41d4-a16c-20155584241e25",
      "expiresAt": "2024-01-01T11:00:00.000Z",
      "activatedAt": "2024-01-01T10:00:00.000Z"
    },
    "remainingTime": 2341
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

#### Extend Break-glass Session

```http
POST /api/rbac/breakglass/extend
```

**Description**: Extend active break-glass session by 1 hour

**Query Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `tenantId` | string | Yes | Target tenant ID |

**Response** (200 OK):
```json
{
  "data": {
    "sessionId": "bg_user123_abc_1234567890",
    "tenantId": "550e8400-e29b-41d4-a16c-20155584241e25",
    "expiresAt": "2024-01-01T12:00:00.000Z"
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

**Errors**:
- `404`: No active session found

#### Revoke Break-glass

```http
DELETE /api/rbac/breakglass/revoke?tenantId=<tenant_id>
```

**Description**: Immediately revoke active break-glass session

**Query Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `tenantId` | string | Yes | Target tenant ID |

**Response** (204 No Content): Session revoked successfully

---

### Active Group

#### Set Active Group

```http
POST /api/rbac/active-group
```

**Description**: Set the currently active group for the user

**Request Body**:
```json
{
  "groupId": "group-abc"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "groupId": "group-abc",
    "groupName": "Team Alpha",
    "tenantId": "550e8400-e29b-41d4-a16c-20155584241e25"
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

---

### Notifications

#### Get Unread Count

```http
GET /api/notifications/unread-count
```

**Description**: Get count of unread notifications for the current tenant

**Response** (200 OK):
```json
{
  "data": {
    "total": 5,
    "breakglass": 2,
    "other": 3
  },
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

#### Get Break-glass Notifications

```http
GET /api/notifications/breakglass
```

**Description**: Get all break-glass related notifications for the current tenant

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "notif_abc123",
      "type": "breakglass_activated",
      "message": "ROOT ADMIN accessed tenant at 2024-01-01 10:30",
      "metadata": {
        "rootAdminId": "user-root",
        "reason": "Production issue",
        "expiresAt": "2024-01-01T11:00:00.000Z"
      },
      "createdAt": "2024-01-01T10:30:00.000Z",
      "isRead": false
    }
  ],
  "meta": {
    "traceId": "trace_1234567890",
    "timestamp": "2024-01-01T10:30:00.000Z"
  }
}
```

#### Mark Notification as Read

```http
PATCH /api/notifications/:id/read
```

**Description**: Mark a specific notification as read

**Path Parameters**:
| Name | Type | Required | Description |
|-------|--------|-----------|-------------|
| `id` | string | Yes | Notification ID |

**Response** (204 No Content): Notification marked as read

---

## Permission Priority Chain

When checking permissions, the system evaluates in the following order:

1. **Explicit Deny** - If a deny record exists, access is denied
2. **User Direct Grant** - User-level grant with permission='use'
3. **Group Grant / Manager User-Level Grant** - Group-based authorization
4. **RBAC Role Permission** - Permission granted through role assignment
5. **Default Deny** - If no other rules match, access is denied

## Performance Targets

- **Permission Check**: P95 latency ≤ 50ms
- **Cache Invalidation**: ≤ 5s to propagate invalidation
- **Group Switching**: Response time ≤ 300ms

## Audit Events

All RBAC operations generate audit events with the following action types:

| Action | Description |
|---------|-------------|
| `role.assigned` | Role assigned to user |
| `role.removed` | Role removed from user |
| `grant.created` | New grant created |
| `grant.revoked` | Grant revoked |
| `grant.expired` | Grant expired (automatic) |
| `deny.created` | Explicit deny created |
| `deny.revoked` | Explicit deny revoked |
| `breakglass.activated` | Emergency access activated |
| `breakglass.expired` | Emergency access expired |
| `permission.denied` | Permission check failed |
| `conversation.view_others` | Tenant admin viewed user's conversation |
| `view_others.attempted` | Unauthorized view attempt detected |
