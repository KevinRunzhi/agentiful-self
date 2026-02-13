/**
 * useRoles Hook
 *
 * React hook for fetching roles (T046).
 */

import { useQuery } from '@tanstack/react-query';
import type { Role } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface RoleWithPermissions extends Role {
  permissions: Array<{
    id: number;
    code: string;
    name: string;
    category: string;
    isActive: boolean;
  }>;
}

// =============================================================================
// API Client
// =============================================================================

const apiBase = '/api/v1';

async function fetchRoles(activeOnly = false): Promise<Role[]> {
  const url = activeOnly ? `${apiBase}/roles?active_only=true` : `${apiBase}/roles`;
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }

  const result = await response.json();
  return result.data;
}

async function fetchRoleById(id: number): Promise<RoleWithPermissions> {
  const response = await fetch(`${apiBase}/roles/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch role');
  }

  const result = await response.json();
  return result.data;
}

async function fetchUserRoles(userId: string, tenantId: string): Promise<Role[]> {
  const response = await fetch(`${apiBase}/users/${userId}/roles?tenantId=${tenantId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user roles');
  }

  const result = await response.json();
  return result.data;
}

// =============================================================================
// Hooks
// =============================================================================

export function useRoles(activeOnly = false) {
  return useQuery({
    queryKey: ['roles', { activeOnly }],
    queryFn: () => fetchRoles(activeOnly),
    staleTime: 60000, // Roles change rarely
  });
}

export function useRole(id: number) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => fetchRoleById(id),
    enabled: !!id,
    staleTime: 60000,
  });
}

export function useUserRoles(userId: string, tenantId: string) {
  return useQuery({
    queryKey: ['userRoles', userId, tenantId],
    queryFn: () => fetchUserRoles(userId, tenantId),
    enabled: !!userId && !!tenantId,
    staleTime: 30000,
  });
}
