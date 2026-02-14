-- S1-3: App workbench and quota governance
-- Adds app fields, favorites/recent usage, quota policy/counter/ledger/alerts

-- ========================================
-- Extend app table for S1-3 workbench cards
-- ========================================
ALTER TABLE app ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE app ADD COLUMN IF NOT EXISTS mode VARCHAR(32) DEFAULT 'chat' NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE app ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE app ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_tenant_status_mode ON app(tenant_id, status, mode);
CREATE INDEX IF NOT EXISTS idx_app_search_name ON app(name);

-- ========================================
-- App favorites
-- ========================================
CREATE TABLE IF NOT EXISTS app_favorite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_favorite_tenant_user_app
  ON app_favorite(tenant_id, user_id, app_id);
CREATE INDEX IF NOT EXISTS idx_app_favorite_tenant_user
  ON app_favorite(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_app_favorite_user_created
  ON app_favorite(user_id, created_at DESC);

-- ========================================
-- App recent usage
-- ========================================
CREATE TABLE IF NOT EXISTS app_recent_use (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE CASCADE,
  last_used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  use_count INTEGER DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_recent_use_tenant_user_app
  ON app_recent_use(tenant_id, user_id, app_id);
CREATE INDEX IF NOT EXISTS idx_app_recent_use_tenant_user_last_used
  ON app_recent_use(tenant_id, user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_recent_use_user_last_used
  ON app_recent_use(user_id, last_used_at DESC);

-- ========================================
-- Quota policy
-- ========================================
CREATE TABLE IF NOT EXISTS quota_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  scope_type VARCHAR(16) NOT NULL, -- tenant | group | user
  scope_id UUID NOT NULL,
  metric_type VARCHAR(16) DEFAULT 'token' NOT NULL, -- token | request
  period_type VARCHAR(16) DEFAULT 'month' NOT NULL, -- month | week
  limit_value BIGINT NOT NULL,
  alert_thresholds JSONB DEFAULT '[80,90,100]'::jsonb NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_policy_tenant_scope_metric_period
  ON quota_policy(tenant_id, scope_type, scope_id, metric_type, period_type);
CREATE INDEX IF NOT EXISTS idx_quota_policy_tenant_scope
  ON quota_policy(tenant_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_quota_policy_active_metric
  ON quota_policy(is_active, metric_type);

-- ========================================
-- Quota counter
-- ========================================
CREATE TABLE IF NOT EXISTS quota_counter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES quota_policy(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  used_value BIGINT DEFAULT 0 NOT NULL,
  version INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_counter_policy_period
  ON quota_counter(policy_id, period_start);
CREATE INDEX IF NOT EXISTS idx_quota_counter_policy_updated
  ON quota_counter(policy_id, updated_at DESC);

-- ========================================
-- Quota usage ledger
-- ========================================
CREATE TABLE IF NOT EXISTS quota_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE CASCADE,
  model VARCHAR(128),
  metering_mode VARCHAR(16) NOT NULL, -- token | request
  prompt_tokens INTEGER DEFAULT 0 NOT NULL,
  completion_tokens INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  trace_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quota_usage_tenant_group_created
  ON quota_usage_ledger(tenant_id, group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_created
  ON quota_usage_ledger(user_id, created_at DESC);

-- ========================================
-- Quota alert events
-- ========================================
CREATE TABLE IF NOT EXISTS quota_alert_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES quota_policy(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  threshold INTEGER NOT NULL,
  used_value BIGINT NOT NULL,
  limit_value BIGINT NOT NULL,
  channel VARCHAR(16) DEFAULT 'in_app' NOT NULL,
  status VARCHAR(16) DEFAULT 'sent' NOT NULL,
  trace_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_alert_policy_period_threshold_channel
  ON quota_alert_event(policy_id, period_start, threshold, channel);
CREATE INDEX IF NOT EXISTS idx_quota_alert_tenant_created
  ON quota_alert_event(tenant_id, created_at DESC);
