-- RBAC Authorization Model Migration (S1-2)
-- Creates proper RBAC tables with Role, Permission, RolePermission, UserRole (new), AppGrant, and App

-- Note: Existing user_role table from S1-1 will be renamed to user_role_legacy
-- and migrated to the new structure after this migration

-- ========================================
-- RBAC Role Table
-- ========================================
CREATE TABLE IF NOT EXISTS rbac_role (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_rbac_role_name ON rbac_role(name);
CREATE INDEX idx_rbac_role_is_active ON rbac_role(is_active);

-- ========================================
-- Permission Table
-- ========================================
CREATE TABLE IF NOT EXISTS permission (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_permission_code ON permission(code);
CREATE INDEX idx_permission_category_is_active ON permission(category, is_active);

-- ========================================
-- RolePermission Table (Role-Permission N:N)
-- ========================================
CREATE TABLE IF NOT EXISTS role_permission (
  role_id INTEGER NOT NULL REFERENCES rbac_role(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT role_permission_pk PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permission_role_id ON role_permission(role_id);
CREATE INDEX idx_role_permission_permission_id ON role_permission(permission_id);

-- ========================================
-- New RBAC UserRole Table (User-Role N:N with proper RBAC)
-- Note: We'll keep the old user_role from S1-1 for backward compatibility
-- ========================================
CREATE TABLE IF NOT EXISTS rbac_user_role (
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES rbac_role(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT rbac_user_role_pk PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE INDEX idx_rbac_user_role_user_tenant ON rbac_user_role(user_id, tenant_id);
CREATE INDEX idx_rbac_user_role_expires_at ON rbac_user_role(expires_at);

-- ========================================
-- App Table (Minimal S1-2 Structure)
-- ========================================
CREATE TABLE IF NOT EXISTS app (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_app_tenant ON app(tenant_id);
CREATE INDEX idx_app_status ON app(status);

-- ========================================
-- AppGrant Table (Application Access Grants)
-- ========================================
CREATE TABLE IF NOT EXISTS app_grant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE CASCADE,
  grantee_type VARCHAR(32) NOT NULL, -- 'group' | 'user'
  grantee_id UUID NOT NULL,
  permission VARCHAR(32) DEFAULT 'use' NOT NULL, -- 'use' | 'deny'
  reason TEXT,
  granted_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_app_grant_app_id ON app_grant(app_id);
CREATE INDEX idx_app_grant_grantee ON app_grant(grantee_type, grantee_id);
CREATE INDEX idx_app_grant_expires_at ON app_grant(expires_at);
CREATE INDEX idx_app_grant_deny ON app_grant(grantee_type, grantee_id) WHERE permission = 'deny';

-- ========================================
-- Performance indexes for permission checking
-- ========================================
-- Index for user roles lookup (excluding expired)
CREATE INDEX idx_rbac_user_role_valid ON rbac_user_role(user_id, tenant_id)
  WHERE expires_at IS NULL OR expires_at > NOW();

-- Index for active grants (excluding expired)
CREATE INDEX idx_app_grant_valid ON app_grant(grantee_type, grantee_id)
  WHERE expires_at IS NULL OR expires_at > NOW();
