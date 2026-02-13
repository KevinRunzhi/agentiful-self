/**
 * Test assertions and validators
 *
 * Custom assertion helpers for common test scenarios
 */

/**
 * Asserts that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message ?? `Expected value to be defined, got ${value}`);
  }
}

/**
 * Asserts that a string is a valid email format
 */
export function assertEmail(email: string, message?: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(message ?? `Expected valid email, got ${email}`);
  }
}

/**
 * Asserts that a password meets policy requirements
 */
export function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    throw new Error("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    throw new Error("Password must contain at least one number");
  }
}

/**
 * Asserts that a tenant ID follows the expected format
 */
export function assertTenantId(tenantId: string): void {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("Tenant ID must be a non-empty string");
  }
  if (tenantId.length < 3) {
    throw new Error("Tenant ID must be at least 3 characters");
  }
}

/**
 * Asserts that a value is a valid ISO 8601 date string
 */
export function assertIsoDate(dateString: string): void {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Expected valid ISO date, got ${dateString}`);
  }
}

/**
 * Asserts that an object has all required properties
 */
export function assertHasProperties<T extends object>(
  obj: T,
  properties: (keyof T)[],
  message?: string,
): void {
  const missing = properties.filter((prop) => !(prop in obj));
  if (missing.length > 0) {
    throw new Error(
      message ?? `Missing properties: ${missing.join(", ")}`,
    );
  }
}
