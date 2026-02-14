-- S3-3: platform management and user experience completion
-- - tenant lifecycle fields and config versioning
-- - tenant API key storage
-- - webhook delivery logs
-- - system announcements and dismissals

-- ========================================
-- Tenant lifecycle + config version
-- ========================================
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- normalize status domain for S3-3 lifecycle states
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant' AND column_name = 'status') THEN
    ALTER TABLE tenant
      ALTER COLUMN status TYPE VARCHAR(20);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_deleted_at
  ON tenant(deleted_at);

-- ========================================
-- Tenant API keys
-- ========================================
CREATE TABLE IF NOT EXISTS tenant_api_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  key_name VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_api_key_hash
  ON tenant_api_key(key_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_api_key_tenant_created
  ON tenant_api_key(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_api_key_tenant_revoked
  ON tenant_api_key(tenant_id, revoked_at);

-- ========================================
-- Webhook delivery logs
-- ========================================
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  endpoint TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature VARCHAR(255),
  attempt INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  response_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  trace_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_tenant_created
  ON webhook_delivery_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_tenant_event
  ON webhook_delivery_log(tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status
  ON webhook_delivery_log(status, created_at DESC);

-- ========================================
-- System announcements
-- ========================================
CREATE TABLE IF NOT EXISTS system_announcement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type VARCHAR(16) NOT NULL DEFAULT 'tenant',
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  display_type VARCHAR(16) NOT NULL DEFAULT 'banner',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_announcement_scope_status
  ON system_announcement(scope_type, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_announcement_tenant_status
  ON system_announcement(tenant_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS announcement_dismissal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES system_announcement(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_announcement_dismissal_announcement_user
  ON announcement_dismissal(announcement_id, user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_dismissal_user_dismissed
  ON announcement_dismissal(user_id, dismissed_at DESC);
