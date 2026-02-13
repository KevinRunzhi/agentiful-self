# Developer Quickstart: Multi-Tenant Authentication Base (S1-1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)
**Phase**: 1 - Developer Quick Start Guide
**Date**: 2025-02-10

## Overview

本文档为开发者提供多租户身份认证基座的快速启动指南，涵盖本地开发环境设置、数据库迁移、better-auth 配置、测试运行等核心流程。

## Prerequisites

### Required Software

| Software | Minimum Version | Recommended |
|----------|-----------------|-------------|
| Node.js | 20.x | 22.x LTS |
| pnpm | 8.x | 10.x |
| PostgreSQL | 17 | 18 |
| Redis | 7.x | 7.x |
| Git | 2.x | Latest |

### Required Accounts

- **GitHub**: For cloning repository and CI/CD
- **Resend** (optional): For email delivery in dev environment

---

## 1. Clone and Setup Repository

```bash
# Clone repository
git clone https://github.com/your-org/agentiful.git
cd agentiful

# Install dependencies
pnpm install

# Setup environment files
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
```

### Environment Variables

Create `.env.local` at repository root:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentiful

# Redis
REDIS_URL=redis://localhost:6379

# Session Secret
SESSION_SECRET=your-secret-key-min-32-chars

# JWT Secret
JWT_SECRET=your-jwt-secret-min-32-chars

# Encryption Key (for MFA secrets)
ENCRYPTION_KEY=your-encryption-key-32-chars

# Email (Resend)
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=noreply@yourdomain.com
APP_URL=http://localhost:3000

# Better Auth
BETTER_AUTH_SECRET=your-better-auth-secret
BETTER_AUTH_URL=http://localhost:3001
```

---

## 2. Start Infrastructure Services

### Using Docker Compose (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose -f docker/docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker/docker-compose.dev.yml ps
```

### Manual Setup

```bash
# PostgreSQL 18
# See: https://www.postgresql.org/docs/18/installation.html

# Redis 7.x
# See: https://redis.io/download

# Create database
createdb agentiful
```

---

## 3. Database Setup

### Generate and Run Migrations

```bash
# Generate migration from Drizzle schema
pnpm --filter @agentifui/db db:generate

# Run migration
pnpm --filter @agentifui/db db:migrate

# Seed initial data (optional, for testing)
pnpm --filter @agentifui/db db:seed
```

### Seed Data Structure

Initial seed creates:
1. **System Tenant**: ID `00000000-0000-0000-0000-000000000001`
2. **Root Admin User**: Email `admin@agentifui.com`, Password `Admin123!`
3. **Demo Tenant**: For testing multi-tenant features

---

## 4. Start Development Servers

### Terminal 1: Backend API

```bash
cd apps/api
pnpm dev

# API runs on http://localhost:3001
# Health check: http://localhost:3001/status
```

### Terminal 2: Frontend Web

```bash
cd apps/web
pnpm dev

# Web runs on http://localhost:3000
```

### Terminal 3: Worker (Optional)

```bash
cd apps/worker
pnpm dev

# Worker processes background jobs
```

---

## 5. better-auth Configuration

### Backend Setup (`apps/api/src/modules/auth/`)

```typescript
// auth.config.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@agentifui/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 15 * 60,      // 15 minutes
    updateAge: 5 * 60,       // Update every 5 minutes
    refreshTokenAge: 7 * 24 * 60 * 60, // 7 days
  },
  advanced: {
    cookiePrefix: 'agentiful',
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  // Multi-tenant extension
  plugins: [
    multiTenantPlugin({
      tenantField: 'tenantId',
    }),
  ],
});
```

### Frontend Setup (`apps/web/src/lib/`)

```typescript
// auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  fetchOptions: {
    credentials: 'include',
  },
});
```

---

## 6. Key API Endpoints

### Authentication Endpoints

```bash
# Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "SecurePass123" }

# SSO Detection
GET /api/auth/sso/detect?email=user@company.com

# Switch Tenant
POST /api/auth/switch-tenant
Body: { "tenantId": "target-tenant-uuid" }

# Get Current Session
GET /api/auth/session
Headers: Authorization: Bearer {token}
```

### User Management Endpoints

```bash
# Get User Profile
GET /api/users/me

# Update User Profile
PATCH /api/users/me

# Get User Groups
GET /api/users/me/groups
```

### Tenant Management Endpoints

```bash
# Get Tenant Config
GET /api/tenants/:tenantId/config

# Update Tenant Config
PATCH /api/tenants/:tenantId/config
```

---

## 7. Testing

### Run Unit Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @agentifui/api test

# Watch mode
pnpm test:watch
```

### Run E2E Tests

```bash
# Playwright E2E
pnpm test:e2e

# Specific test file
pnpm playwright test auth/login.spec.ts
```

### Test Accounts

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| admin@agentifui.com | Admin123! | ROOT_ADMIN | System |
| tenant-admin@example.com | Admin123! | TENANT_ADMIN | Demo |
| user@example.com | User123! | USER | Demo |

---

## 8. Common Development Tasks

### Add New SSO Provider

```typescript
// apps/api/src/modules/auth/sso/providers/custom.provider.ts
import { OAuth2Client } from './oauth2-client';

export const customSSOProvider = {
  type: 'oauth2',
  id: 'custom',
  name: 'Custom SSO',
  authorizationUrl: 'https://sso.example.com/authorize',
  tokenUrl: 'https://sso.example.com/token',
  userinfoUrl: 'https://sso.example.com/userinfo',
  // ... config
};
```

### Add New Password Policy Rule

```typescript
// apps/api/src/modules/auth/services/password-policy.service.ts
export function validatePassword(
  password: string,
  policy: PasswordPolicy
): ValidationResult {
  // Add custom validation rules
}
```

### Enable MFA for Testing

1. Login as any user
2. Navigate to Settings → Security
3. Click "Enable MFA"
4. Scan QR code with authenticator app
5. Enter verification code to confirm

---

## 9. Debugging

### Enable Debug Logging

```bash
# Backend
DEBUG=better-auth:* pnpm --filter @agentifui/api dev

# Frontend
NEXT_PUBLIC_DEBUG=true pnpm --filter @agentifui/web dev
```

### Check Session State

```bash
# View Redis sessions
redis-cli
> KEYS session:*
> GET session:{session-id}
```

### View Audit Logs

```bash
# Query audit events
psql agentiful
> SELECT * FROM audit_event ORDER BY created_at DESC LIMIT 10;
```

---

## 10. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection failed | Check DATABASE_URL, ensure PostgreSQL is running |
| Redis connection failed | Check REDIS_URL, ensure Redis is running |
| Migration failed | Drop database and recreate: `dropdb agentiful && createdb agentiful` |
| Email not sending | Verify RESEND_API_KEY, check spam folder |
| SSO redirect loop | Check callback URL configuration, ensure CORS is set |
| Session expired too quickly | Check session.expiryIn in better-auth config |

### Reset Development Environment

```bash
# Stop all services
docker-compose -f docker/docker-compose.dev.yml down

# Reset database
dropdb agentiful
createdb agentiful
pnpm --filter @agentifui/db db:migrate
pnpm --filter @agentifui/db db:seed

# Clear Redis
redis-cli FLUSHALL

# Restart services
docker-compose -f docker/docker-compose.dev.yml up -d
```

---

## 11. Next Steps

1. **Read the API Contracts**: `contracts/auth-api.md`, `contracts/user-api.md`, `contracts/tenant-api.md`
2. **Review Data Model**: `data-model.md` for complete entity definitions
3. **Explore Frontend Components**: `apps/web/src/features/auth/`
4. **Implement Custom Logic**: Add tenant-specific business rules in `apps/api/src/modules/`

---

## 12. Resources

### Documentation

- [better-auth Docs](https://www.better-auth.com)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Fastify Docs](https://fastify.dev)

### Internal Docs

- [TECHNOLOGY_STACK.md](../../docs/tech/TECHNOLOGY_STACK.md)
- [REPO_STRUCTURE.md](../../docs/tech/practices/REPO_STRUCTURE.md)
- [Constitution](../../.specify.specify/memory/constitution.md)

---

*本文档由 `/speckit.plan` 命令 Phase 1 生成*
