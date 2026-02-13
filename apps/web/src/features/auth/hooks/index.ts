/**
 * Auth Hooks Index
 *
 * Export all auth-related hooks
 */

export { useAuth, useAuthRequired } from "./useAuth";
export { useTenant } from "./useTenant";

export type { UseAuthReturn } from "./useAuth";
export type { UseTenantReturn, TenantMembership } from "./useTenant";
