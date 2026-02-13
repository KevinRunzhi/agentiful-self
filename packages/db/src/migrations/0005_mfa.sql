-- Migration: Create MFA (Multi-Factor Authentication) tables
-- Created: 2025-02-10
-- Description: Adds TOTP secret storage for MFA

-- Create mfa_secret table
CREATE TABLE IF NOT EXISTS "mfa_secret" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "secret" VARCHAR(255) NOT NULL,
  "backup_codes" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "verified_at" TIMESTAMP,
  "last_used_at" TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_mfa_secret_user" ON "mfa_secret"("user_id");

-- Add comments for documentation
COMMENT ON TABLE "mfa_secret" IS 'TOTP multi-factor authentication secrets';
COMMENT ON COLUMN "mfa_secret"."secret" IS 'Encrypted TOTP secret key';
COMMENT ON COLUMN "mfa_secret"."backup_codes" IS 'JSON array of hashed backup codes for account recovery';
COMMENT ON COLUMN "mfa_secret"."enabled" IS 'Whether MFA is enabled and verified for this user';
