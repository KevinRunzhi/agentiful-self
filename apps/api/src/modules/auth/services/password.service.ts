/**
 * Password Service
 *
 * Password hashing and verification using bcrypt
 */

import bcrypt from "bcrypt";
import type { PasswordValidationResult } from "./password-policy.service.js";
import { validatePassword, addToPasswordHistory, checkPasswordHistory } from "./password-policy.service.js";
import type { TenantConfig } from "@agentifui/shared/types";

/**
 * Default bcrypt rounds
 */
const SALT_ROUNDS = 12;

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate and hash new password
 */
export async function validateAndHashPassword(
  password: string,
  userId: string,
  tenantConfig?: TenantConfig
): Promise<{ valid: boolean; hash?: string; errors: string[] }> {
  // First validate against policy
  const validation = validatePassword(password, tenantConfig);

  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  // Check against history if userId is provided
  if (userId) {
    // Hash the password first to check against history
    const tempHash = await hashPassword(password);
    const historyCheck = await checkPasswordHistory(userId, tempHash, tenantConfig);

    if (!historyCheck.allowed) {
      return { valid: false, errors: [historyCheck.reason!] };
    }
  }

  // Hash the password for storage
  const hash = await hashPassword(password);

  return { valid: true, hash, errors: [] };
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
  currentHash: string,
  tenantConfig?: TenantConfig
): Promise<{ success: boolean; error?: string }> {
  // Verify old password
  const isValid = await verifyPassword(oldPassword, currentHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Validate and hash new password
  const result = await validateAndHashPassword(newPassword, userId, tenantConfig);
  if (!result.valid) {
    return { success: false, error: result.errors.join(", ") };
  }

  // Add old password to history before changing
  await addToPasswordHistory(userId, currentHash);

  return { success: true, hash: result.hash };
}

/**
 * Generate random password
 */
export function generatePassword(length = 16): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  let password = "";
  let allChars = "";

  // Ensure at least one of each required type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  allChars = lowercase + uppercase + numbers + special;

  // Fill the rest with random characters
  while (password.length < length) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

/**
 * Estimate password strength without validation
 */
export function estimateStrength(password: string): "weak" | "fair" | "good" | "strong" {
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
