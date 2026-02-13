/**
 * better-auth React Client
 *
 * Client-side authentication utilities
 */

import type { AuthSession, UserProfile } from "@agentifui/shared/types";

/**
 * better-auth client instance
 */
export const authClient = {
  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string, tenantSlug?: string) {
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, tenantSlug }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Sign in failed");
    }

    return response.json();
  },

  /**
   * Sign out
   */
  async signOut() {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
    });

    return response.json();
  },

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    const response = await fetch("/api/auth/session");

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.session;
  },

  /**
   * Refresh session
   */
  async refreshToken() {
    const response = await fetch("/api/auth/session/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  },

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, name: string, token: string) {
    const response = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Sign up failed");
    }

    return response.json();
  },

  /**
   * Forgot password
   */
  async forgotPassword(email: string, tenantSlug?: string) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, tenantSlug }),
    });

    return response.json();
  },

  /**
   * Reset password
   */
  async resetPassword(token: string, password: string) {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Reset failed");
    }

    return response.json();
  },

  /**
   * Enable MFA
   */
  async enableMFA(password: string) {
    const response = await fetch("/api/auth/mfa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to enable MFA");
    }

    return response.json();
  },

  /**
   * Disable MFA
   */
  async disableMFA(code: string) {
    const response = await fetch("/api/auth/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to disable MFA");
    }

    return response.json();
  },

  /**
   * Verify MFA
   */
  async verifyMFA(code: string) {
    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "MFA verification failed");
    }

    return response.json();
  },
};
