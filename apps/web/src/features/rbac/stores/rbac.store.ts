/**
 * RBAC Store
 *
 * Zustand store for RBAC state management (T047).
 * Manages permissions cache, user roles, and active group context.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role, PermissionCheckOutput } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface PermissionCache {
  [key: string]: {
    allowed: boolean;
    reason: string;
    expiresAt: number;
  };
}

interface ActiveGroupState {
  groupId: string | null;
  groupName: string | null;
  tenantId: string | null;
}

interface RBACState {
  // Permissions cache
  permissions: PermissionCache;

  // User roles
  userRoles: Role[];

  // Active group context
  activeGroup: ActiveGroupState;

  // Tenant-specific active groups (for multi-tenant scenarios)
  tenantActiveGroups: Record<string, string>; // { tenantId: groupId }

  // Actions
  setPermission: (key: string, result: PermissionCheckOutput, ttl?: number) => void;
  clearPermissionCache: () => void;
  setUserRoles: (roles: Role[]) => void;
  setActiveGroup: (groupId: string, groupName: string, tenantId: string) => void;
  clearActiveGroup: () => void;
  setTenantActiveGroup: (tenantId: string, groupId: string) => void;
}

// =============================================================================
// Store
// =============================================================================

export const useRbacStore = create<RBACState>()(
  persist(
    (set, get) => ({
      // Initial state
      permissions: {},
      userRoles: [],
      activeGroup: {
        groupId: null,
        groupName: null,
        tenantId: null,
      },
      tenantActiveGroups: {},

      // Actions
      setPermission: (key, result, ttl = 5000) => {
        set((state) => ({
          permissions: {
            ...state.permissions,
            [key]: {
              allowed: result.allowed,
              reason: result.reason,
              expiresAt: Date.now() + ttl,
            },
          },
        }));
      },

      clearPermissionCache: () => {
        set({ permissions: {} });
      },

      setUserRoles: (roles) => {
        set({ userRoles: roles });
      },

      setActiveGroup: (groupId, groupName, tenantId) => {
        set((state) => ({
          activeGroup: { groupId, groupName, tenantId },
          // Also update tenant-specific mapping
          tenantActiveGroups: {
            ...state.tenantActiveGroups,
            [tenantId]: groupId,
          },
        }));
      },

      clearActiveGroup: () => {
        set({
          activeGroup: {
            groupId: null,
            groupName: null,
            tenantId: null,
          },
        });
      },

      setTenantActiveGroup: (tenantId, groupId) => {
        set((state) => ({
          tenantActiveGroups: {
            ...state.tenantActiveGroups,
            [tenantId]: groupId,
          },
        }));
      },
    }),
    {
      name: 'rbac-storage',
      // Only persist certain fields
      partialize: (state) => ({
        tenantActiveGroups: state.tenantActiveGroups,
        activeGroup: state.activeGroup,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectActiveGroupId = (state: RBACState) => state.activeGroup.groupId;
export const selectActiveGroupName = (state: RBACState) => state.activeGroup.groupName;
export const selectUserRoles = (state: RBACState) => state.userRoles;

// =============================================================================
// Helper Hooks
// =============================================================================

export function useActiveGroup() {
  return useRbacStore((state) => state.activeGroup);
}

export function useHasRole(roleName: string) {
  const userRoles = useRbacStore((state) => state.userRoles);
  return userRoles.some((role) => role.name === roleName);
}

export function useHasPermission(resourceType: string, action: string): boolean | null {
  const permissions = useRbacStore((state) => state.permissions);
  const key = `${resourceType}:${action}`;

  const cached = permissions[key];
  if (!cached) {
    return null; // Not cached, need to check
  }

  // Check if expired
  if (Date.now() > cached.expiresAt) {
    // Remove expired entry
    useRbacStore.getState().setPermission(key, { allowed: false, reason: 'expired' }, 0);
    return null;
  }

  return cached.allowed;
}
