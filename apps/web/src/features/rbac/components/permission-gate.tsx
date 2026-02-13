/**
 * PermissionGate Component
 *
 * Conditional rendering component based on user permissions (T051).
 */

import { usePermission } from '../hooks/use-permission';
import type { ReactNode } from 'react';

// =============================================================================
// Types
// =============================================================================

interface PermissionGateProps {
  resourceType: string;
  action: string;
  resourceId?: string;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

// =============================================================================
// Component
// =============================================================================

export function PermissionGate({
  resourceType,
  action,
  resourceId,
  children,
  fallback = null,
  loading = null,
}: PermissionGateProps) {
  const { data: permission, isLoading } = usePermission({
    resourceType,
    action,
    resourceId,
  });

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!permission || !permission.allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// =============================================================================
// Fallback Components
// =============================================================================

interface PermissionGateWithMessageProps extends Omit<PermissionGateProps, 'fallback'> {
  message?: string;
}

export function PermissionGateWithMessage({
  resourceType,
  action,
  resourceId,
  children,
  message = 'You do not have permission to access this resource.',
  loading,
}: PermissionGateWithMessageProps) {
  return (
    <PermissionGate
      resourceType={resourceType}
      action={action}
      resourceId={resourceId}
      fallback={
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{message}</p>
        </div>
      }
      loading={loading}
    >
      {children}
    </PermissionGate>
  );
}
