/**
 * usePermission Hook
 *
 * React hook for checking permissions in the frontend (T045).
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import type {
  PermissionCheckInput,
  PermissionCheckOutput,
} from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface UsePermissionOptions {
  resourceType: string;
  action: string;
  resourceId?: string;
  enabled?: boolean;
}

interface CheckPermissionInput extends Omit<PermissionCheckInput, 'userId' | 'tenantId' | 'activeGroupId'> {}

// =============================================================================
// API Client
// =============================================================================

const apiBase = '/api/v1';

async function checkPermission(
  input: CheckPermissionInput
): Promise<PermissionCheckOutput> {
  const response = await fetch(`${apiBase}/permissions/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Permission check failed');
  }

  const result = await response.json();
  return result.data;
}

async function checkBatchPermission(
  checks: CheckPermissionInput[]
): Promise<Array<{ allowed: boolean; reason: string }>> {
  const response = await fetch(`${apiBase}/permissions/check-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ checks }),
  });

  if (!response.ok) {
    throw new Error('Batch permission check failed');
  }

  const result = await response.json();
  return result.data.results;
}

// =============================================================================
// Hook
// =============================================================================

export function usePermission({ resourceType, action, resourceId, enabled = true }: UsePermissionOptions) {
  return useQuery({
    queryKey: ['permission', resourceType, action, resourceId],
    queryFn: () => checkPermission({ resourceType, action, resourceId }),
    enabled,
    staleTime: 5000, // Cache for 5 seconds (same as server TTL)
  });
}

// =============================================================================
// Batch Permission Hook
// =============================================================================

export function useBatchPermissions(checks: CheckPermissionInput[], enabled = true) {
  return useQuery({
    queryKey: ['permissions', 'batch', checks],
    queryFn: () => checkBatchPermission(checks),
    enabled: enabled && checks.length > 0,
    staleTime: 5000,
  });
}

// =============================================================================
// Permission Check Hook (imperative)
// =============================================================================

export function usePermissionCheck() {
  return useMutation({
    mutationFn: checkPermission,
  });
}
