-- Migration: Create groups and group_members tables
-- Created: 2025-02-10
-- Description: Adds tenant-level groups and group membership for user organization

-- Create groups table
CREATE TABLE IF NOT EXISTS "group" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "idx_group_tenant_name" UNIQUE ("tenant_id", "name")
);

-- Create indexes for groups
CREATE INDEX IF NOT EXISTS "idx_group_tenant" ON "group"("tenant_id");

-- Create group_members table
CREATE TABLE IF NOT EXISTS "group_member" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "group"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" VARCHAR(50) NOT NULL DEFAULT 'member',
  "added_by" UUID REFERENCES "user"("id") ON DELETE SET NULL,
  "added_at" TIMESTAMP DEFAULT NOW(),
  "removed_at" TIMESTAMP,
  "removed_by" UUID REFERENCES "user"("id") ON DELETE SET NULL,
  CONSTRAINT "idx_group_member_group_user" UNIQUE ("group_id", "user_id")
);

-- Create partial unique index for active memberships (removed_at IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_group_member_active"
  ON "group_member"("group_id", "user_id")
  WHERE "removed_at" IS NULL;

-- Create indexes for group_members
CREATE INDEX IF NOT EXISTS "idx_group_member_group" ON "group_member"("group_id");
CREATE INDEX IF NOT EXISTS "idx_group_member_user" ON "group_member"("user_id");

-- Add comments for documentation
COMMENT ON TABLE "group" IS 'Tenant-level organization unit for grouping users';
COMMENT ON COLUMN "group"."tenant_id" IS 'Tenant that owns this group';
COMMENT ON COLUMN "group"."name" IS 'Group name (unique per tenant)';
COMMENT ON COLUMN "group"."sort_order" IS 'Display order for sorting groups';

COMMENT ON TABLE "group_member" IS 'Many-to-many relationship between users and groups';
COMMENT ON COLUMN "group_member"."role" IS 'Member role: member, manager, or admin';
COMMENT ON COLUMN "group_member"."added_by" IS 'User who added this member';
COMMENT ON COLUMN "group_member"."removed_at" IS 'Soft delete timestamp (null = active member)';
COMMENT ON COLUMN "group_member"."removed_by" IS 'User who removed this member';
