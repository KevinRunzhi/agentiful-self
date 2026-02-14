/**
 * useActiveGroup Hook
 *
 * React hook for managing active group context (T078).
 * Handles local storage persistence and multi-tenant scenarios.
 */

import { useState, useEffect } from 'react';
import type { ActiveGroupContext } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

const STORAGE_KEY = 'rbac_active_groups';

interface TenantActiveGroups {
  [tenantId: string]: string;
}

// =============================================================================
// Storage Helpers
// =============================================================================

function getStoredActiveGroups(): TenantActiveGroups {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setStoredActiveGroup(tenantId: string, groupId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = getStoredActiveGroups();
    stored[tenantId] = groupId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('Failed to store active group:', error);
  }
}

function clearStoredActiveGroup(tenantId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = getStoredActiveGroups();
    delete stored[tenantId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('Failed to clear active group:', error);
  }
}

// =============================================================================
// Hook
// =============================================================================

interface UseActiveGroupOptions {
  tenantId: string;
  groups: ActiveGroupContext[];
}

export function useActiveGroup({ tenantId, groups }: UseActiveGroupOptions) {
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(() => {
    // Get stored active group for this tenant (T080)
    const stored = getStoredActiveGroups();
    const storedGroupId = stored[tenantId];

    // Validate stored group is still in user's groups
    if (storedGroupId && groups.some((g) => g.groupId === storedGroupId)) {
      return storedGroupId;
    }

    // Default to first group or Default Group (T026-2)
    const [firstGroup] = groups;
    return firstGroup ? firstGroup.groupId : null;
  });

  const activeGroup = groups.find((g) => g.groupId === activeGroupId) || null;

  const setActiveGroup = (groupId: string) => {
    const group = groups.find((g) => g.groupId === groupId);
    if (!group) {
      throw new Error('Invalid group ID');
    }

    setActiveGroupIdState(groupId);
    setStoredActiveGroup(tenantId, groupId);
  };

  const clearActiveGroup = () => {
    setActiveGroupIdState(null);
    clearStoredActiveGroup(tenantId);
  };

  // Update active group when groups change (T026-1)
  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      // Set to first group if no active group
      const [firstGroup] = groups;
      if (firstGroup) {
        setActiveGroupIdState(firstGroup.groupId);
      }
    } else if (activeGroupId && !groups.some((g) => g.groupId === activeGroupId)) {
      // Clear if active group is no longer in user's groups
      clearActiveGroup();
    }
  }, [groups, activeGroupId]);

  return {
    activeGroup,
    activeGroupId,
    setActiveGroup,
    clearActiveGroup,
    canSwitch: groups.length > 1,
  };
}
