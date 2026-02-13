/**
 * RoleSelector Component
 *
 * Component for selecting and assigning roles to users (T052).
 */

import { useRoles } from '../hooks/use-roles';
import type { ChangeEvent } from 'react';

// =============================================================================
// Types
// =============================================================================

interface RoleSelectorProps {
  value?: number;
  onChange: (roleId: number) => void;
  disabled?: boolean;
  excludeSystemRoles?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

interface Role {
  id: number;
  name: string;
  displayName: string;
  isSystem: boolean;
  isActive: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function RoleSelector({
  value,
  onChange,
  disabled = false,
  excludeSystemRoles = false,
  className = '',
  id,
  name,
}: RoleSelectorProps) {
  const { data: roles, isLoading } = useRoles(true); // Only active roles

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const roleId = parseInt(event.target.value, 10);
    onChange(roleId);
  };

  if (isLoading) {
    return (
      <select
        id={id}
        name={name}
        disabled
        className={`px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 ${className}`}
      >
        <option>Loading roles...</option>
      </select>
    );
  }

  const filteredRoles = excludeSystemRoles
    ? roles?.filter((r: Role) => !r.isSystem) || []
    : roles || [];

  return (
    <select
      id={id}
      name={name}
      value={value ?? ''}
      onChange={handleChange}
      disabled={disabled}
      className={`px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
        disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
      } ${className}`}
    >
      <option value="">Select a role...</option>
      {filteredRoles.map((role: Role) => (
        <option key={role.id} value={role.id}>
          {role.displayName}
          {role.isSystem ? ' (System)' : ''}
        </option>
      ))}
    </select>
  );
}

// =============================================================================
// Role Badge Component
// =============================================================================

interface RoleBadgeProps {
  roleName: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RoleBadge({ roleName, size = 'md' }: RoleBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const roleColors: Record<string, string> = {
    root_admin: 'bg-purple-100 text-purple-800 border-purple-200',
    tenant_admin: 'bg-blue-100 text-blue-800 border-blue-200',
    user: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const colorClass = roleColors[roleName] || roleColors.user;

  const displayNames: Record<string, string> = {
    root_admin: 'ROOT ADMIN',
    tenant_admin: 'Tenant Admin',
    user: 'User',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeClasses[size]} ${colorClass} font-medium`}
    >
      {displayNames[roleName] || roleName}
    </span>
  );
}

// =============================================================================
// Role List Component
// =============================================================================

interface RoleListProps {
  roles: Array<{ id: number; name: string; displayName: string }>;
  onRemove?: (roleId: number) => void;
  readOnly?: boolean;
}

export function RoleList({ roles, onRemove, readOnly = false }: RoleListProps) {
  if (roles.length === 0) {
    return <p className="text-sm text-gray-500">No roles assigned</p>;
  }

  return (
    <ul className="space-y-2">
      {roles.map((role) => (
        <li
          key={role.id}
          className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
        >
          <RoleBadge roleName={role.name} />
          {!readOnly && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(role.id)}
              className="ml-2 text-sm text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
