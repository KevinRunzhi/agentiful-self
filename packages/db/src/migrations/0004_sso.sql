-- Migration: Create SSO configuration table
-- Created: 2025-02-10
-- Description: Adds SSO/OAuth configuration with domain-based auto-detection

-- Create sso_config table
CREATE TABLE IF NOT EXISTS "sso_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "provider" VARCHAR(50) NOT NULL,
  "provider_client_id" VARCHAR(255) NOT NULL,
  "provider_client_secret" VARCHAR(500) NOT NULL,
  "domains" JSONB,
  "scopes" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "jit_provisioning" BOOLEAN NOT NULL DEFAULT TRUE,
  "jit_auto_activate" BOOLEAN NOT NULL DEFAULT TRUE,
  "default_role" VARCHAR(50) DEFAULT 'member',
  "attribute_mapping" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "idx_sso_config_tenant_provider" UNIQUE ("tenant_id", "provider")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_sso_config_tenant" ON "sso_config"("tenant_id");

-- Add comments for documentation
COMMENT ON TABLE "sso_config" IS 'SSO/OAuth provider configuration per tenant';
COMMENT ON COLUMN "sso_config"."provider" IS 'OAuth provider name: google, microsoft, github, gitlab, oidc';
COMMENT ON COLUMN "sso_config"."provider_client_id" IS 'OAuth client ID from provider';
COMMENT ON COLUMN "sso_config"."provider_client_secret" IS 'OAuth client secret from provider (encrypted)';
COMMENT ON COLUMN "sso_config"."domains" IS 'Email domains that trigger this SSO provider';
COMMENT ON COLUMN "sso_config"."jit_provisioning" IS 'Auto-create users on first SSO login';
COMMENT ON COLUMN "sso_config"."jit_auto_activate" IS 'Auto-activate JIT provisioned users (skip approval)';
COMMENT ON COLUMN "sso_config"."attribute_mapping" IS 'Map SSO provider attributes to user fields';
