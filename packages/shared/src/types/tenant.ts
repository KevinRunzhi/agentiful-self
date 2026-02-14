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
  configVersion: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant status
 */
export type TenantStatus = "active" | "suspended" | "deleted";

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

  // S3-3 settings namespaces
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
    favicon?: string;
    siteName?: string;
  };
  i18n?: {
    defaultLanguage?: "zh-CN" | "en-US" | "zh" | "en";
    allowUserOverride?: boolean;
  };
  webhook?: {
    url?: string;
    subscribedEvents?: string[];
    signingSecret?: string;
    enabled?: boolean;
  };
  observability?: {
    urlTemplate?: string;
    platformType?: "grafana" | "jaeger" | "custom";
    enabled?: boolean;
  };
  notification?: {
    typesEnabled?: string[];
    retentionDays?: number;
    inAppNotifications?: boolean;
  };
  fileUpload?: {
    maxSizeMb?: number;
    allowedTypes?: string[];
    retentionDays?: number;
  };
  conversationShare?: {
    defaultTtlDays?: number;
    maxTtlDays?: number;
    requireLogin?: boolean;
  };
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
