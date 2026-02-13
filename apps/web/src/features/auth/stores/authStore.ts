/**
 * Zustand Auth Store
 *
 * Global authentication state management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserSession, UserProfile, TenantProfile } from "@agentifui/shared/types";

/**
 * User session structure
 */
export interface UserSession {
  user: UserProfile;
  tenant: TenantProfile | null;
  token: string;
  refreshToken: string | null;
  expiresAt: Date;
}

/**
 * Auth store state
 */
interface AuthState {
  // Session data
  session: UserSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (session: UserSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Tenant management
  switchTenant: (tenantId: string) => Promise<void>;

  // Auth actions
  signIn: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;

  // Computed
  isAuthenticated: () => boolean;
  hasTenant: () => boolean;
}

/**
 * Create auth store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      session: null,
      isLoading: false,
      error: null,

      // Set session
      setSession: (session) => set({ session, error: null }),

      // Set loading state
      setLoading: (isLoading) => set({ isLoading }),

      // Set error
      setError: (error) => set({ error, isLoading: false }),

      // Clear error
      clearError: () => set({ error: null }),

      // Switch tenant
      switchTenant: async (tenantId) => {
        const { session } = get();
        if (!session) {
          set({ error: "Not authenticated" });
          return;
        }

        set({ isLoading: true });

        try {
          // TODO: Call API to switch tenant
          const newSession = await fetch("/api/auth/switch-tenant", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({ tenantId }),
          }).then((res) => res.json());

          if (newSession.error) {
            set({ error: newSession.error.message, isLoading: false });
            return;
          }

          set({ session: newSession.data, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to switch tenant",
            isLoading: false,
          });
        }
      },

      // Sign in
      signIn: async (email, password, tenantSlug) => {
        set({ isLoading: true });

        try {
          const response = await fetch("/api/auth/sign-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, tenantSlug }),
          });

          const data = await response.json();

          if (data.error) {
            set({ error: data.error.message, isLoading: false });
            return;
          }

          set({ session: data.session, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Sign in failed",
            isLoading: false,
          });
        }
      },

      // Sign out
      signOut: async () => {
        set({ isLoading: true });

        try {
          await fetch("/api/auth/sign-out", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${get().session?.token}`,
            },
          });
        } catch {
          // Ignore sign-out errors, just clear local session
        } finally {
          set({ session: null, isLoading: false });
        }
      },

      // Refresh session
      refreshSession: async () => {
        const { session } = get();
        if (!session) return;

        try {
          const response = await fetch("/api/auth/session/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.refreshToken}`,
            },
          });

          if (!response.ok) {
            set({ session: null });
            return;
          }

          const data = await response.json();
          set({ session: data.session });
        } catch {
          set({ session: null });
        }
      },

      // Computed: Check if authenticated
      isAuthenticated: () => {
        const { session } = get();
        if (!session) return false;
        return new Date(session.expiresAt) > new Date();
      },

      // Computed: Check if has tenant
      hasTenant: () => {
        const { session } = get();
        return !!session?.tenant;
      },
    }),
    {
      name: "agent-auth-storage",
      partialize: (state) => ({
        session: state.session,
      }),
    }
  )
);
