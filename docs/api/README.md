# API Documentation

## Overview

The Agentiful API provides a RESTful interface for multi-tenant authentication and user management.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Most endpoints require authentication via Bearer token:

```
Authorization: Bearer <session_token>
```

Include tenant context via header:

```
X-Tenant-ID: <tenant_id>
```

## Endpoints

### Authentication

#### POST /auth/sign-in
Sign in with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "tenantSlug": "acme-corp"
}
```

**Response:**
```json
{
  "session": {
    "id": "session_id",
    "token": "access_token",
    "user": { "id": "user_id", "email": "user@example.com", "name": "User Name" },
    "tenants": [...]
  }
}
```

#### POST /auth/sign-out
Sign out current session.

#### GET /auth/session
Get current session info.

### Tenants

#### GET /tenants
Get user's accessible tenants.

#### GET /tenants/:idOrSlug
Get tenant by ID or slug.

#### POST /tenants/switch
Switch active tenant context.

### Groups

#### GET /groups
Get all groups for current tenant.

#### GET /groups/:id
Get group details with member count.

#### POST /groups
Create new group (tenant admin only).

#### PATCH /groups/:id
Update group.

#### DELETE /groups/:id
Delete group.

#### GET /groups/:id/members
Get group members.

#### POST /groups/:id/members
Add member to group.

#### DELETE /groups/members/:id
Remove member from group.

### Users

#### GET /users/me
Get current user profile.

#### PATCH /users/me
Update current user profile.

#### GET /users/approvals
Get pending approval queue (admin).

#### POST /users/:id/approve
Approve pending user (admin).

#### POST /users/:id/reject
Reject pending user (admin).

### SSO

#### POST /sso/detect
Detect SSO provider for email.

#### GET /sso/configs
Get SSO configurations for tenant.

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "traceId": "trace_id"
  }
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error
