/**
 * RBAC Feature Index
 *
 * Main export file for RBAC feature.
 */

export * from './hooks/index.js';
export * from './components/index.js';
export { useRbacStore, selectActiveGroupId, selectActiveGroupName, selectUserRoles, useHasRole, useHasPermission } from './stores/rbac.store.js';
