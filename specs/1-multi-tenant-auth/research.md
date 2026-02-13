# Technical Research: Multi-Tenant Authentication Base (S1-1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)
**Phase**: 0 - Technical Research & Decisions
**Date**: 2025-02-10

## Overview

本文档记录多租户身份认证基座的技术研究和关键决策。研究范围覆盖认证库选型、多租户架构实现、SSO 集成、MFA 实现、会话管理等领域。

## Research Topics

### R-001: Authentication Library Selection

**Question**: 选择哪个认证库来支撑邮箱密码登录、SSO、MFA 等多种认证方式？

**Options Evaluated**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| better-auth | TypeScript-first, 多租户支持, 内置 OAuth2/OIDC/SAML, TOTP MFA, 会话管理, 数据库适配器丰富 | 相对较新, 文档仍在完善 | ✅ SELECTED |
| Lucia | 轻量级, TypeScript, 灵活性高 | 需手动实现多租户, SSO 需额外配置, 无内置 MFA | ❌ Rejected |
| NextAuth.js | Next.js 深度集成, OAuth2 支持好 | 多租户支持弱, 与 Fastify 后端集成复杂 | ❌ Rejected |
| Auth.js (更名后) | 框架无关 | 仍偏向前端/Next.js 生态 | ❌ Rejected |
| Passport.js | 成熟稳定, 策略丰富 | 老旧架构, 非 TypeScript, 会话管理需自建 | ❌ Rejected |

**Decision**: **better-auth**

**Rationale**:
- TypeScript 全栈，与项目技术栈完美契合
- 内置多租户支持（通过 `tenantId` 字段和组织概念）
- 原生支持 OAuth2、OIDC、SAML、TOTP MFA
- 会话管理内置（Access Token + Refresh Token）
- 数据库适配器支持 Drizzle ORM（项目已选）
- 支持自定义插件扩展

**Configuration Requirements**:
```typescript
// better-auth 核心配置
- database: drizzleAdapter
- session: { tokenAge: '15 min', refreshTokenAge: '7 days' }
- emailAndPassword: { enabled: true }
- oauth: { providers: ['google', 'github', ...] }
- twoFactor: { enabled: true, totp: true }
- multiTenant: { enabled: true }
```

---

### R-002: Multi-Tenant User Relationship Implementation

**Question**: 如何实现用户与租户的 N:N 关系，同时保证 User 作为全局实体？

**Domain Model**:
```
User (全局实体, 无 tenantId)
  ↑ N       N ↓
UserRole (关联表)
  ├─ userId
  ├─ tenantId
  ├─ roleId (ROOT_ADMIN | TENANT_ADMIN | USER)
  └─ expiresAt (可选, 用于临时访问)
  ↓ N       1 ↑
Tenant (租户实体)
```

**Implementation Approach**:

1. **数据库层 (Drizzle ORM)**:
```sql
-- user 表 (无 tenantId)
CREATE TABLE user (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  status VARCHAR(20), -- active | pending | suspended | rejected
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- tenant 表
CREATE TABLE tenant (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  plan VARCHAR(50) DEFAULT 'free',
  custom_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_role (N:N 关联)
CREATE TABLE user_role (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'ROOT_ADMIN' | 'TENANT_ADMIN' | 'USER'
  expires_at TIMESTAMPTZ, -- NULL 表示永久
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- group 表 (有 tenantId)
CREATE TABLE "group" (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- group_member (用户-群组关联)
CREATE TABLE group_member (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES "group"(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'member' | 'manager'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
```

2. **应用层 (Tenant Context)**:
```typescript
// 请求上下文中携带当前租户 ID
interface RequestContext {
  userId: string;
  tenantId: string;  // 从 JWT 或会话中提取
  traceId: string;
  roles: string[];   // 用户在当前租户的角色列表
}

// 数据访问层自动注入租户过滤
class BaseRepository {
  protected tenantId: string;

  constructor(context: RequestContext) {
    this.tenantId = context.tenantId;
  }

  // 自动添加 tenant_id 条件
  protected withTenant<T extends { tenantId?: string }>(query: T) {
    return { ...query, tenantId: this.tenantId };
  }
}
```

3. **better-auth 集成**:
```typescript
// better-auth 支持 multi-tenant 插件
auth({
  database: drizzleAdapter,
  multiTenant: {
    enabled: true,
    tenantgetField: 'tenantId',  // 从 session 中获取
  },
  // 自定义 session 以包含 user_roles
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 分钟缓存
    },
  }
});
```

**Decision**: 使用 Drizzle ORM 定义 User（无 tenantId）、Tenant、UserRole（关联表）、Group（有 tenantId）、GroupMember。应用层通过 RequestContext 传递租户上下文，Repository 层自动注入 tenant_id 过滤。

---

### R-003: SSO Domain Detection & Matching

**Question**: 如何在 500ms 内检测用户输入的邮箱域名并返回匹配的 SSO 登录方式？

**Requirements**:
- 响应时间 P95 ≤ 500ms
- 支持多个 Tenant 配置相同邮箱域名（返回多个选项）
- SSO 服务不可用时降级到邮箱密码登录

**Implementation**:

1. **SSO 配置存储**:
```sql
CREATE TABLE sso_config (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  email_domain VARCHAR(255) NOT NULL,  -- @company.com
  provider_type VARCHAR(50) NOT NULL,  -- 'google' | 'github' | 'oidc' | 'saml' | 'oauth2'
  config JSONB NOT NULL,  -- provider-specific config
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email_domain, provider_type)
);

-- 索引用于快速域名匹配
CREATE INDEX idx_sso_email_domain ON sso_config(email_domain) WHERE enabled = TRUE;
```

2. **Redis 缓存策略**:
```typescript
// 缓存 SSO 配置 (TTL: 5 分钟)
const cacheKey = `sso:domain:${domain}`;
let configs = await redis.get(cacheKey);

if (!configs) {
  configs = await db.query.ssoConfig.findMany({
    where: eq(ssoConfig.emailDomain, domain),
    with: { tenant: { columns: { id: true, name: true } } }
  });
  await redis.setex(cacheKey, 300, JSON.stringify(configs));
}

return configs.map(c => ({
  tenantId: c.tenantId,
  tenantName: c.tenant.name,
  provider: c.providerType,
  loginUrl: `/auth/sso/${c.providerType}?tenantId=${c.tenantId}`
}));
```

3. **前端实时检测**:
```typescript
// 用户输入邮箱后 300ms debounce
const detectSSO = useDebounceFn(async (email: string) => {
  const domain = email.split('@')[1];
  if (!domain) return [];

  const { data } = await authApi.detectSSO(domain);
  return data; // [{ tenantId, tenantName, provider, loginUrl }]
}, 300);
```

**Performance Analysis**:
- Redis 缓存命中: ~2-5ms
- 数据库查询 (带索引): ~10-20ms
- 网络往返: ~50-100ms
- 总延迟: P95 < 200ms（满足 ≤ 500ms 要求）

**Decision**: 使用 Redis 缓存 SSO 配置，前端 300ms debounce 防抖，数据库查询带索引优化。

---

### R-004: MFA (TOTP) Implementation

**Question**: 如何实现 TOTP 多因素认证，支持租户级策略和用户级强制？

**Requirements**:
- 支持 TOTP (Google Authenticator, Authy, etc.)
- 租户级策略：强制、可选、关闭
- 管理员可对特定用户强制启用 MFA
- 密钥加密存储

**Implementation**:

1. **MFA 密钥存储**:
```sql
CREATE TABLE mfa_secret (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,  -- 加密存储
  backup_codes_encrypted TEXT[],   -- 备份码（加密）
  enabled BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,  -- 首次验证时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

2. **TOTP 生成与验证**:
```typescript
import { authenticator } from 'otplib';

// 生成密钥
const secret = authenticator.generateSecret();
const otpauthUrl = authenticator.keyuri(user.email, 'AgentifUI', secret);

// 加密存储密钥
const encryptedSecret = await encrypt(secret, encryptionKey);
await db.insert(mfaSecret).values({
  userId: user.id,
  secretEncrypted: encryptedSecret,
  enabled: false, // 需验证后才启用
});

// 验证 TOTP
const isValid = authenticator.verify({
  token: userToken,
  secret: decryptedSecret,
});
```

3. **策略判定**:
```typescript
function getMFARequirement(user: User, tenant: Tenant): 'required' | 'optional' | 'disabled' {
  // 用户级强制优先
  if (user.mfaForced) return 'required';

  // 租户级策略
  const tenantPolicy = tenant.customConfig?.mfaPolicy || 'optional';
  return tenantPolicy;
}

// 登录流程中检查
const mfaReq = getMFARequirement(user, tenant);
if (mfaReq === 'required' && !user.mfaEnabled) {
  // 要求用户设置 MFA
  return { nextStep: 'SETUP_MFA' };
} else if (user.mfaEnabled) {
  return { nextStep: 'VERIFY_MFA' };
}
```

**better-auth 集成**:
```typescript
auth({
  twoFactor: {
    issuer: 'AgentifUI',
    totp: {
      enabled: true,
      // 自定义存储逻辑
      getTenantId: (req) => req.tenantId,
    }
  }
});
```

**Decision**: 使用 `otplib` 生成和验证 TOTP，密钥使用 AES-256-GCM 加密存储，策略判定优先级：用户级强制 > 租户级策略。

---

### R-005: Session & Token Management

**Question**: 如何管理 Access Token 和 Refresh Token，支持租户切换和会话撤销？

**Requirements**:
- Access Token 有效期：15 分钟（better-auth 默认）
- Refresh Token 有效期：7 天（better-auth 默认）
- 支持多租户用户切换 Workspace
- 管理员可撤销用户会话

**Implementation**:

1. **Token 结构**:
```typescript
// Access Token (JWT)
interface JWTPayload {
  userId: string;
  tenantId: string;      // 当前选中的租户
  roles: string[];       // 在当前租户的角色
  exp: number;           // 15 分钟后过期
  iat: number;
  traceId: string;       // Trace ID（用于追踪）
}

// Refresh Token (存储在数据库/Redis)
interface RefreshToken {
  id: string;
  userId: string;
  tenantId: string;
  token: string;         // 哈希存储
  expiresAt: Date;       // 7 天后过期
  createdAt: Date;
}
```

2. **租户切换**:
```typescript
// 用户切换租户时重新生成 Access Token
async function switchTenant(userId: string, newTenantId: string) {
  // 验证用户是否属于该租户
  const userRole = await db.query.userRole.findFirst({
    where: and(
      eq(userRole.userId, userId),
      eq(userRole.tenantId, newTenantId)
    )
  });

  if (!userRole) throw new Error('Not a member of this tenant');

  // 生成新的 Access Token
  const newToken = await signJWT({
    userId,
    tenantId: newTenantId,
    roles: [userRole.role],
  });

  // 更新 session 中的 tenantId
  await updateSession(sessionId, { tenantId: newTenantId });

  return { token: newToken };
}
```

3. **会话撤销**:
```typescript
// 管理员撤销用户会话
async function revokeUserSessions(userId: string, tenantId: string) {
  await db.delete(session)
    .where(and(
      eq(session.userId, userId),
      eq(session.tenantId, tenantId)
    ));

  // 发布 Redis 通知，使 token 立即失效
  await redis.publish(`session:revoke:${userId}`, JSON.stringify({ tenantId }));
}
```

**better-auth 集成**:
```typescript
auth({
  session: {
    expiresIn: 15 * 60,      // 15 分钟
    updateAge: 5 * 60,       // 5 分钟更新一次
    refreshTokenAge: 7 * 24 * 60 * 60,  // 7 天
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    }
  },
  // 自定义 session 字段
  session fields: {
    tenantId: {
      type: 'string',
      required: true,
    }
  }
});
```

**Decision**: 使用 better-auth 内置的会话管理，扩展 session 字段包含 tenantId，租户切换时重新生成 Access Token，会话撤销通过数据库删除 + Redis 发布订阅实现。

---

### R-006: Audit Logging Implementation

**Question**: 如何实现全链路审计日志，确保 100% 覆盖关键操作？

**Requirements**:
- 记录登录/登出事件
- 记录失败登录尝试
- 记录用户状态变更（审核、暂停、激活）
- 记录 Token 发放和撤销事件
- 写入延迟 ≤ 5s

**Implementation**:

1. **审计事件表**:
```sql
CREATE TABLE audit_event (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenant(id),
  actor_user_id UUID,              -- 操作者用户 ID
  actor_type VARCHAR(50),          -- 'user' | 'system' | 'admin'
  action VARCHAR(100) NOT NULL,    -- 'login' | 'logout' | 'user.create' | 'user.suspend' 等
  resource_type VARCHAR(100),      -- 'user' | 'tenant' | 'session' 等
  resource_id UUID,
  result VARCHAR(20) NOT NULL,     -- 'success' | 'failure' | 'partial'
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  trace_id VARCHAR(100) NOT NULL,  -- W3C Trace ID
  metadata JSONB,                  -- 额外上下文信息
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引用于查询
CREATE INDEX idx_audit_tenant_id ON audit_event(tenant_id);
CREATE INDEX idx_audit_actor_id ON audit_event(actor_user_id);
CREATE INDEX idx_audit_trace_id ON audit_event(trace_id);
CREATE INDEX idx_audit_created_at ON audit_event(created_at DESC);
```

2. **审计服务**:
```typescript
class AuditService {
  async log(event: AuditEvent) {
    // 异步写入，不阻塞主流程
    setImmediate(() => this.writeToDB(event));

    // 实时推送到外部日志平台（可选）
    await this.pushToLogPlatform(event);
  }

  private async writeToDB(event: AuditEvent) {
    await db.insert(auditEvent).values({
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      result: event.result,
      errorMessage: event.errorMessage,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      traceId: event.traceId,
      metadata: event.metadata,
    });
  }
}
```

3. **中间件集成**:
```typescript
// Fastify 中间件：自动记录所有 API 请求
app.addHook('onRequest', async (req, reply) => {
  req.traceId = generateTraceId(); // 或从 header 读取
});

app.addHook('onResponse', async (req, reply) => {
  if (isAuthRelatedRoute(req.raw.url)) {
    await auditService.log({
      tenantId: req.context.tenantId,
      actorUserId: req.context.userId,
      action: getActionFromRoute(req.raw.url),
      resourceType: getResourceType(req.raw.url),
      result: reply.statusCode < 400 ? 'success' : 'failure',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      traceId: req.traceId,
    });
  }
});
```

**Decision**: 使用审计服务异步写入数据库，Fastify 中间件自动记录认证相关请求，关键操作（状态变更、Token 撤销）显式记录。

---

### R-007: Email Delivery for Invites

**Question**: 如何实现邀请邮件发送，支持模板化和可追踪？

**Requirements**:
- 发送含激活 Token 的邮件链接
- 链接有效期默认 7 天
- 邮件模板支持多语言
- 发送失败重试机制

**Options Evaluated**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Resend | API 简单, TypeScript SDK, 模板支持 | 需外部服务 | ✅ SELECTED |
| SendGrid | 成熟稳定, 模板强大 | 复杂, 成本高 | ❌ Backup |
| Nodemailer | 自建, 无成本 | 需维护 SMTP 服务 | ❌ MVP 后备 |

**Implementation**:

1. **邮件模板**:
```typescript
const inviteEmailTemplate = (tenantName: string, inviteUrl: string, locale: string) => ({
  subject: locale === 'zh' ? `加入 ${tenantName}` : `Join ${tenantName}`,
  html: `
    <h1>${locale === 'zh' ? '您被邀请加入' : 'You are invited to join'} ${tenantName}</h1>
    <p>${locale === 'zh' ? '请点击下方链接设置密码并激活账号：' : 'Click below to set your password and activate:'}</p>
    <a href="${inviteUrl}">${locale === 'zh' ? '设置密码' : 'Set Password'}</a>
    <p>${locale === 'zh' ? '链接有效期为 7 天。' : 'This link expires in 7 days.'}</p>
  `,
});
```

2. **发送服务**:
```typescript
import { Resend } from 'resend';

class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendInvite(email: string, tenantName: string, token: string, locale: string) {
    const inviteUrl = `${process.env.APP_URL}/auth/invite/${token}`;

    await this.resend.emails.send({
      from: 'noreply@agentifui.com',
      to: email,
      ...inviteEmailTemplate(tenantName, inviteUrl, locale),
    });

    // 记录审计
    await auditService.log({
      action: 'user.invite',
      resourceType: 'invitation',
      resourceId: token,
      result: 'success',
      metadata: { email, tenantId, locale },
    });
  }
}
```

**Decision**: 使用 Resend 作为邮件服务提供商，支持模板化和多语言，SendGrid 作为备用选项。

---

### R-008: Password Policy & Hashing

**Question**: 如何实现密码策略和安全的哈希存储？

**Requirements**:
- 最小长度 8 位
- 包含大写、小写、数字
- 支持有效期配置（30-365 天）
- 历史密码限制（3-12 个）
- 不得以明文存储

**Implementation**:

1. **密码哈希**:
```typescript
import bcrypt from 'bcrypt';

// 哈希（注册/修改密码时）
const hashedPassword = await bcrypt.hash(plainPassword, 12); // cost factor 12

// 验证（登录时）
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

2. **密码验证**:
```typescript
function validatePassword(password: string, policy: PasswordPolicy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain numbers');
  }

  return { valid: errors.length === 0, errors };
}
```

3. **历史密码**:
```sql
CREATE TABLE password_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
// 检查历史密码
async function checkPasswordHistory(userId: string, newPassword: string, limit: number): Promise<boolean> {
  const history = await db.query.passwordHistory.findMany({
    where: eq(passwordHistory.userId, userId),
    orderBy: desc(passwordHistory.createdAt),
    limit,
  });

  for (const entry of history) {
    if (await bcrypt.compare(newPassword, entry.passwordHash)) {
      return false; // 与历史密码重复
    }
  }

  return true;
}
```

**Decision**: 使用 bcrypt (cost=12) 哈希密码，密码策略验证在应用层实现，历史密码存储在独立表中。

---

### R-009: Account Lockout Strategy

**Question**: 如何实现账号锁定策略，支持租户级配置？

**Requirements**:
- 默认失败登录 5 次后锁定 30 分钟
- Tenant Admin 可配置锁定阈值和时长
- 锁定后拒绝登录并提示

**Implementation**:

1. **锁定配置**:
```sql
-- 在 tenant.custom_config 中存储
{
  "accountLockout": {
    "enabled": true,
    "maxAttempts": 5,
    "lockoutDurationMinutes": 30
  }
}
```

2. **失败登录追踪**:
```typescript
// Redis 存储失败尝试（TTL 自动过期）
const lockoutKey = `lockout:${tenantId}:${email}`;
const attemptsKey = `attempts:${tenantId}:${email}`;

async function handleFailedLogin(tenantId: string, email: string) {
  const attempts = await redis.incr(attemptsKey);
  await redis.expire(attemptsKey, 60 * 30); // 30 分钟过期

  const policy = await getLockoutPolicy(tenantId);

  if (attempts >= policy.maxAttempts) {
    // 锁定账号
    await redis.setex(lockoutKey, policy.lockoutDurationMinutes * 60, '1');

    await auditService.log({
      action: 'user.lockout',
      resourceType: 'user',
      resourceId: email,
      result: 'success',
      metadata: { attempts, durationMinutes: policy.lockoutDurationMinutes },
    });
  }
}

async function isAccountLocked(tenantId: string, email: string): Promise<boolean> {
  return await redis.exists(lockoutKey) > 0;
}
```

**Decision**: 使用 Redis 存储失败登录尝试和锁定状态，TTL 自动过期，策略配置存储在 tenant.custom_config 中。

---

### R-010: Trace ID Propagation

**Question**: 如何实现 Trace ID 全链路追踪？

**Requirements**:
- 网关生成 Trace ID (W3C/OTEL 格式)
- 贯穿所有下游请求
- 审计事件 100% 包含 Trace ID

**Implementation**:

1. **网关生成 Trace ID**:
```typescript
import { trace, context } from '@opentelemetry/api';

// 生成 W3C Trace ID
function generateTraceId(): string {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId || crypto.randomUUID();
}
```

2. **HTTP Header 传递**:
```typescript
// 网关向下游发送请求时携带 Trace ID
const response = await fetch(apiUrl, {
  headers: {
    'traceparent': `00-${traceId}-${spanId}-01`, // W3C format
    'X-Trace-ID': traceId,  // 备用
  },
});
```

3. **审计日志记录**:
```typescript
await auditService.log({
  traceId: req.traceId || req.headers['x-trace-id'],
  // ... 其他字段
});
```

**Decision**: 使用 OpenTelemetry 生成和传递 Trace ID，W3C traceparent 格式，所有审计日志强制包含 Trace ID。

---

## Summary of Decisions

| Topic | Decision | Key Technology |
|-------|----------|----------------|
| Authentication Library | better-auth | TypeScript, multi-tenant, OAuth2/OIDC/SAML, TOTP |
| Multi-Tenant Model | User (global) + UserRole (N:N) + Tenant | Drizzle ORM, tenant context filtering |
| SSO Detection | Redis cache + indexed DB query | < 200ms P95 response |
| MFA (TOTP) | otplib + AES-256-GCM encryption | User/tenant-level policies |
| Session Management | better-auth built-in | 15min access token, 7day refresh token |
| Audit Logging | Async DB write + optional log platform | 100% coverage, < 5s delay |
| Email Delivery | Resend (SendGrid backup) | Multi-language templates |
| Password Hashing | bcrypt (cost=12) | Policy validation, history check |
| Account Lockout | Redis-backed | Configurable per tenant |
| Trace ID | OpenTelemetry W3C format | Full-chain propagation |

---

## Next Steps

Phase 1 将基于本研究结果生成：
1. **data-model.md**: 完整的数据模型定义（Drizzle schema）
2. **contracts/**: API 契约定义（OpenAPI/TypeScript）
3. **quickstart.md**: 开发者快速启动指南

---

*本文档由 `/speckit.plan` 命令 Phase 0 生成*
