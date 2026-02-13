# Data Model: Multi-Tenant Authentication Base (S1-1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Research**: [research.md](../research.md)
**Phase**: 1 - Data Model Design
**Date**: 2025-02-10

## Overview

本文档定义多租户身份认证基座的完整数据模型，包括所有实体、关系、索引和约束。基于 Drizzle ORM 和 PostgreSQL 18。

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     User        │       │     Tenant      │       │     Group       │
│─────────────────│       │─────────────────│       │─────────────────│
│ id (PK)         │       │ id (PK)         │───────│ id (PK)         │
│ email           │       │ name            │  1    │ tenant_id (FK)  │
│ name            │       │ status          │       │ name            │
│ avatar_url      │       │ plan            │       │ description     │
│ status          │       │ custom_config   │       │ sort_order      │
│ email_verified  │       │ created_at      │       │ created_at      │
│ mfa_enabled     │       └─────────────────┘       └─────────────────┘
│ preferences     │                │
│ mfa_forced      │                │
│ created_at      │                │
│ updated_at      │                │
└────────┬────────┘                │
         │                         │
         │ N               N       │ 1
         │ ┌────────────────────────┘
         │ │ UserRole
         │ │─────────────────┐
         │ │ id (PK)         │
         │ │ user_id (FK)    │
         │ │ tenant_id (FK)  │
         │ │ role            │
         │ │ expires_at      │
         │ │ created_at      │
         │ └─────────────────┘
         │
         │ N                 N
         │ ┌──────────────────────────┐
         │ │     GroupMember          │
         │ │──────────────────────────│
         │ │ id (PK)                  │
         │ │ group_id (FK)            │
         │ │ user_id (FK)             │
         │ │ role (member/manager)    │
         │ │ created_at               │
         │ └──────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│                      Supporting Entities                        │
├─────────────────────────┬───────────────────────────────────────┤
│ MFASecret               │ SSOConfig                             │
│─────────────────────────│───────────────────────────────────────│
│ id (PK)                 │ id (PK)                               │
│ user_id (FK)            │ tenant_id (FK)                        │
│ secret_encrypted        │ email_domain                          │
│ backup_codes_encrypted  │ provider_type                         │
│ enabled                 │ config                                │
│ verified_at             │ enabled                               │
│ created_at              │ priority                              │
└─────────────────────────┤ created_at                            │
                          └───────────────────────────────────────┘
┌─────────────────────────┬───────────────────────────────────────┤
│ Invitation              │ AuditEvent                            │
│─────────────────────────│───────────────────────────────────────│
│ id (PK)                 │ id (PK)                               │
│ tenant_id (FK)          │ tenant_id (FK)                        │
│ token                   │ actor_user_id                         │
│ email                   │ actor_type                            │
│ role                    │ action                                │
│ expires_at              │ resource_type                         │
│ status                  │ resource_id                           │
│ created_at              │ result                                │
└─────────────────────────│ error_message                         │
                          │ ip_address                            │
┌─────────────────────────│ user_agent                            │
│ PasswordHistory         │ trace_id                              │
│─────────────────────────│ metadata (JSONB)                      │
│ id (PK)                 │ created_at                            │
│ user_id (FK)            └───────────────────────────────────────┘
│ password_hash           ┌───────────────────────────────────────┤
│ created_at              │ Session (better-auth managed)         │
└─────────────────────────│───────────────────────────────────────│
                          │ id (PK)                               │
                          │ user_id (FK)                          │
                          │ tenant_id (extended field)            │
                          │ token                                 │
                          │ expires_at                            │
                          │ created_at                            │
                          └───────────────────────────────────────┘
```

## Core Entities

### User (全局用户实体)

用户是全局实体，**不包含** `tenant_id`。用户与租户的关系通过 `UserRole` 关联表实现。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 用户唯一标识 |
| email | VARCHAR(255) | NOT NULL, UNIQUE | 邮箱地址（全局唯一） |
| name | VARCHAR(255) | | 用户显示名称 |
| avatar_url | TEXT | | 头像 URL |
| phone | VARCHAR(50) | | 手机号 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 状态: active, pending, suspended, rejected |
| email_verified | BOOLEAN | DEFAULT FALSE | 邮箱是否已验证 |
| mfa_enabled | BOOLEAN | DEFAULT FALSE | 是否启用 MFA |
| mfa_forced | BOOLEAN | DEFAULT FALSE | 是否被管理员强制启用 MFA |
| preferences | JSONB | DEFAULT '{}' | 用户偏好设置 {language, timezone, theme} |
| last_active_at | TIMESTAMPTZ | | 最后活跃时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**Indexes**:
- `idx_user_email` ON (email)
- `idx_user_status` ON (status) WHERE status != 'deleted'

**Drizzle Schema**:
```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  phone: varchar('phone', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  emailVerified: boolean('email_verified').default(false),
  mfaEnabled: boolean('mfa_enabled').default(false),
  mfaForced: boolean('mfa_forced').default(false),
  preferences: jsonb('preferences').$type<{
    language?: string;
    timezone?: string;
    theme?: 'light' | 'dark' | 'system';
  }>().default({}),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

### Tenant (租户实体)

租户是最高级数据隔离与治理单元。UI 中展示为 "Workspace"。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 租户唯一标识 |
| name | VARCHAR(255) | NOT NULL | 租户名称 |
| slug | VARCHAR(100) | UNIQUE | 租户标识符（用于 URL） |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 状态: active, suspended |
| plan | VARCHAR(50) | DEFAULT 'free' | 订阅计划 |
| custom_config | JSONB | DEFAULT '{}' | 租户自定义配置 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**custom_config 结构**:
```typescript
{
  // 认证配置
  auth: {
    emailPasswordEnabled: boolean;
    requireEmailVerification: boolean;
  },

  // 密码策略
  passwordPolicy: {
    minLength: number;          // 默认 8
    requireUppercase: boolean;  // 默认 true
    requireLowercase: boolean;  // 默认 true
    requireNumbers: boolean;    // 默认 true
    requireSpecialChars: boolean; // 默认 false
    expireDays?: number;        // 30-365, null 表示不过期
    historyLimit: number;       // 3-12, 默认 5
  },

  // 账号锁定策略
  accountLockout: {
    enabled: boolean;           // 默认 true
    maxAttempts: number;        // 默认 5
    lockoutDurationMinutes: number; // 默认 30
  },

  // MFA 策略
  mfaPolicy: 'required' | 'optional' | 'disabled'; // 默认 'optional'

  // 用户审核
  userApproval: {
    enabled: boolean;           // 默认 false
    ssoBypassApproval: boolean; // 默认 true
  },

  // 默认语言
  defaultLanguage: string;      // 默认 'en'

  // 主题偏好
  defaultTheme: 'light' | 'dark' | 'system'; // 默认 'system'
}
```

**Indexes**:
- `idx_tenant_slug` ON (slug)
- `idx_tenant_status` ON (status)

**Drizzle Schema**:
```typescript
export const tenant = pgTable('tenant', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  plan: varchar('plan', { length: 50 }).default('free'),
  customConfig: jsonb('custom_config').$type<TenantConfig>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

### UserRole (用户-租户关联表)

实现 User 与 Tenant 的 N:N 关系。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 关联记录 ID |
| user_id | UUID | FK(user.id), NOT NULL | 用户 ID |
| tenant_id | UUID | FK(tenant.id), NOT NULL | 租户 ID |
| role | VARCHAR(50) | NOT NULL | 角色: ROOT_ADMIN, TENANT_ADMIN, USER |
| expires_at | TIMESTAMPTZ | | 过期时间（NULL 表示永久） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**Roles**:
- `ROOT_ADMIN`: 系统超级管理员（跨所有租户）
- `TENANT_ADMIN`: 租户管理员（仅本租户）
- `USER`: 普通用户

**Indexes**:
- `idx_user_role_user_tenant` ON (user_id, tenant_id) UNIQUE
- `idx_user_role_tenant` ON (tenant_id)

**Drizzle Schema**:
```typescript
export const userRole = pgTable('user_role', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenant.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(), // 'ROOT_ADMIN' | 'TENANT_ADMIN' | 'USER'
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

### Group (群组实体)

Tenant 内的组织单元，用于成员组织、应用授权和配额分配。UI 中展示为 "Team"。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 群组唯一标识 |
| tenant_id | UUID | FK(tenant.id), NOT NULL | 所属租户 |
| name | VARCHAR(255) | NOT NULL | 群组名称 |
| description | TEXT | | 群组描述 |
| sort_order | INTEGER | DEFAULT 0 | 排序顺序 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**Constraints**:
- 同一租户内群组名称唯一：(tenant_id, name) UNIQUE

**Indexes**:
- `idx_group_tenant` ON (tenant_id)
- `idx_group_tenant_name` ON (tenant_id, name) UNIQUE

**Drizzle Schema**:
```typescript
export const group = pgTable('group', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenant.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

### GroupMember (群组成员关联表)

实现 User 与 Group 的 N:N 关系，支持 member/manager 角色。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 关联记录 ID |
| group_id | UUID | FK(group.id), NOT NULL | 群组 ID |
| user_id | UUID | FK(user.id), NOT NULL | 用户 ID |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'member' | 角色: member, manager |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 加入时间 |

**Roles**:
- `manager`: 群组管理员，可管理群组成员
- `member`: 普通成员

**Indexes**:
- `idx_group_member_group_user` ON (group_id, user_id) UNIQUE
- `idx_group_member_user` ON (user_id)

**Drizzle Schema**:
```typescript
export const groupMember = pgTable('group_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => group.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull().default('member'), // 'member' | 'manager'
  createdAt: timestamp('created_at').defaultNow(),
});
```

## Supporting Entities

### MFASecret (MFA 密钥存储)

存储用户的 TOTP 密钥和备份码。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 记录 ID |
| user_id | UUID | FK(user.id), UNIQUE, NOT NULL | 用户 ID |
| secret_encrypted | TEXT | NOT NULL | 加密的 TOTP 密钥 |
| backup_codes_encrypted | TEXT[] | | 加密的备份码列表 |
| enabled | BOOLEAN | DEFAULT FALSE | 是否已启用 |
| verified_at | TIMESTAMPTZ | | 首次验证时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**Indexes**:
- `idx_mfa_secret_user` ON (user_id) UNIQUE

**Drizzle Schema**:
```typescript
export const mfaSecret = pgTable('mfa_secret', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }).unique(),
  secretEncrypted: text('secret_encrypted').notNull(),
  backupCodesEncrypted: text('backup_codes_encrypted').array(),
  enabled: boolean('enabled').default(false),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

### SSOConfig (SSO 配置)

存储租户的 SSO 提供商配置。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 记录 ID |
| tenant_id | UUID | FK(tenant.id), NOT NULL | 租户 ID |
| email_domain | VARCHAR(255) | NOT NULL | 邮箱域名（@domain.com） |
| provider_type | VARCHAR(50) | NOT NULL | SSO 类型 |
| config | JSONB | NOT NULL | 提供商特定配置 |
| enabled | BOOLEAN | DEFAULT TRUE | 是否启用 |
| priority | INTEGER | DEFAULT 0 | 优先级（多配置时排序） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**provider_type 枚举**:
- `google`: Google OAuth2
- `github`: GitHub OAuth2
- `wechat`: WeChat OAuth2
- `cas`: CAS
- `oidc`: OpenID Connect
- `saml`: SAML 2.0
- `oauth2`: 通用 OAuth2

**config 结构（示例）**:
```typescript
// Google OAuth2
{
  clientId: string;
  clientSecret: string;
  hd: string;  // hosted domain
}

// OIDC
{
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

// SAML
{
  idpEntityId: string;
  idpSsoUrl: string;
  idpX509Cert: string;
  spEntityId: string;
  acsUrl: string;
}
```

**Indexes**:
- `idx_sso_config_tenant_domain` ON (tenant_id, email_domain, provider_type) UNIQUE
- `idx_sso_config_email_domain` ON (email_domain) WHERE enabled = TRUE

**Drizzle Schema**:
```typescript
export const ssoConfig = pgTable('sso_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenant.id, { onDelete: 'cascade' }),
  emailDomain: varchar('email_domain', { length: 255 }).notNull(),
  providerType: varchar('provider_type', { length: 50 }).notNull(),
  config: jsonb('config').notNull(),
  enabled: boolean('enabled').default(true),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

### Invitation (用户邀请记录)

存储用户邀请链接信息。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 记录 ID |
| tenant_id | UUID | FK(tenant.id), NOT NULL | 租户 ID |
| token | VARCHAR(255) | UNIQUE, NOT NULL | 邀请 Token |
| email | VARCHAR(255) | NOT NULL | 被邀请邮箱 |
| role | VARCHAR(50) | NOT NULL | 邀请角色 |
| group_id | UUID | FK(group.id) | 邀请加入的群组（可选） |
| expires_at | TIMESTAMPTZ | NOT NULL | 过期时间 |
| status | VARCHAR(20) | DEFAULT 'pending' | 状态: pending, used, expired, revoked |
| created_by | UUID | FK(user.id) | 创建者用户 ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| used_at | TIMESTAMPTZ | | 使用时间 |

**Indexes**:
- `idx_invitation_token` ON (token) UNIQUE
- `idx_invitation_tenant` ON (tenant_id)

**Drizzle Schema**:
```typescript
export const invitation = pgTable('invitation', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenant.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  groupId: uuid('group_id').references(() => group.id),
  expiresAt: timestamp('expires_at').notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'used' | 'expired' | 'revoked'
  createdBy: uuid('created_by').references(() => user.id),
  createdAt: timestamp('created_at').defaultNow(),
  usedAt: timestamp('used_at'),
});
```

---

### PasswordHistory (密码历史记录)

存储用户历史密码哈希，用于防止重复使用旧密码。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 记录 ID |
| user_id | UUID | FK(user.id), NOT NULL | 用户 ID |
| password_hash | TEXT | NOT NULL | 密码哈希（bcrypt） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**Indexes**:
- `idx_password_history_user` ON (user_id, created_at DESC)

**Drizzle Schema**:
```typescript
export const passwordHistory = pgTable('password_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

### AuditEvent (审计事件)

记录所有关键操作的审计日志。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 事件 ID |
| tenant_id | UUID | FK(tenant.id) | 租户 ID（可为空，系统级事件） |
| actor_user_id | UUID | FK(user.id) | 操作者用户 ID |
| actor_type | VARCHAR(50) | NOT NULL | 操作者类型: user, system, admin |
| action | VARCHAR(100) | NOT NULL | 操作类型 |
| resource_type | VARCHAR(100) | | 资源类型 |
| resource_id | UUID | | 资源 ID |
| result | VARCHAR(20) | NOT NULL | 结果: success, failure, partial |
| error_message | TEXT | | 错误信息 |
| ip_address | INET | | IP 地址 |
| user_agent | TEXT | | User Agent |
| trace_id | VARCHAR(100) | NOT NULL | Trace ID |
| metadata | JSONB | | 额外元数据 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 事件时间 |

**action 枚举（示例）**:
- `login`: 用户登录
- `logout`: 用户登出
- `login.failed`: 登录失败
- `user.create`: 创建用户
- `user.invite`: 邀请用户
- `user.approve`: 审核通过用户
- `user.reject`: 拒绝用户
- `user.suspend`: 暂停用户
- `user.activate`: 激活用户
- `user.password.reset`: 重置密码
- `mfa.enable`: 启用 MFA
- `mfa.disable`: 禁用 MFA
- `session.revoke`: 撤销会话

**Indexes**:
- `idx_audit_tenant_id` ON (tenant_id)
- `idx_audit_actor_id` ON (actor_user_id)
- `idx_audit_trace_id` ON (trace_id)
- `idx_audit_created_at` ON (created_at DESC)

**Drizzle Schema**:
```typescript
export const auditEvent = pgTable('audit_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenant.id),
  actorUserId: uuid('actor_user_id').references(() => user.id),
  actorType: varchar('actor_type', { length: 50 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: uuid('resource_id'),
  result: varchar('result', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
  ipAddress: varchar('ip_address', { length: 45 }), // INET type compatible
  userAgent: text('user_agent'),
  traceId: varchar('trace_id', { length: 100 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

### Session (会话 - better-auth 管理)

better-auth 管理的会话表，扩展字段包含租户上下文。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | 会话 ID |
| user_id | UUID | FK(user.id), NOT NULL | 用户 ID |
| tenant_id | UUID | NOT NULL | 当前租户 ID（扩展字段） |
| token | VARCHAR(255) | UNIQUE | Session token |
| expires_at | TIMESTAMPTZ | NOT NULL | 过期时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**Drizzle Schema (better-auth 扩展)**:
```typescript
// better-auth 会自动创建基础 session 表
// 我们通过扩展字段添加 tenant_id
export const session = pgTable('session', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id),
  tenantId: uuid('tenant_id').notNull(), // 扩展字段
  token: varchar('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## Data Isolation Rules

### Tenant Isolation

1. **业务表必须包含 `tenant_id`**: 除了 `User` 表，所有业务表都包含 `tenant_id` 字段。
2. **查询自动过滤**: Repository 层自动注入 `tenant_id` 过滤条件。
3. **跨租户访问拒绝**: 用户尝试访问其他租户数据时，系统拒绝访问并记录异常审计事件。

### User-Tenant Relationship

1. **用户可属于多个租户**: 通过 `UserRole` 表实现 N:N 关系。
2. **租户上下文切换**: 用户登录后提供 Tenant/Workspace 选择器。
3. **单租户上下文执行**: 每次请求必须在单一租户上下文中执行。

### Group Scoping

1. **群组属于租户**: `Group.tenant_id` 确保群组隔离。
2. **成员关联验证**: 添加群组成员时验证用户是否属于该租户。

## Migration Strategy

### Initial Migration

```sql
-- 1. 创建核心表
CREATE TABLE tenant (...);
CREATE TABLE user (...);

-- 2. 创建关联表
CREATE TABLE user_role (...);
CREATE TABLE "group" (...);
CREATE TABLE group_member (...);

-- 3. 创建扩展表
CREATE TABLE mfa_secret (...);
CREATE TABLE sso_config (...);
CREATE TABLE invitation (...);
CREATE TABLE password_history (...);
CREATE TABLE audit_event (...);

-- 4. 创建索引
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_user_role_user_tenant ON user_role(user_id, tenant_id);
CREATE INDEX idx_sso_config_email_domain ON sso_config(email_domain) WHERE enabled = TRUE;
-- ... 其他索引
```

### Seed Data

```sql
-- 创建默认系统管理员租户
INSERT INTO tenant (id, name, slug, status, plan, custom_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System',
  'system',
  'active',
  'enterprise',
  '{"mfaPolicy": "required", "auth": {"emailPasswordEnabled": true}}'
);

-- 创建 ROOT_ADMIN 用户（需要在应用层通过 bcrypt 哈希密码）
INSERT INTO user (id, email, name, status, email_verified)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin@agentifui.com',
  'System Administrator',
  'active',
  true
);

-- 关联 ROOT_ADMIN 用户到 system 租户
INSERT INTO user_role (user_id, tenant_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'ROOT_ADMIN'
);
```

---

*本文档由 `/speckit.plan` 命令 Phase 1 生成*
