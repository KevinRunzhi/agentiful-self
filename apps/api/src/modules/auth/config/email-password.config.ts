/**
 * Email/Password Authentication Configuration
 *
 * Extends better-auth with custom email/password handling
 */

import { auth } from "../auth.config.js";
import { getDatabase } from "@agentifui/db/client";
import { user } from "@agentifui/db/schema";
import { eq } from "drizzle-orm";

/**
 * Password validation rules
 */
export const passwordRules = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  historyLimit: 5,
} as const;

/**
 * Validate password against policy
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < passwordRules.minLength) {
    errors.push(`Password must be at least ${passwordRules.minLength} characters`);
  }

  if (passwordRules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (passwordRules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (passwordRules.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (passwordRules.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if password matches user's password history
 */
export async function checkPasswordHistory(
  userId: string,
  newPasswordHash: string
): Promise<boolean> {
  const db = getDatabase();

  // TODO: Implement password history check after creating password_history table
  // For now, always return true (password not in history)
  return true;
}

/**
 * Sign up with email and password (with tenant context)
 */
export async function signUpWithEmailPassword(data: {
  email: string;
  password: string;
  name: string;
  tenantId: string;
  role?: string;
}) {
  const { email, password, name, tenantId, role = "USER" } = data;

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join(", "));
  }

  // Check if user already exists
  const db = getDatabase();
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    // User exists - add tenant role if not already present
    // TODO: Add user to tenant via UserRole table
    throw new Error("User already exists");
  }

  // Create new user
  // TODO: Use better-auth API to create user with password hash

  return { success: true };
}

/**
 * Sign in with email and password (with tenant context)
 */
export async function signInWithEmailPassword(data: {
  email: string;
  password: string;
  tenantId?: string;
}) {
  const { email, password, tenantId } = data;

  // Use better-auth signIn
  const session = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });

  if (!session) {
    throw new Error("Invalid credentials");
  }

  // TODO: Attach tenant context to session
  return session;
}
