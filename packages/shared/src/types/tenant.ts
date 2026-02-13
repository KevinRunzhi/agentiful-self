/**
 * Shared Tenant Types
 *
 * Type definitions for tenant entities used across frontend and backend
 */

/**
 * Tenant profile
 */
export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  customConfig: TenantConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant status
 */
export type TenantStatus = "active" | "suspended";

/**
 * Tenant plan
 */
export type TenantPlan = "free" | "pro" | "enterprise";

/**
 * Tenant configuration
 */
export interface TenantConfig {
  // Authentication configuration
  auth?: {
    emailPasswordEnabled: boolean;
    requireEmailVerification: boolean;
  };
  // Password policy
  passwordPolicy?: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expireDays?: number;
    historyLimit: number;
  };
  // Account lockout policy
  accountLockout?: {
    enabled: boolean;
    maxAttempts: number;
    lockoutDurationMinutes: number;
  };
  // MFA policy
  mfaPolicy?: "required" | "optional" | "disabled";
  // User approval
  userApproval?: {
    enabled: boolean;
    ssoBypassApproval: boolean;
  };
  // Default language
  defaultLanguage?: string;
  // Theme preference
  defaultTheme?: "light" | "dark" | "system";
}

/**
 * Tenant update data
 */
export interface TenantUpdateData {
  name?: string;
  customConfig?: Partial<TenantConfig>;
}

/**
 * Tenant list item
 */
export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  userCount: number;
  createdAt: Date;
}

/**
 * Tenant creation data
 */
export interface TenantCreateData {
  name: string;
  slug?: string;
  plan?: TenantPlan;
  customConfig?: TenantConfig;
}

/**
 * Tenant statistics
 */
export interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
}
