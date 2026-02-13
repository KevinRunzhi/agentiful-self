/**
 * GroupSwitcher Component
 *
 * UI component for switching active groups (T079).
 * Hides for single-group users (T081) and filters by app context (T082).
 */

import { useActiveGroup } from '../hooks/use-active-group';
import type { ActiveGroupContext } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface GroupSwitcherProps {
  tenantId: string;
  groups: ActiveGroupContext[];
  currentAppId?: string; // For app context filtering (T082)
}

// =============================================================================
// Component
// =============================================================================

export function GroupSwitcher({ tenantId, groups, currentAppId }: GroupSwitcherProps) {
  const { activeGroup, activeGroupId, setActiveGroup, canSwitch } = useActiveGroup({
    tenantId,
    groups,
  });

  // Hide for single-group users (T081)
  if (!canSwitch) {
    return null;
  }

  // Filter groups by app context if in app context (T082)
  const displayGroups = currentAppId
    ? groups.filter((g) => g.hasAccess)
    : groups;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveGroup(event.target.value);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md">
      <span className="text-sm text-gray-600">Group:</span>
      <select
        value={activeGroupId || ''}
        onChange={handleChange}
        className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-0 focus:ring-0 cursor-pointer"
      >
        {displayGroups.map((group) => (
          <option key={group.groupId} value={group.groupId}>
            {group.groupName}
          </option>
        ))}
      </select>

      {/* Current group indicator */}
      {activeGroup && (
        <span className="text-xs text-gray-500">
          {activeGroup.groupName}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Compact Version (for navbar)
// =============================================================================

interface GroupSwitcherCompactProps {
  tenantId: string;
  groups: ActiveGroupContext[];
  currentAppId?: string;
  onOpenChange?: (open: boolean) => void;
}

export function GroupSwitcherCompact({
  tenantId,
  groups,
  currentAppId,
  onOpenChange,
}: GroupSwitcherCompactProps) {
  const { activeGroup, canSwitch } = useActiveGroup({
    tenantId,
    groups,
  });

  if (!canSwitch) {
    return null;
  }

  const displayGroups = currentAppId
    ? groups.filter((g) => g.hasAccess)
    : groups;

  if (displayGroups.length <= 1) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenChange?.(true)}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
    >
      <span className="font-medium">{activeGroup?.groupName || 'Select Group'}</span>
      <svg
        className="w-4 h-4 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

// =============================================================================
// Dialog Version (for context switching)
// =============================================================================

interface GroupSwitcherDialogProps {
  tenantId: string;
  groups: ActiveGroupContext[];
  currentAppId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGroup: (groupId: string) => void;
}

export function GroupSwitcherDialog({
  tenantId,
  groups,
  currentAppId,
  open,
  onOpenChange,
  onSelectGroup,
}: GroupSwitcherDialogProps) {
  const { activeGroupId } = useActiveGroup({
    tenantId,
    groups,
  });

  const displayGroups = currentAppId
    ? groups.filter((g) => g.hasAccess)
    : groups;

  const handleSelect = (groupId: string) => {
    onSelectGroup(groupId);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Switch Group</h2>

        <div className="space-y-2">
          {displayGroups.map((group) => (
            <button
              key={group.groupId}
              type="button"
              onClick={() => handleSelect(group.groupId)}
              className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                group.groupId === activeGroupId
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{group.groupName}</span>
                {group.groupId === activeGroupId && (
                  <span className="text-xs text-blue-600">Current</span>
                )}
              </div>
              {!group.hasAccess && currentAppId && (
                <p className="text-xs text-gray-500 mt-1">
                  No access to current app
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
