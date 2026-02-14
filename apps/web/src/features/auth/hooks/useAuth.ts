/**
 * useAuth Hook
 *
 * React hook for authentication state and actions
 */

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../stores/authStore";
import type { UserSession } from "../stores/authStore";

/**
 * Hook return type
 */
export interface UseAuthReturn {
  session: UserSession | null;
  user: UserSession["user"] | null;
  tenant: UserSession["tenant"] | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  hasTenant: boolean;

  signIn: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const authStore = useAuthStore();

  return {
    session: authStore.session,
    user: authStore.session?.user || null,
    tenant: authStore.session?.tenant || null,
    isLoading: authStore.isLoading,
    error: authStore.error,
    isAuthenticated: authStore.isAuthenticated(),
    hasTenant: authStore.hasTenant(),
    signIn: authStore.signIn,
    signOut: authStore.signOut,
    switchTenant: authStore.switchTenant,
    refreshSession: authStore.refreshSession,
    clearError: authStore.clearError,
  };
}

export function useAuthRequired(): UseAuthReturn {
  const auth = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}
