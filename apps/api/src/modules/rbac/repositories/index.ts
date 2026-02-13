/**
 * RBAC Repositories Index
 */

export { RoleRepository, createRoleRepository, type IRoleRepository } from './role.repository.js';
export { PermissionRepository, createPermissionRepository, type IPermissionRepository } from './permission.repository.js';
export { GrantRepository, createGrantRepository, type IGrantRepository, type GrantWithDetails, type CreateGrantInput } from './grant.repository.js';
export { UserRoleRepository, createUserRoleRepository, type IUserRoleRepository, type UserRoleWithDetails, type AssignRoleInput } from './user-role.repository.js';
