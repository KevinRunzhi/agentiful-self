# Architecture Documentation

## System Architecture

Agentiful is a multi-tenant authentication system built with:

- **Frontend**: Next.js 16 + React 19 + Zustand
- **Backend**: Fastify 5.x + better-auth
- **Database**: PostgreSQL 18 with Drizzle ORM
- **Cache**: Redis 7.x for sessions and rate limiting

## Multi-Tenancy Model

### User Entity
- Global entity (no tenant_id)
- Can belong to multiple tenants via UserRole

### Tenant Entity
- Contains: id, name, slug, status, plan, customConfig
- Status: active, suspended, inactive
- CustomConfig stores JSON settings for features

### UserRole Entity (N:N)
- Links Users to Tenants with role
- Roles: admin, manager, member
- Supports expiration dates

### Group Entity
- Tenant-scoped organization units
- Contains users with roles within the tenant
- Manager permissions are group-scoped only

## Authentication Flow

1. **Invitation Flow**:
   - Tenant Admin creates invitation → Email sent with token
   - User clicks link → Sets password → Account created (pending status)
   - Tenant Admin approves → User status changes to active
   - User can sign in

2. **SSO Flow**:
   - User enters email → System detects SSO from domain
   - Redirected to OAuth provider
   - JIT provisioning creates account automatically
   - User logged in

3. **MFA Flow**:
   - User enables MFA → Scans QR code → Enters TOTP code
   - Subsequent logins require TOTP verification

## Security Features

- **Account Lockout**: 5 failed attempts → 30 minute lockout
- **Password Policy**: Min 8 chars, uppercase, lowercase, number
- **Password History**: Cannot reuse last 5 passwords
- **Audit Logging**: All critical actions logged with trace ID

## Observability

- **Trace ID**: W3C trace context propagated through all requests
- **Structured Logging**: Pino logger with JSON output
- **Audit Events**: Stored in audit_event table
