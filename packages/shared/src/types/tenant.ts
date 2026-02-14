/**
 * Shared Tenant Types
 *
 * Type definitions for tenant entities used across frontend and backend
 */

export type SecurityAction = "log" | "alert" | "block";
export type PIIMaskStrategy = "mask" | "hash" | "remove";

export interface TenantAuthMethodsConfig {
  password?: boolean;
  phone?: boolean;
  google?: boolean;
  github?: boolean;
  wechat?: boolean;
  sso?: boolean;
}

export interface TenantSSOConfig {
  provider?: "oidc" | "saml" | "cas";
  issuerUrl?: string;
  clientId?: string;
  metadataUrl?: string;
  enabled?: boolean;
}

export interface TenantPIIPolicyConfig {
  enabled?: boolean;
  strategy?: PIIMaskStrategy;
  fields?: Array<"phone" | "email" | "id_card" | "bank_card" | "credit_card">;
}

export interface TenantOutputCompliancePolicyConfig {
  enabled?: boolean;
  action?: SecurityAction;
  categories?: Array<"violence" | "hate" | "adult" | "political_cn" | "self_harm">;
  customKeywords?: string[];
}

export interface TenantPromptInjectionPolicyConfig {
  enabled?: boolean;
  action?: SecurityAction;
  customKeywords?: string[];
}

export interface TenantSecurityPolicyConfig {
  authMethods?: TenantAuthMethodsConfig;
  mfaPolicy?: "required" | "optional" | "disabled";
  sso?: TenantSSOConfig;
  promptInjection?: TenantPromptInjectionPolicyConfig;
  pii?: TenantPIIPolicyConfig;
  outputCompliance?: TenantOutputCompliancePolicyConfig;
  audit?: {
    retentionDays?: number;
  };
}

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
  // Security and compliance policy (S3-2)
  security?: TenantSecurityPolicyConfig;
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
