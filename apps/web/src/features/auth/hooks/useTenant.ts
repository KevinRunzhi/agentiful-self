/**
 * useTenant Hook
 *
 * React hook for tenant context and management
 */

"use client";

import { useAuthStore } from "../stores/authStore";
import type { TenantProfile } from "@agentifui/shared/types";

/**
 * Tenant membership with user's role
 */
export interface TenantMembership {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  isCurrent: boolean;
}

/**
 * Hook return type
 */
export interface UseTenantReturn {
  // State
  currentTenant: TenantProfile | null;
  tenants: TenantMembership[];
  isLoading: boolean;

  // Actions
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
}

/**
 * useTenant hook
 *
 * Provides tenant context and management
 */
export function useTenant(): UseTenantReturn {
  const authStore = useAuthStore();

  const [tenants, setTenants] = React.useState<TenantMembership[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch tenants when session changes
  React.useEffect(() => {
    if (authStore.session?.user) {
      fetchTenants();
    } else {
      setTenants([]);
    }
  }, [authStore.session?.user?.id]);

  /**
   * Fetch user's tenants
   */
  const fetchTenants = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/tenants", {
        headers: {
          Authorization: `Bearer ${authStore.session?.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch {
      // Ignore errors, use empty list
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Switch tenant
   */
  const switchTenant = async (tenantId: string) => {
    await authStore.switchTenant(tenantId);
    // Refresh tenant list after switch
    await fetchTenants();
  };

  /**
   * Refresh tenants
   */
  const refreshTenants = async () => {
    await fetchTenants();
  };

  return {
    currentTenant: authStore.session?.tenant || null,
    tenants,
    isLoading,
    switchTenant,
    refreshTenants,
  };
}

import React from "react";
