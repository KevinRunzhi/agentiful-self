/**
 * BreakglassActivateForm Component (T115)
 *
 * Form for ROOT ADMIN to activate emergency access to a tenant.
 * Requires reason input (10-500 characters) and tenant selection.
 *
 * @see apps/api/src/modules/rbac/routes/breakglass.routes.ts
 * @see packages/shared/src/rbac/index.ts - BreakglassActivateInput
 */

import { useState } from 'react';
import type { BreakglassSession, BreakglassStatus } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface Tenant {
  id: string;
  name: string;
}

interface BreakglassActivateFormProps {
  /** Available tenants for selection */
  tenants: Tenant[];
  /** Currently active break-glass status (if any) */
  activeStatus?: BreakglassStatus | null;
  /** Callback when break-glass is successfully activated */
  onSuccess?: (session: BreakglassSession) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
}

interface ActivateBreakglassInput {
  tenantId: string;
  reason: string;
}

// =============================================================================
// API Client
// =============================================================================

const apiBase = '/api/v1';

async function activateBreakglass(input: ActivateBreakglassInput): Promise<BreakglassSession> {
  const response = await fetch(`${apiBase}/breakglass/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || 'Failed to activate break-glass');
  }

  const result = await response.json();
  return result.data;
}

// =============================================================================
// Component
// =============================================================================

export function BreakglassActivateForm({
  tenants,
  activeStatus,
  onSuccess,
  onCancel,
}: BreakglassActivateFormProps) {
  const [tenantId, setTenantId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonLength = reason.length;
  const minReasonLength = 10;
  const maxReasonLength = 500;
  const isReasonValid = reasonLength >= minReasonLength && reasonLength <= maxReasonLength;
  const isFormValid = tenantId && isReasonValid;

  // Check if there's already an active session
  const hasActiveSession = activeStatus?.isActive;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const session = await activateBreakglass({ tenantId, reason });
      setReason('');
      setTenantId('');
      onSuccess?.(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate break-glass');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTenant = tenants.find((t) => t.id === tenantId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Warning Header */}
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-red-800">Emergency Access (Break-glass)</h3>
            <p className="text-sm text-red-700 mt-1">
              This action will grant you temporary admin access to the selected tenant.
              All actions will be logged and tenant administrators will be notified.
            </p>
          </div>
        </div>
      </div>

      {/* Active Session Warning */}
      {hasActiveSession && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-yellow-800">
              You already have an active break-glass session for this tenant.
              Expires at: {activeStatus?.expiresAt ? new Date(activeStatus.expiresAt).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Tenant Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Target Tenant <span className="text-red-500">*</span>
        </label>
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          required
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
        >
          <option value="">Select a tenant...</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
        {selectedTenant && (
          <p className="mt-1 text-xs text-gray-500">
            You will gain admin access to: {selectedTenant.name}
          </p>
        )}
      </div>

      {/* Reason Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Emergency Access <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you need emergency access to this tenant (e.g., Production incident investigation, critical bug fix, etc.)..."
          required
          rows={4}
          minLength={minReasonLength}
          maxLength={maxReasonLength}
          disabled={isSubmitting}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 ${
            reasonLength > 0 && !isReasonValid
              ? 'border-red-300'
              : 'border-gray-300'
          }`}
        />
        <div className="flex justify-between mt-1">
          <span className={`text-xs ${
            reasonLength > 0 && !isReasonValid
              ? 'text-red-500'
              : 'text-gray-500'
          }`}>
            {reasonLength < minReasonLength
              ? `At least ${minReasonLength - reasonLength} more characters needed`
              : ''}
          </span>
          <span className={`text-xs ${
            reasonLength > maxReasonLength
              ? 'text-red-500'
              : 'text-gray-500'
          }`}>
            {reasonLength}/{maxReasonLength}
          </span>
        </div>
      </div>

      {/* Session Info */}
      <div className="bg-gray-50 p-3 rounded-md">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Session Details</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Duration: 1 hour (can be extended)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            All actions will be logged (Critical audit)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            Tenant admins will be notified immediately
          </li>
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Activating...' : 'Activate Emergency Access'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Compact Version (for navbar/modal trigger)
// =============================================================================

interface BreakglassButtonProps {
  onClick: () => void;
  hasActiveSession?: boolean;
}

export function BreakglassButton({ onClick, hasActiveSession }: BreakglassButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        hasActiveSession
          ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300'
          : 'text-red-700 bg-red-100 hover:bg-red-200 border border-red-300'
      }`}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {hasActiveSession ? 'Active Session' : 'Emergency Access'}
    </button>
  );
}

// =============================================================================
// Status Display Component
// =============================================================================

interface BreakglassStatusDisplayProps {
  status: BreakglassStatus;
  onExtend?: () => void;
  onRevoke?: () => void;
}

export function BreakglassStatusDisplay({
  status,
  onExtend,
  onRevoke,
}: BreakglassStatusDisplayProps) {
  if (!status.isActive) {
    return null;
  }

  const expiresAt = status.expiresAt ? new Date(status.expiresAt) : null;
  const remainingMs = expiresAt ? expiresAt.getTime() - Date.now() : 0;
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
  const isExpiringSoon = remainingMinutes < 15;

  return (
    <div className={`p-4 rounded-md border ${
      isExpiringSoon
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className={`text-sm font-medium ${
            isExpiringSoon ? 'text-yellow-800' : 'text-blue-800'
          }`}>
            Emergency Access Active
          </h4>
          <p className={`text-sm mt-1 ${
            isExpiringSoon ? 'text-yellow-700' : 'text-blue-700'
          }`}>
            Tenant: {status.tenantId}
          </p>
          <p className={`text-xs mt-1 ${
            isExpiringSoon ? 'text-yellow-600' : 'text-blue-600'
          }`}>
            {remainingMinutes > 0
              ? `Expires in ${remainingMinutes} minutes`
              : 'Session expired'}
          </p>
        </div>
        <div className="flex gap-2">
          {onExtend && (
            <button
              type="button"
              onClick={onExtend}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
            >
              Extend
            </button>
          )}
          {onRevoke && (
            <button
              type="button"
              onClick={onRevoke}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50"
            >
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
