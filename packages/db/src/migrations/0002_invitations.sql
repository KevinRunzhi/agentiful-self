-- Migration: Invitation and Password History Tables
-- Adds support for user invitation flow and password history tracking

-- ========================================
-- Group Table (needed for invitation group_id)
-- ========================================
CREATE TABLE IF NOT EXISTS "group" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "group_tenant_name_key" UNIQUE (tenant_id, name)
);

CREATE INDEX idx_group_tenant ON "group"(tenant_id);

-- ========================================
-- Invitation Table
-- ========================================
CREATE TABLE IF NOT EXISTS invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_invitation_token ON invitation(token);
CREATE INDEX idx_invitation_tenant ON invitation(tenant_id);

-- ========================================
-- Password History Table
-- ========================================
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_history_user_created ON password_history(user_id, created_at DESC);

-- ========================================
-- Add email expiration check index
-- ========================================
CREATE INDEX idx_invitation_expires_at ON invitation(expires_at)
WHERE status = 'pending';
