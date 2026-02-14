/**
 * GrantForm Component
 *
 * Form for creating application access grants (T068).
 */

import { useState } from 'react';
import { useCreateGrant } from '../hooks/use-grants';
import type { CreateAppGrantInput } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface GrantFormProps {
  appId: string;
  appName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function GrantForm({ appId, appName, onSuccess, onCancel }: GrantFormProps) {
  const createGrant = useCreateGrant();

  const [granteeType, setGranteeType] = useState<'group' | 'user'>('group');
  const [granteeId, setGranteeId] = useState('');
  const [permission, setPermission] = useState<'use' | 'deny'>('use');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateAppGrantInput = {
      appId,
      granteeType,
      granteeId,
      permission,
    };

    // Add reason for user grants
    if (granteeType === 'user') {
      input.reason = reason;
      // Set default expiration for user grants (7 days)
      if (!expiresAt) {
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 7);
        input.expiresAt = defaultExpiry;
      } else {
        input.expiresAt = new Date(expiresAt);
      }
    }

    try {
      await createGrant.mutateAsync(input);
      // Reset form
      setGranteeId('');
      setReason('');
      setExpiresAt('');
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create grant:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-md">
        <h3 className="text-sm font-medium text-gray-700">Grant Access to: {appName}</h3>
      </div>

      {/* Grantee Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Grant Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="granteeType"
              value="group"
              checked={granteeType === 'group'}
              onChange={() => setGranteeType('group')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Group (Recommended)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="granteeType"
              value="user"
              checked={granteeType === 'user'}
              onChange={() => setGranteeType('user')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Direct User Grant</span>
          </label>
        </div>
      </div>

      {/* Permission Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Permission
        </label>
        <select
          value={permission}
          onChange={(e) => setPermission(e.target.value as 'use' | 'deny')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="use">Allow Access</option>
          <option value="deny">Deny Access (Explicit)</option>
        </select>
      </div>

      {/* Reason (required for user grants) */}
      {granteeType === 'user' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this user needs direct access..."
            required
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      )}

      {/* Expiration (for user grants) */}
      {granteeType === 'user' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expires At
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="mt-1 text-xs text-gray-500">
            Maximum 90 days from now
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={createGrant.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {createGrant.isPending ? 'Creating...' : 'Create Grant'}
        </button>
      </div>
    </form>
  );
}
