-- S2-2 conversation, messaging, sharing, files, artifacts

CREATE TABLE IF NOT EXISTS conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES app(id) ON DELETE CASCADE,
  active_group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  external_id VARCHAR(255),
  title VARCHAR(512),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  client_id TEXT UNIQUE,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_tenant_user
  ON conversation(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_app
  ON conversation(app_id);
CREATE INDEX IF NOT EXISTS idx_conversation_user_updated
  ON conversation(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_pinned_updated
  ON conversation(user_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_client_id
  ON conversation(client_id);

CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES message(id) ON DELETE SET NULL,
  role VARCHAR(32) NOT NULL,
  content TEXT,
  content_parts JSONB NOT NULL DEFAULT '{"parts":[]}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  model VARCHAR(255),
  provider VARCHAR(64),
  trace_id VARCHAR(64),
  observation_id VARCHAR(64),
  client_id TEXT UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_conversation_created
  ON message(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_user
  ON message(user_id);
CREATE INDEX IF NOT EXISTS idx_message_trace
  ON message(trace_id);
CREATE INDEX IF NOT EXISTS idx_message_client_id
  ON message(client_id);
CREATE INDEX IF NOT EXISTS idx_message_parent
  ON message(parent_id);

CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  rating VARCHAR(16) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_message_feedback_message_user UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_tenant_created
  ON message_feedback(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  group_id UUID REFERENCES "group"(id) ON DELETE SET NULL,
  share_code VARCHAR(32) NOT NULL UNIQUE,
  permission VARCHAR(32) NOT NULL DEFAULT 'read',
  require_login BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_share_conversation
  ON conversation_share(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_share_code
  ON conversation_share(share_code);
CREATE INDEX IF NOT EXISTS idx_conversation_share_tenant_created
  ON conversation_share(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS file_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  message_id UUID REFERENCES message(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(128) NOT NULL,
  file_size INTEGER NOT NULL,
  storage_url TEXT NOT NULL,
  scan_status VARCHAR(32) NOT NULL DEFAULT 'skipped',
  retain_until TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_attachment_conversation_created
  ON file_attachment(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_attachment_message
  ON file_attachment(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachment_retain_until
  ON file_attachment(retain_until);

CREATE TABLE IF NOT EXISTS artifact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  message_id UUID REFERENCES message(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  format VARCHAR(32),
  version INTEGER NOT NULL DEFAULT 1,
  is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifact_conversation_created
  ON artifact(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_conversation_draft
  ON artifact(conversation_id, is_draft, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_message
  ON artifact(message_id);
