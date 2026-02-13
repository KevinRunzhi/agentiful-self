/**
 * GrantList Component
 *
 * Display list of application access grants (T069).
 */

import { useGrants, useRevokeGrant } from '../hooks/use-grants';
import type { AppGrant } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface GrantListProps {
  appId?: string;
  granteeType?: 'group' | 'user';
  granteeId?: string;
}

// =============================================================================
// Component
// =============================================================================

export function GrantList({ appId, granteeType, granteeId }: GrantListProps) {
  const { data: grants, isLoading } = useGrants({ appId, granteeType, granteeId });
  const revokeGrant = useRevokeGrant();

  const handleRevoke = async (grantId: string) => {
    if (!confirm('Are you sure you want to revoke this grant?')) {
      return;
    }

    try {
      await revokeGrant.mutateAsync(grantId);
    } catch (error) {
      console.error('Failed to revoke grant:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading grants...
      </div>
    );
  }

  if (!grants || grants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No grants found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grants.map((grant) => (
        <GrantItem
          key={grant.id}
          grant={grant}
          onRevoke={() => handleRevoke(grant.id)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Grant Item Component
// =============================================================================

interface GrantItemProps {
  grant: AppGrant & { appName?: string; granteeName?: string; grantedByName?: string };
  onRevoke: () => void;
}

function GrantItem({ grant, onRevoke }: GrantItemProps) {
  const isDeny = grant.permission === 'deny';
  const isUserGrant = grant.granteeType === 'user';
  const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();

  return (
    <div className={`p-4 border rounded-md ${isDeny ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">
              {grant.appName || grant.appId}
            </h4>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isDeny
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {grant.permission.toUpperCase()}
            </span>
            {isExpired && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                Expired
              </span>
            )}
          </div>

          <div className="mt-2 text-sm text-gray-600">
            <p>
              <span className="font-medium">Granted to:</span>{' '}
              {grant.granteeName || grant.granteeId}
              <span className="ml-2 text-gray-400">
                ({isUserGrant ? 'User' : 'Group'})
              </span>
            </p>

            {isUserGrant && grant.reason && (
              <p className="mt-1">
                <span className="font-medium">Reason:</span> {grant.reason}
              </p>
            )}

            {grant.expiresAt && (
              <p className="mt-1 text-xs">
                <span className="font-medium">Expires:</span>{' '}
                {new Date(grant.expiresAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRevoke}
          className="ml-4 px-3 py-1 text-sm font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
        >
          Revoke
        </button>
      </div>
    </div>
  );
}
