/**
 * useAppContext Hook
 *
 * Hook for smart context switching when accessing apps (T121-T125, User Story 7).
 * Determines if switching context is needed based on app accessibility.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ActiveGroupContext } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

export interface UseAppContextInput {
  appId: string;
}

export interface UseAppContextResult {
  app: AppWithContext | null;
  shouldSwitch: boolean;
  contextOptions: ActiveGroupContext[];
  onSwitch: (newGroupId: string) => void;
  onDirectAccess: () => void;
}

export interface UseAppContextReturn {
  appContext: AppWithContext | null;
  isLoading: boolean;
  error: string | null;
  switchContext: (newGroupId: string) => Promise<void>;
  directAccess: () => Promise<void>;
}

export interface AppWithContext {
  id: string;
  name: string;
  currentGroup: ActiveGroupContext | null;
  availableGroups: ActiveGroupContext[];
  requiresSwitch: boolean;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * T121 [P] [US7] Create useAppContext hook
 * Main hook for smart context switching logic
 */
export function useAppContext({ appId }: UseAppContextInput): UseAppContextReturn {
  const [appContext, setAppContext] = useState<AppWithContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch app context from API
   */
  const fetchAppContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rbac/apps/${appId}/context-options`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Tenant context would be added by interceptor
          // Active group would be added by interceptor
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch app context');
      }

      const result = await response.json();
      const { currentGroup, availableGroups } = result.data || {};

      // Determine if switch is needed (T123, T124)
      const shouldSwitch = determineShouldSwitch(currentGroup, availableGroups);

      setAppContext({
        id: appId,
        name: result.data?.name || '',
        currentGroup,
        availableGroups,
        requiresSwitch: shouldSwitch,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setAppContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  /**
   * T123 [US7] Implement auto-switch logic (single authorized group)
   * T124 [US7] Implement dialog-selection logic (multiple authorized groups)
   */
  const determineShouldSwitch = (
    currentGroup: ActiveGroupContext | null | undefined,
    availableGroups: ActiveGroupContext[]
  ): boolean => {
    if (!currentGroup) {
      // No current group set - need to show options
      return true;
    }

    if (!currentGroup.hasAccess) {
      // Current group doesn't have access - need to switch
      return true;
    }

    const accessibleGroups = availableGroups.filter((g) => g.hasAccess);

    // Multiple groups with access - show selection dialog
    if (accessibleGroups.length > 1) {
      return true;
    }

    // Single group with access and it's the current one - auto-enter
    return false;
  };

  /**
   * T125 [US7] Integrate context switching with Active Group store
   * Switch active group and refresh app access
   */
  const switchContext = useCallback(
    async (newGroupId: string): Promise<void> => {
      // This would integrate with the active group store
      // For now, we'll just trigger a group switch

      try {
        await fetch('/api/rbac/active-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: newGroupId }),
        });

        // After successful switch, refresh app context
        await fetchAppContext();
      } catch (err) {
        throw new Error(`Failed to switch group: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [fetchAppContext]
  );

  /**
   * Handle direct app access (user has personal grant or role permission)
   */
  const directAccess = useCallback(async (): Promise<void> => {
    // For direct access, no group switch needed
    // Just navigate to the app directly

    try {
      await fetchAppContext();

      // If app is directly accessible, navigate to it
      if (appContext && !appContext.requiresSwitch) {
        window.location.href = `/apps/${appId}`;
      }
    } catch (err) {
      throw new Error(`Failed to access app: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [appId, appContext, fetchAppContext]);

  // Fetch context on mount
  useEffect(() => {
    if (appId) {
      fetchAppContext();
    }
  }, [appId, fetchAppContext]);

  return {
    appContext,
    isLoading,
    error,
    switchContext,
    directAccess,
  };
}

// =============================================================================
// Context Switch Dialog Hook
// =============================================================================

/**
 * T122 [P] [US7] Create ContextSwitchDialog component hook
 * Hook for managing context switch dialog state
 */
export function useContextSwitchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const openDialog = useCallback(() => {
    setIsOpen(true);
    setSelectedGroupId(null);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setSelectedGroupId(null);
  }, []);

  const selectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
  }, []);

  const confirmSelection = useCallback(() => {
    if (selectedGroupId) {
      // Trigger the actual switch (would call switchContext from useAppContext)
      setIsOpen(false);
      setSelectedGroupId(null);
    }
  }, [selectedGroupId]);

  return {
    isOpen,
    selectedGroupId,
    openDialog,
    closeDialog,
    selectGroup,
    confirmSelection,
  };
}
