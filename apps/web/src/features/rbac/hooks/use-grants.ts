/**
 * useGrants Hook
 *
 * React hook for managing application grants (T067).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AppGrant,
  CreateAppGrantInput,
} from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface GrantWithDetails extends AppGrant {
  appName?: string;
  granteeName?: string;
  grantedByName?: string;
}

interface UseGrantsOptions {
  appId?: string;
  granteeType?: 'group' | 'user';
  granteeId?: string;
}

// =============================================================================
// API Client
// =============================================================================

const apiBase = '/api/v1';

async function fetchGrants(params: UseGrantsOptions): Promise<GrantWithDetails[]> {
  const searchParams = new URLSearchParams();
  if (params.appId) searchParams.append('appId', params.appId);
  if (params.granteeType) searchParams.append('granteeType', params.granteeType);
  if (params.granteeId) searchParams.append('granteeId', params.granteeId);

  const response = await fetch(`${apiBase}/grants?${searchParams}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch grants');
  }

  const result = await response.json();
  return result.data;
}

async function createGrant(input: CreateAppGrantInput): Promise<AppGrant> {
  const response = await fetch(`${apiBase}/grants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || 'Failed to create grant');
  }

  const result = await response.json();
  return result.data;
}

async function revokeGrant(grantId: string): Promise<void> {
  const response = await fetch(`${apiBase}/grants/${grantId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to revoke grant');
  }
}

// =============================================================================
// Hooks
// =============================================================================

export function useGrants(options: UseGrantsOptions = {}) {
  return useQuery({
    queryKey: ['grants', options],
    queryFn: () => fetchGrants(options),
    staleTime: 10000, // 10 seconds
  });
}

export function useCreateGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGrant,
    onSuccess: () => {
      // Invalidate grants queries
      queryClient.invalidateQueries({ queryKey: ['grants'] });
    },
  });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeGrant,
    onSuccess: () => {
      // Invalidate grants queries
      queryClient.invalidateQueries({ queryKey: ['grants'] });
    },
  });
}
