-- S2-3: execution state and data persistence
-- Adds conversation/message/run persistence, data sync logs, and prompt injection logs

-- ========================================
-- App soft-delete marker (history read-only retention)
-- ========================================
ALTER TABLE app ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ========================================
-- Conversation
-- ========================================
CREATE TABLE IF NOT EXISTS conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE RESTRICT,
  active_group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  external_id VARCHAR(255),
  title VARCHAR(512),
  status VARCHAR(32) DEFAULT 'active' NOT NULL,
  pinned BOOLEAN DEFAULT FALSE NOT NULL,
  client_id TEXT,
  inputs JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_client_id
  ON conversation(client_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tenant_user
  ON conversation(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_app
  ON conversation(app_id);
CREATE INDEX IF NOT EXISTS idx_conversation_user_updated
  ON conversation(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_status_updated
  ON conversation(status, updated_at DESC);

-- ========================================
-- Run (execution record)
-- ========================================
CREATE TABLE IF NOT EXISTS run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversation(id) ON DELETE SET NULL,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  active_group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL,
  triggered_by VARCHAR(32) DEFAULT 'user' NOT NULL,
  status VARCHAR(32) DEFAULT 'pending' NOT NULL,
  inputs JSONB DEFAULT '{}'::jsonb NOT NULL,
  outputs JSONB,
  error TEXT,
  duration_ms INTEGER DEFAULT 0 NOT NULL,
  input_tokens INTEGER DEFAULT 0 NOT NULL,
  output_tokens INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  model VARCHAR(255),
  trace_id VARCHAR(128) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_tenant_app_created
  ON run(tenant_id, app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_conversation
  ON run(conversation_id);
CREATE INDEX IF NOT EXISTS idx_run_trace
  ON run(trace_id);
CREATE INDEX IF NOT EXISTS idx_run_user_created
  ON run(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_status_updated
  ON run(status, updated_at DESC);

-- ========================================
-- Message
-- ========================================
CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE RESTRICT,
  run_id UUID,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  parent_id UUID,
  role VARCHAR(32) NOT NULL,
  content TEXT,
  content_parts JSONB DEFAULT '[]'::jsonb NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  model VARCHAR(255),
  provider VARCHAR(64),
  trace_id VARCHAR(128),
  observation_id VARCHAR(128),
  client_id TEXT,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_client_unique
  ON message(client_id);
CREATE INDEX IF NOT EXISTS idx_message_conversation_created
  ON message(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_user
  ON message(user_id);
CREATE INDEX IF NOT EXISTS idx_message_trace
  ON message(trace_id);
CREATE INDEX IF NOT EXISTS idx_message_client
  ON message(client_id);
CREATE INDEX IF NOT EXISTS idx_message_tenant_user_app
  ON message(tenant_id, user_id, app_id);

-- ========================================
-- RunStep
-- ========================================
CREATE TABLE IF NOT EXISTS run_step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  node_id VARCHAR(255) NOT NULL,
  node_type VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  status VARCHAR(32) DEFAULT 'pending' NOT NULL,
  inputs JSONB DEFAULT '{}'::jsonb NOT NULL,
  outputs JSONB,
  error TEXT,
  duration_ms INTEGER DEFAULT 0 NOT NULL,
  input_tokens INTEGER DEFAULT 0 NOT NULL,
  output_tokens INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_run_step_run_step
  ON run_step(run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_run_step_run_index
  ON run_step(run_id, step_index);

-- ========================================
-- DataSyncLog
-- ========================================
CREATE TABLE IF NOT EXISTS data_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sync_type VARCHAR(16) DEFAULT 'incremental' NOT NULL,
  status VARCHAR(16) DEFAULT 'pending' NOT NULL,
  triggered_by VARCHAR(16) DEFAULT 'auto' NOT NULL,
  trace_id VARCHAR(128),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_sync_tenant_conversation_created
  ON data_sync_log(tenant_id, conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_sync_status_updated
  ON data_sync_log(status, updated_at DESC);

-- ========================================
-- PromptInjectionLog
-- ========================================
CREATE TABLE IF NOT EXISTS prompt_injection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversation(id) ON DELETE SET NULL,
  message_id UUID REFERENCES message(id) ON DELETE SET NULL,
  risk_score REAL NOT NULL,
  risk_type VARCHAR(64) NOT NULL,
  action VARCHAR(16) NOT NULL,
  raw TEXT,
  trace_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_injection_tenant_created
  ON prompt_injection_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_injection_conversation
  ON prompt_injection_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_prompt_injection_user
  ON prompt_injection_log(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_injection_action
  ON prompt_injection_log(action);
