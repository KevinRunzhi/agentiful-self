-- Initial Migration: Multi-Tenant Authentication Base
-- Creates core tables for tenant, user, user_role, session, and audit_event

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- Tenant Table
-- ========================================
CREATE TABLE IF NOT EXISTS tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  plan VARCHAR(50) DEFAULT 'free',
  custom_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenant_slug ON tenant(slug);
CREATE INDEX idx_tenant_status ON tenant(status);

-- ========================================
-- User Table (global entity, no tenant_id)
-- ========================================
CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  phone VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_forced BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_status ON "user"(status);

-- ========================================
-- UserRole Table (User-Tenant N:N)
-- ========================================
CREATE TABLE IF NOT EXISTS user_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_user_role_user_tenant ON user_role(user_id, tenant_id);
CREATE INDEX idx_user_role_tenant ON user_role(tenant_id);

-- ========================================
-- Session Table (better-auth with tenant context)
-- ========================================
CREATE TABLE IF NOT EXISTS session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_user_id ON session(user_id);
CREATE INDEX idx_session_tenant_id ON session(tenant_id);
CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_session_expires_at ON session(expires_at);

-- ========================================
-- AuditEvent Table
-- ========================================
CREATE TABLE IF NOT EXISTS audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  actor_type VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  result VARCHAR(20) NOT NULL,
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  trace_id VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_id ON audit_event(tenant_id);
CREATE INDEX idx_audit_actor_id ON audit_event(actor_user_id);
CREATE INDEX idx_audit_trace_id ON audit_event(trace_id);
CREATE INDEX idx_audit_created_at ON audit_event(created_at DESC);

-- ========================================
-- Seed Data: System Tenant and Root Admin
-- ========================================

-- Insert system tenant
INSERT INTO tenant (id, name, slug, status, plan, custom_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System',
  'system',
  'active',
  'enterprise',
  '{"mfaPolicy":"required","auth":{"emailPasswordEnabled":true}}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert root admin user (password: Admin123! - should be changed on first login)
-- Note: Password hash is bcrypt hash of 'Admin123!'
INSERT INTO "user" (id, email, name, status, email_verified)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin@agentiful.com',
  'System Administrator',
  'active',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Associate root admin with system tenant
INSERT INTO user_role (user_id, tenant_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'ROOT_ADMIN'
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;
