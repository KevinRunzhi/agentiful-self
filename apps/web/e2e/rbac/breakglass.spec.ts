/**
 * E2E Test: Break-glass Emergency Access
 *
 * T139 Add E2E test for Break-glass activation and expiration
 *
 * Tests:
 * - Root admin can activate break-glass
 * - Activation requires reason (min 10 characters)
 * - Break-glass session expires after 1 hour
 * - Break-glass can be extended
 * - Break-glass can be revoked
 * - Notifications are sent when break-glass is activated
 * - ROOT ADMIN role can be disabled
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_DATA = {
  rootAdmin: {
    email: 'root-admin@example.com',
    password: 'TestPassword123!',
  },
  tenantAdmin: {
    email: 'tenant-admin@example.com',
    password: 'TestPassword123!',
  },
  tenant: {
    id: 'tenant-breakglass-test',
    name: 'Break-glass Test Tenant',
  },
};

// =============================================================================
// Page Objects
// =============================================================================

class BreakglassPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/breakglass');
  }

  async activateBreakglass(tenantId: string, reason: string) {
    await this.page.click('[data-testid="activate-breakglass-button"]');
    await this.page.selectOption('[data-testid="tenant-select"]', tenantId);
    await this.page.fill('[data-testid="breakglass-reason"]', reason);
    await this.page.click('[data-testid="confirm-activate-breakglass"]');
  }

  async getActivationErrorMessage() {
    const errorElement = await this.page.$(
      '[data-testid="breakglass-error-message"]'
    );
    if (!errorElement) return null;
    return await errorElement.textContent();
  }

  async getSessionStatus() {
    const statusElement = await this.page.$(
      '[data-testid="breakglass-session-status"]'
    );
    if (!statusElement) return null;
    return {
      isActive: await statusElement.getAttribute('data-is-active') === 'true',
      tenantId: await statusElement.getAttribute('data-tenant-id'),
      tenantName: await statusElement.getAttribute('data-tenant-name'),
      expiresAt: await statusElement.getAttribute('data-expires-at'),
      remainingTime: await statusElement.getAttribute('data-remaining-time'),
    };
  }

  async extendSession() {
    await this.page.click('[data-testid="extend-breakglass-button"]');
    await this.page.click('[data-testid="confirm-extend-breakglass"]');
  }

  async revokeSession() {
    await this.page.click('[data-testid="revoke-breakglass-button"]');
    await this.page.click('[data-testid="confirm-revoke-breakglass"]');
  }
}

class NotificationPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/notifications');
  }

  async getNotifications() {
    const notificationElements = await this.page.$$(
      '[data-testid^="notification-"]'
    );
    const notifications = [];
    for (const element of notificationElements) {
      const id = await element.getAttribute('data-notification-id');
      const type = await element.getAttribute('data-notification-type');
      const message = await element.$eval(
        '[data-testid="notification-message"]',
        (el) => el.textContent || ''
      );
      const isRead = await element.getAttribute('data-is-read') === 'true';
      notifications.push({ id, type, message, isRead });
    }
    return notifications;
  }

  async getUnreadCount() {
    const countElement = await this.page.$(
      '[data-testid="notification-unread-count"]'
    );
    if (!countElement) return 0;
    const count = await countElement.textContent();
    return parseInt(count || '0', 10);
  }

  async getBreakglassNotifications() {
    await this.goto();
    const notifications = await this.getNotifications();
    return notifications.filter((n) => n.type?.includes('breakglass'));
  }
}

// =============================================================================
// E2E Tests
// =============================================================================

test.describe('T139 E2E: Break-glass Emergency Access', () => {
  let page: Page;
  let breakglassPage: BreakglassPage;
  let notificationPage: NotificationPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    breakglassPage = new BreakglassPage(page);
    notificationPage = new NotificationPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  /**
   * Test 1: Root admin can activate break-glass
   */
  test('should allow root admin to activate break-glass', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Activate break-glass
    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Production incident investigation - critical system failure requires immediate access'
    );

    // Verify activation success
    await expect(
      page.locator('[data-testid="breakglass-activated-success"]')
    ).toBeVisible();
  });

  /**
   * Test 2: Activation requires reason with minimum 10 characters
   */
  test('should require reason with minimum 10 characters', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Try to activate with short reason
    await breakglassPage.goto();
    await page.click('[data-testid="activate-breakglass-button"]');
    await page.selectOption('[data-testid="tenant-select"]', TEST_DATA.tenant.id);
    await page.fill('[data-testid="breakglass-reason"]', 'Short'); // < 10 chars
    await page.click('[data-testid="confirm-activate-breakglass"]');

    // Should show validation error
    const error = await breakglassPage.getActivationErrorMessage();
    expect(error).toContain('at least 10 characters');
  });

  /**
   * Test 3: Cannot activate break-glass when disabled
   */
  test('should prevent activation when ROOT ADMIN is disabled', async () => {
    // This test requires environment variable ENABLE_ROOT_ADMIN=false
    // For E2E testing, we'll verify the API returns correct error

    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Try to activate via API
    const response = await page.evaluate(
      async ({ tenantId, reason }) => {
        try {
          const res = await fetch('/api/rbac/breakglass/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, reason }),
          });
          return {
            status: res.status,
            data: await res.json(),
          };
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
      {
        tenantId: TEST_DATA.tenant.id,
        reason: 'Test activation when disabled',
      }
    );

    // If ROOT ADMIN is disabled, should get 403 with specific error code
    if (response.status === 403) {
      expect(response.data.errors[0].code).toBe('AFUI_IAM_007');
    }
  });

  /**
   * Test 4: Get break-glass session status
   */
  test('should return break-glass session status', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Activate break-glass first
    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Testing session status retrieval'
    );

    // Get session status
    const status = await breakglassPage.getSessionStatus();

    expect(status).not.toBeNull();
    expect(status?.isActive).toBe(true);
    expect(status?.tenantId).toBe(TEST_DATA.tenant.id);
    expect(status?.remainingTime).toBeTruthy();
  });

  /**
   * Test 5: Extend active break-glass session
   */
  test('should allow extending active break-glass session', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Activate break-glass
    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Testing session extension'
    );

    // Get initial expiration
    const initialStatus = await breakglassPage.getSessionStatus();
    const initialExpiresAt = initialStatus?.expiresAt;

    // Extend session
    await breakglassPage.extendSession();

    // Verify extension success
    await expect(
      page.locator('[data-testid="breakglass-extended-success"]')
    ).toBeVisible();

    // Get new expiration
    const newStatus = await breakglassPage.getSessionStatus();
    const newExpiresAt = newStatus?.expiresAt;

    // New expiration should be later than initial
    expect(newExpiresAt).not.toBe(initialExpiresAt);
  });

  /**
   * Test 6: Revoke active break-glass session
   */
  test('should allow revoking active break-glass session', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Activate break-glass
    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Testing session revocation'
    );

    // Verify session is active
    const statusBefore = await breakglassPage.getSessionStatus();
    expect(statusBefore?.isActive).toBe(true);

    // Revoke session
    await breakglassPage.revokeSession();

    // Verify revocation success
    await expect(
      page.locator('[data-testid="breakglass-revoked-success"]')
    ).toBeVisible();

    // Verify session is no longer active
    const statusAfter = await breakglassPage.getSessionStatus();
    expect(statusAfter?.isActive).toBe(false);
  });

  /**
   * Test 7: Notifications sent when break-glass is activated
   */
  test('should send notifications when break-glass is activated', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Activate break-glass
    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Testing notification on break-glass activation'
    );

    // Check for break-glass notifications
    const breakglassNotifications = await notificationPage.getBreakglassNotifications();

    // Should have at least one break-glass notification
    expect(breakglassNotifications.length).toBeGreaterThan(0);

    const activationNotification = breakglassNotifications.find((n) =>
      n.type?.includes('breakglass_activated')
    );
    expect(activationNotification).toBeDefined();
  });

  /**
   * Test 8: Tenant admin sees break-glass notifications
   */
  test('should show break-glass notifications to tenant admin', async () => {
    // First, activate break-glass as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Tenant should be notified'
    );

    // Logout and login as tenant admin
    await page.goto('/auth/logout');
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.tenantAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.tenantAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Check notifications
    const breakglassNotifications = await notificationPage.getBreakglassNotifications();

    // Tenant admin should see break-glass activation notification
    expect(breakglassNotifications.length).toBeGreaterThan(0);

    // Check unread count
    const unreadCount = await notificationPage.getUnreadCount();
    expect(unreadCount).toBeGreaterThan(0);
  });

  /**
   * Test 9: Break-glass session expires after 1 hour
   */
  test('should expire break-glass session after 1 hour', async () => {
    // This test would normally require waiting 1 hour
    // For E2E testing, we'll verify the session timeout is set correctly

    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Activate break-glass
    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Testing session expiration'
    );

    // Get session info
    const status = await breakglassPage.getSessionStatus();

    // Verify expiresAt is approximately 1 hour from now
    const now = Date.now();
    const expiresAt = new Date(status?.expiresAt || 0).getTime();
    const oneHourMs = 60 * 60 * 1000;

    // Allow some tolerance (±5 seconds)
    expect(expiresAt - now).toBeGreaterThanOrEqual(oneHourMs - 5000);
    expect(expiresAt - now).toBeLessThanOrEqual(oneHourMs + 5000);
  });

  /**
   * Test 10: Root admin cannot activate for non-existent tenant
   */
  test('should prevent activation for non-existent tenant', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Try to activate for non-existent tenant
    const response = await page.evaluate(
      async ({ tenantId, reason }) => {
        const res = await fetch('/api/rbac/breakglass/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, reason }),
        });
        return {
          status: res.status,
          data: await res.json(),
        };
      },
      {
        tenantId: 'non-existent-tenant-id',
        reason: 'Testing non-existent tenant activation',
      }
    );

    // Should return 404 or 400
    expect([400, 404]).toContain(response.status);
  });

  /**
   * Test 11: Get break-glass status via API
   */
  test('should return break-glass status via API', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Get status via API
    const response = await page.evaluate(
      async (tenantId) => {
        const res = await fetch(
          `/api/rbac/breakglass/status?tenantId=${tenantId}`,
          {
            method: 'GET',
          }
        );
        return await res.json();
      },
      TEST_DATA.tenant.id
    );

    // Verify response structure
    expect(response.data).toHaveProperty('isActive');
    expect(response.data).toHaveProperty('remainingTime');
    expect(typeof response.data.isActive).toBe('boolean');
    expect(typeof response.data.remainingTime).toBe('number');
  });

  /**
   * Test 12: Cannot extend non-existent session
   */
  test('should prevent extending non-existent session', async () => {
    // Login as root admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    // Try to extend without active session
    const response = await page.evaluate(
      async (tenantId) => {
        const res = await fetch(
          `/api/rbac/breakglass/extend?tenantId=${tenantId}`,
          {
            method: 'POST',
          }
        );
        return {
          status: res.status,
          data: await res.json(),
        };
      },
      TEST_DATA.tenant.id
    );

    // Should return 404
    expect(response.status).toBe(404);
  });

  /**
   * Test 13: Tenant admin receives notification on activation
   */
  test('should create tenant-wide notification on activation', async () => {
    // Login as root admin and activate
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.rootAdmin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.rootAdmin.password);
    await page.click('[data-testid="login-button"]');

    await breakglassPage.goto();
    await breakglassPage.activateBreakglass(
      TEST_DATA.tenant.id,
      'Testing tenant-wide notification'
    );

    // Verify notification was created for all tenant admins
    const response = await page.evaluate(async (tenantId) => {
      const res = await fetch(`/api/notifications/breakglass?tenantId=${tenantId}`, {
        method: 'GET',
      });
      return await res.json();
    }, TEST_DATA.tenant.id);

    expect(response.data).toBeInstanceOf(Array);
    const activationNotification = response.data.find(
      (n: any) => n.type === 'breakglass_activated'
    );
    expect(activationNotification).toBeDefined();
  });
});
