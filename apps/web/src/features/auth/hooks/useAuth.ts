/**
 * useAuth Hook
 *
 * React hook for authentication state and actions
 */

"use client";

import { useAuthStore } from "../stores/authStore";

/**
 * Hook return type
 */
export interface UseAuthReturn {
  // State
  session: ReturnType<typeof useAuthStore>["session"];
  user: ReturnType<typeof useAuthStore>["session"]["user"] | null;
  tenant: ReturnType<typeof useAuthStore>["session"]["tenant"] | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  hasTenant: boolean;

  // Actions
  signIn: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

/**
 * useAuth hook
 *
 * Provides authentication state and actions
 */
export function useAuth(): UseAuthReturn {
  const authStore = useAuthStore();

  return {
    // State
    session: authStore.session,
    user: authStore.session?.user || null,
    tenant: authStore.session?.tenant || null,
    isLoading: authStore.isLoading,
    error: authStore.error,
    isAuthenticated: authStore.isAuthenticated(),
    hasTenant: authStore.hasTenant(),

    // Actions
    signIn: authStore.signIn,
    signOut: authStore.signOut,
    switchTenant: authStore.switchTenant,
    refreshSession: authStore.refreshSession,
    clearError: authStore.clearError,
  };
}

/**
 * useAuthRequired hook
 *
 * Like useAuth but redirects to login if not authenticated
 */
export function useAuthRequired(): UseAuthReturn {
  const auth = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}

// Import React and Next.js for the redirect
import React from "react";
import { useRouter } from "next/navigation";
