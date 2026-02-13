/**
 * Hooks Index
 *
 * Exports all RBAC hooks.
 */

export { usePermission, useBatchPermissions, usePermissionCheck } from './use-permission.js';
export { useRoles, useRole, useUserRoles } from './use-roles.js';
export { useGrants, useCreateGrant, useRevokeGrant } from './use-grants.js';
export { useActiveGroup } from './use-active-group.js';
export { useAppContext, useContextSwitchDialog, type UseAppContextInput, type UseAppContextReturn } from './use-app-context.js';
