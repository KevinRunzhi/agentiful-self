-- S3-2: Audit and Security Compliance Loop
-- Adds governance tables for audit export, compliance logs, analytics aggregation, and model pricing.

-- ========================================
-- AuditEvent enhancement
-- ========================================
ALTER TABLE audit_event
  ALTER COLUMN resource_id TYPE VARCHAR(255) USING resource_id::text;

ALTER TABLE audit_event
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(64),
  ADD COLUMN IF NOT EXISTS event_category VARCHAR(64),
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(128),
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS severity VARCHAR(16),
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_tenant_category_created
  ON audit_event(tenant_id, event_category, created_at DESC);

-- ========================================
-- Audit Export Job
-- ========================================
CREATE TABLE IF NOT EXISTS audit_export_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  requester_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  format VARCHAR(16) DEFAULT 'csv' NOT NULL,
  status VARCHAR(16) DEFAULT 'pending' NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb NOT NULL,
  item_count INTEGER DEFAULT 0 NOT NULL,
  file_path TEXT,
  error TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_export_job_tenant_status
  ON audit_export_job(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_export_job_expires_at
  ON audit_export_job(expires_at);

-- ========================================
-- Compliance Event
-- ========================================
CREATE TABLE IF NOT EXISTS compliance_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  run_id UUID REFERENCES run(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversation(id) ON DELETE SET NULL,
  category VARCHAR(64) NOT NULL,
  action VARCHAR(16) NOT NULL,
  original_content TEXT,
  displayed_content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  trace_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_event_tenant_category_created
  ON compliance_event(tenant_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_event_run
  ON compliance_event(run_id);

-- ========================================
-- Analytics Hourly Pre-aggregation
-- ========================================
CREATE TABLE IF NOT EXISTS analytics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  app_id UUID REFERENCES app(id) ON DELETE SET NULL,
  hour TIMESTAMPTZ NOT NULL,
  dimension VARCHAR(32) NOT NULL,
  dimension_value VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 0 NOT NULL,
  token_count INTEGER DEFAULT 0 NOT NULL,
  cost_usd REAL DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_hourly_unique
  ON analytics_hourly(tenant_id, group_id, app_id, hour, dimension, dimension_value);
CREATE INDEX IF NOT EXISTS idx_analytics_hourly_tenant_hour
  ON analytics_hourly(tenant_id, hour DESC);

-- ========================================
-- Model Pricing
-- ========================================
CREATE TABLE IF NOT EXISTS model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  model VARCHAR(255) NOT NULL,
  input_price_per_1k_usd REAL NOT NULL,
  output_price_per_1k_usd REAL NOT NULL,
  currency VARCHAR(16) DEFAULT 'USD' NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_pricing_tenant_provider_model
  ON model_pricing(tenant_id, provider, model, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_model_pricing_provider_model
  ON model_pricing(provider, model);
