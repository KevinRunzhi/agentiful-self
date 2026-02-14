/**
 * Test utilities and factories for testing
 *
 * This module provides common utilities, factories, and helpers
 * for unit and integration tests across the monorepo.
 */

interface VitestTimerApi {
  useFakeTimers: () => void;
  setSystemTime: (date: Date) => void;
  useRealTimers: () => void;
}

/**
 * Generates a random email for testing
 */
export function generateTestEmail(prefix = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}.${timestamp}.${random}@example.com`;
}

/**
 * Generates a random string for testing
 */
export function generateTestString(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a valid password for testing (meets policy requirements)
 */
export function generateTestPassword(): string {
  const base = generateTestString(12);
  // Ensure at least one uppercase, one lowercase, and one number
  return base.charAt(0).toUpperCase() +
         base.slice(1, -1) +
         Math.floor(Math.random() * 10) +
         "!";
}

/**
 * Creates a mock tenant object for testing
 */
export function createMockTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: `tenant_${generateTestString(12)}`,
    name: `Test Tenant ${generateTestString(8)}`,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock user object for testing
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: `user_${generateTestString(12)}`,
    email: generateTestEmail(),
    name: "Test User",
    status: "active",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock user role for testing
 */
export function createMockUserRole(overrides?: Partial<UserRole>): UserRole {
  const tenantId = `tenant_${generateTestString(12)}`;
  const userId = `user_${generateTestString(12)}`;
  return {
    userId,
    tenantId,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Waits for a condition to be true with a timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Type definitions for test factories
 */

export interface Tenant {
  id: string;
  name: string;
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  status: "active" | "pending" | "suspended" | "rejected";
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface UserRole {
  userId: string;
  tenantId: string;
  role: "tenantAdmin" | "user";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mock date utilities for consistent testing
 */
export const mockDate = new Date("2025-01-01T00:00:00.000Z");

function getVitestTimerApi(): VitestTimerApi {
  const timerApi = (globalThis as { vi?: VitestTimerApi }).vi;
  if (!timerApi) {
    throw new Error("Vitest timer API is unavailable in current runtime");
  }
  return timerApi;
}

export function setMockDate(date: Date): void {
  const timerApi = getVitestTimerApi();
  timerApi.useFakeTimers();
  timerApi.setSystemTime(date);
}

export function resetMockDate(): void {
  getVitestTimerApi().useRealTimers();
}
