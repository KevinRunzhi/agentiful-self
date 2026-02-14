-- S1-3 clarify alignment:
-- - complete app fields
-- - add notification persistence
-- - add run_id in quota usage ledger
-- - add search index for name/description

-- ========================================
-- Extend app table with full S1-3 fields
-- ========================================
ALTER TABLE app ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE app ADD COLUMN IF NOT EXISTS external_platform VARCHAR(64);
ALTER TABLE app ADD COLUMN IF NOT EXISTS icon_type VARCHAR(32) DEFAULT 'image' NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS enable_api BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS api_rpm INTEGER DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_featured_sort
  ON app(tenant_id, is_featured, sort_order);

-- Search index for ILIKE workload
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_app_search_name_desc_trgm
  ON app
  USING gin ((coalesce(name, '') || ' ' || coalesce(description, '')) gin_trgm_ops);

-- ========================================
-- Quota usage ledger extension
-- ========================================
ALTER TABLE quota_usage_ledger ADD COLUMN IF NOT EXISTS run_id VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_quota_usage_run_id
  ON quota_usage_ledger(run_id);

-- ========================================
-- Notification persistence
-- ========================================
CREATE TABLE IF NOT EXISTS notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  recipient_id VARCHAR(128) NOT NULL,
  type VARCHAR(32) DEFAULT 'system' NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMPTZ,
  trace_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_tenant_recipient_created
  ON notification(tenant_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_tenant_recipient_unread
  ON notification(tenant_id, recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_tenant_type_created
  ON notification(tenant_id, type, created_at DESC);
