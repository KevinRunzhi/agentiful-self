/**
 * Auth API
 *
 * API client for authentication endpoints
 */

import { apiClient } from "../../../lib/api-client";

/**
 * Sign in credentials
 */
export interface SignInCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}

/**
 * Sign in response
 */
export interface SignInResponse {
  success: boolean;
  session?: {
    id: string;
    userId: string;
    tenantId: string | null;
    token: string;
    refreshToken: string | null;
    expiresAt: string;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
  tenants?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
  error?: string;
}

/**
 * Sign out response
 */
export interface SignOutResponse {
  success: boolean;
}

/**
 * Session response
 */
export interface SessionResponse {
  id: string;
  userId: string;
  tenantId: string | null;
  user: {
    id: string;
    email: string;
    name: string;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  expiresAt: string;
}

/**
 * Accept invitation request
 */
export interface AcceptInvitationRequest {
  token: string;
  password: string;
  name: string;
}

/**
 * Accept invitation response
 */
export interface AcceptInvitationResponse {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Change password response
 */
export interface ChangePasswordResponse {
  success: boolean;
  error?: string;
}

/**
 * Lockout status response
 */
export interface LockoutStatusResponse {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutTimeRemaining: number;
  maxAttempts: number;
}

/**
 * Forgot password request
 */
export interface ForgotPasswordRequest {
  email: string;
  tenantSlug?: string;
}

/**
 * Reset password request
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Auth API
 */
export const authApi = {
  /**
   * Sign in with email and password
   */
  async signIn(credentials: SignInCredentials): Promise<SignInResponse> {
    return apiClient.post("/auth/sign-in", credentials);
  },

  /**
   * Sign out
   */
  async signOut(token: string): Promise<SignOutResponse> {
    return apiClient.post(
      "/auth/sign-out",
      undefined,
      undefined,
      { token } as any
    );
  },

  /**
   * Get current session
   */
  async getSession(token: string): Promise<SessionResponse> {
    return apiClient.get(
      "/auth/session",
      undefined,
      { token } as any
    );
  },

  /**
   * Accept invitation and create account
   */
  async acceptInvitation(data: AcceptInvitationRequest): Promise<AcceptInvitationResponse> {
    return apiClient.post("/auth/accept-invitation", data);
  },

  /**
   * Change password (authenticated)
   */
  async changePassword(
    data: ChangePasswordRequest,
    token: string
  ): Promise<ChangePasswordResponse> {
    return apiClient.post(
      "/auth/change-password",
      data,
      undefined,
      { token } as any
    );
  },

  /**
   * Check account lockout status
   */
  async checkLockout(email: string): Promise<LockoutStatusResponse> {
    return apiClient.post("/auth/check-lockout", { email });
  },

  /**
   * Forgot password (initiate reset)
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<{ success: boolean; message?: string }> {
    return apiClient.post("/auth/forgot-password", data);
  },

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<{ success: boolean }> {
    return apiClient.post("/auth/reset-password", data);
  },
};

/**
 * Tenant API
 */
export const tenantApi = {
  /**
   * Get user's accessible tenants
   */
  async getUserTenants(token: string): Promise<{ tenants: Array<any> }> {
    return apiClient.get(
      "/tenants",
      undefined,
      { token } as any
    );
  },

  /**
   * Get tenant by ID or slug
   */
  async getTenant(idOrSlug: string, token: string): Promise<any> {
    return apiClient.get(
      `/tenants/${idOrSlug}`,
      undefined,
      { token } as any
    );
  },

  /**
   * Switch tenant context
   */
  async switchTenant(tenantId: string, token: string): Promise<any> {
    return apiClient.post(
      "/tenants/switch",
      { tenantId },
      undefined,
      { token } as any
    );
  },

  /**
   * Update tenant settings
   */
  async updateTenant(
    idOrSlug: string,
    data: { name?: string; customConfig?: Record<string, unknown> },
    token: string
  ): Promise<any> {
    return apiClient.patch(
      `/tenants/${idOrSlug}`,
      data,
      undefined,
      { token } as any
    );
  },

  /**
   * Get tenant settings
   */
  async getTenantSettings(idOrSlug: string, token: string): Promise<any> {
    return apiClient.get(
      `/tenants/${idOrSlug}/settings`,
      undefined,
      { token } as any
    );
  },
};
