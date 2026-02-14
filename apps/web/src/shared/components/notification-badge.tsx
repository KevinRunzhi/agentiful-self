/**
 * NotificationBadge Component (T116)
 *
 * Displays unread notification count with visual indicator.
 * Used in navbar/header to show pending notifications.
 *
 * @see apps/api/src/modules/notifications/routes/notifications.routes.ts
 * @see packages/shared/src/rbac/index.ts - NotificationCount
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotificationCount, BreakglassNotification } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface NotificationBadgeProps {
  /** Click handler to open notification panel */
  onClick?: () => void;
  /** Custom className for styling */
  className?: string;
  /** Show only breakglass notifications count */
  breakglassOnly?: boolean;
}

// =============================================================================
// API Client
// =============================================================================

const apiBase = '/api/v1';

async function fetchUnreadCount(): Promise<NotificationCount> {
  const response = await fetch(`${apiBase}/notifications/unread-count`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notification count');
  }

  const result = await response.json();
  return result.data;
}

async function fetchBreakglassNotifications(): Promise<BreakglassNotification[]> {
  const response = await fetch(`${apiBase}/notifications/breakglass`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch breakglass notifications');
  }

  const result = await response.json();
  return result.data;
}

async function markAllAsRead(): Promise<void> {
  const response = await fetch(`${apiBase}/notifications/read-all`, {
    method: 'PATCH',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to mark all as read');
  }
}

async function markAsRead(notificationId: string): Promise<void> {
  const response = await fetch(`${apiBase}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to mark notification as read');
  }
}

// =============================================================================
// Hooks
// =============================================================================

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useBreakglassNotifications() {
  return useQuery({
    queryKey: ['notifications', 'breakglass'],
    queryFn: fetchBreakglassNotifications,
    staleTime: 30000, // 30 seconds
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// =============================================================================
// Badge Component
// =============================================================================

export function NotificationBadge({
  onClick,
  className = '',
  breakglassOnly = false,
}: NotificationBadgeProps) {
  const { data: count, isLoading, error } = useNotificationCount();

  const displayCount = breakglassOnly
    ? count?.breakglass ?? 0
    : count?.total ?? 0;

  const hasUnread = displayCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-2 rounded-full hover:bg-gray-100 transition-colors ${className}`}
      aria-label={`Notifications${hasUnread ? ` (${displayCount} unread)` : ''}`}
    >
      {/* Bell Icon */}
      <svg
        className="w-5 h-5 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Badge Counter */}
      {hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
          {displayCount > 99 ? '99+' : displayCount}
        </span>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
      )}
    </button>
  );
}

// =============================================================================
// Breakglass Notification Badge (Critical)
// =============================================================================

interface BreakglassBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function BreakglassBadge({ onClick, className = '' }: BreakglassBadgeProps) {
  const { data: count } = useNotificationCount();
  const breakglassCount = count?.breakglass ?? 0;

  if (breakglassCount === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-full hover:bg-red-200 transition-colors ${className}`}
      aria-label={`${breakglassCount} break-glass notification${breakglassCount > 1 ? 's' : ''}`}
    >
      <svg
        className="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>Emergency Access</span>
      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-red-700 bg-red-200 rounded-full">
        {breakglassCount}
      </span>
    </button>
  );
}

// =============================================================================
// Notification Panel (Dropdown/Popover Content)
// =============================================================================

interface NotificationPanelProps {
  className?: string;
  onMarkAllRead?: () => void;
}

export function NotificationPanel({ className = '', onMarkAllRead }: NotificationPanelProps) {
  const { data: count } = useNotificationCount();
  const { data: breakglassNotifications, isLoading } = useBreakglassNotifications();
  const markAllAsReadMutation = useMarkAllAsRead();
  const markAsReadMutation = useMarkAsRead();

  const handleMarkAllRead = () => {
    markAllAsReadMutation.mutate();
    onMarkAllRead?.();
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 w-80 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {count && count.total > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : breakglassNotifications && breakglassNotifications.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {breakglassNotifications.map((notification) => (
              <li
                key={notification.id}
                className={`px-4 py-3 hover:bg-gray-50 ${
                  !notification.isRead ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <svg
                      className={`w-5 h-5 ${
                        notification.isRead ? 'text-gray-400' : 'text-red-500'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${
                      notification.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'
                    }`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.metadata?.reason && `Reason: ${notification.metadata.reason}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Mark as read button */}
                  {!notification.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                      aria-label="Mark as read"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm">No notifications</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {breakglassNotifications && breakglassNotifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            {count?.breakglass ?? 0} break-glass notification{(count?.breakglass ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Notification List Item (for full page)
// =============================================================================

interface NotificationItemProps {
  notification: BreakglassNotification;
  onMarkRead?: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border ${
      notification.isRead
        ? 'bg-white border-gray-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        notification.isRead ? 'bg-gray-100' : 'bg-red-100'
      }`}>
        <svg
          className={`w-5 h-5 ${notification.isRead ? 'text-gray-500' : 'text-red-600'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm ${
          notification.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'
        }`}>
          Emergency Access Notification
        </h4>
        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>

        {notification.metadata && (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            {notification.metadata.rootAdminName && (
              <p>By: {notification.metadata.rootAdminName}</p>
            )}
            <p>Reason: {notification.metadata.reason}</p>
            {notification.metadata.expiresAt && (
              <p>Session expires: {new Date(notification.metadata.expiresAt).toLocaleString()}</p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">
          {new Date(notification.createdAt).toLocaleString()}
        </p>
      </div>

      {!notification.isRead && onMarkRead && (
        <button
          type="button"
          onClick={() => onMarkRead(notification.id)}
          className="flex-shrink-0 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
        >
          Mark as read
        </button>
      )}
    </div>
  );
}
