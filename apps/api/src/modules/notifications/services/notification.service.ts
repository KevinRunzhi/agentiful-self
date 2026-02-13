/**
 * Notification Store (In-Memory)
 *
 * Simple in-memory notification storage for S1-2.
 * In production, this should be replaced with a proper database-backed service.
 */

import type { BreakglassNotification } from '../services/breakglass.service';

// =============================================================================
// Types
// =============================================================================

interface UnreadCount {
  total: number;
  breakglass: number;
  other: number;
}

// =============================================================================
// Notification Store
// =============================================================================

class InMemoryNotificationStore {
  private notifications: Map<string, BreakglassNotification> = new Map();
  private tenantNotifications: Map<string, Set<string>> = new Map();

  /**
   * T111 [P] [US6] Implement notification marker store
   */
  async create(notification: Omit<BreakglassNotification, 'id'>): Promise<string> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const fullNotification: BreakglassNotification = {
      ...notification,
      id,
    };

    this.notifications.set(id, fullNotification);

    // Track by tenant
    if (!this.tenantNotifications.has(notification.tenantId)) {
      this.tenantNotifications.set(notification.tenantId, new Set());
    }
    this.tenantNotifications.get(notification.tenantId)!.add(id);

    return id;
  }

  /**
   * T113 [P] Get break-glass notifications for tenant
   */
  async findByTenant(tenantId: string): Promise<BreakglassNotification[]> {
    const notificationIds = this.tenantNotifications.get(tenantId);
    if (!notificationIds) {
      return [];
    }

    const notifications: BreakglassNotification[] = [];
    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get unread count for tenant
   */
  async getUnreadCount(tenantId: string): Promise<UnreadCount> {
    const notifications = await this.findByTenant(tenantId);

    let breakglass = 0;
    let other = 0;

    for (const notification of notifications) {
      if (!notification.isRead) {
        if (notification.type === 'breakglass_activated' || notification.type === 'breakglass_expired') {
          breakglass++;
        } else {
          other++;
        }
      }
    }

    return {
      total: breakglass + other,
      breakglass,
      other,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.isRead = true;
    }
  }

  /**
   * Mark all notifications as read for tenant
   */
  async markAllAsRead(tenantId: string): Promise<void> {
    const notificationIds = this.tenantNotifications.get(tenantId);
    if (!notificationIds) {
      return;
    }

    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (notification) {
        notification.isRead = true;
      }
    }
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOld(before: Date): Promise<number> {
    let deleted = 0;

    for (const [id, notification] of this.notifications.entries()) {
      if (notification.createdAt < before) {
        this.notifications.delete(id);
        this.tenantNotifications.get(notification.tenantId)?.delete(id);
        deleted++;
      }
    }

    return deleted;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const notificationStore = new InMemoryNotificationStore();

// =============================================================================
// Factory
// =============================================================================

export function createNotificationStore() {
  return notificationStore;
}
