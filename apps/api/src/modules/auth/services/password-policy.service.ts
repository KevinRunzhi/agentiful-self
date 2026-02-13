/**
 * Password Policy Service
 *
 * Validates passwords against tenant policy requirements
 */

import { z } from "zod";
import type { TenantConfig } from "@agentifui/shared/types";
import { getDatabase } from "@agentifui/db/client";
import { passwordHistory } from "@agentifui/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Default password policy
 */
const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  historyLimit: 5,
  expireDays: null,
} as const;

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: "weak" | "fair" | "good" | "strong";
}

/**
 * Password policy from tenant config
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expireDays?: number | null;
  historyLimit: number;
}

/**
 * Get password policy from tenant config
 */
function getPasswordPolicy(tenantConfig?: TenantConfig): PasswordPolicy {
  const policy = tenantConfig?.passwordPolicy;

  return {
    minLength: policy?.minLength ?? DEFAULT_PASSWORD_POLICY.minLength,
    requireUppercase: policy?.requireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
    requireLowercase: policy?.requireLowercase ?? DEFAULT_PASSWORD_POLICY.requireLowercase,
    requireNumbers: policy?.requireNumbers ?? DEFAULT_PASSWORD_POLICY.requireNumbers,
    requireSpecialChars: policy?.requireSpecialChars ?? DEFAULT_PASSWORD_POLICY.requireSpecialChars,
    expireDays: policy?.expireDays,
    historyLimit: policy?.historyLimit ?? DEFAULT_PASSWORD_POLICY.historyLimit,
  };
}

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  tenantConfig?: TenantConfig
): PasswordValidationResult {
  const policy = getPasswordPolicy(tenantConfig);
  const errors: string[] = [];

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }

  // Check uppercase requirement
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check lowercase requirement
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check number requirement
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check special character requirement
  if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Calculate strength
  const strength = calculateStrength(password);

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Calculate password strength
 */
function calculateStrength(password: string): "weak" | "fair" | "good" | "strong" {
  let score = 0;

  // Length score
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 2;

  // Calculate strength
  if (score < 3) return "weak";
  if (score < 4) return "fair";
  if (score < 6) return "good";
  return "strong";
}

/**
 * Check password against history
 */
export async function checkPasswordHistory(
  userId: string,
  passwordHash: string,
  tenantConfig?: TenantConfig
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = getPasswordPolicy(tenantConfig);
  const db = getDatabase();

  // Get recent passwords
  const history = await db
    .select()
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))
    .limit(policy.historyLimit);

  // Check if password matches any recent password
  for (const entry of history) {
    if (entry.passwordHash === passwordHash) {
      return {
        allowed: false,
        reason: `Password was recently used. Please choose a different password.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Add password to history
 */
export async function addToPasswordHistory(
  userId: string,
  passwordHash: string
): Promise<void> {
  const db = getDatabase();
  await db.insert(passwordHistory).values({
    userId,
    passwordHash,
    createdAt: new Date(),
  });
}

/**
 * Clean up old password history (keep N most recent)
 */
export async function cleanupPasswordHistory(
  userId: string,
  keepCount: number
): Promise<number> {
  const db = getDatabase();

  // Get all history entries ordered by date
  const allEntries = await db
    .select()
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt));

  // Delete entries beyond the keep count
  const toDelete = allEntries.slice(keepCount);
  let deletedCount = 0;

  for (const entry of toDelete) {
    await db
      .delete(passwordHistory)
      .where(eq(passwordHistory.id, entry.id));
    deletedCount++;
  }

  return deletedCount;
}

/**
 * Generate password policy description
 */
export function getPasswordPolicyDescription(tenantConfig?: TenantConfig): string {
  const policy = getPasswordPolicy(tenantConfig);

  const requirements = [
    `At least ${policy.minLength} characters`,
  ];

  if (policy.requireUppercase) {
    requirements.push("one uppercase letter");
  }

  if (policy.requireLowercase) {
    requirements.push("one lowercase letter");
  }

  if (policy.requireNumbers) {
    requirements.push("one number");
  }

  if (policy.requireSpecialChars) {
    requirements.push("one special character");
  }

  let description = requirements.join(", ");

  if (policy.historyLimit > 0) {
    description += `. Password cannot match the last ${policy.historyLimit} passwords.`;
  }

  return description;
}
