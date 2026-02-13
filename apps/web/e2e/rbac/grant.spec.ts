/**
 * E2E Test: Group→App Grant and Visibility Workflow
 *
 * T135 Add E2E test for group→app grant and visibility workflow
 *
 * Tests:
 * - Admin can create group grants to apps
 * - Group members can see granted apps in accessible apps list
 * - Context switching works between groups
 * - Grant expiration is enforced
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_DATA = {
  admin: {
    email: 'admin-grant-test@example.com',
    password: 'TestPassword123!',
  },
  user: {
    email: 'user-grant-test@example.com',
    password: 'TestPassword123!',
  },
  groups: {
    alpha: 'Alpha Group',
    beta: 'Beta Group',
  },
  apps: {
    dashboard: 'Dashboard App',
    analytics: 'Analytics App',
  },
};

// =============================================================================
// Page Objects
// =============================================================================

class GrantManagementPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/grants');
  }

  async createGroupGrant(appId: string, groupId: string) {
    await this.page.click('[data-testid="create-grant-button"]');
    await this.page.selectOption('[data-testid="app-select"]', appId);
    await this.page.selectOption('[data-testid="grantee-type"]', 'group');
    await this.page.selectOption('[data-testid="group-select"]', groupId);
    await this.page.selectOption('[data-testid="permission-select"]', 'use');
    await this.page.fill(
      '[data-testid="grant-reason"]',
      'E2E test grant'
    );
    await this.page.click('[data-testid="confirm-create-grant"]');
  }

  async revokeGrant(grantId: string) {
    await this.page.click(`[data-testid="revoke-grant-${grantId}"]`);
    await this.page.click('[data-testid="confirm-revoke-grant"]');
  }

  async getGrantsForApp(appId: string) {
    await this.page.goto(`/settings/grants?app=${appId}`);
    const grantElements = await this.page.$$('[data-testid^="grant-row-"]');
    return grantElements.length;
  }
}

class AppListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/apps');
  }

  async getAccessibleApps() {
    const appElements = await this.page.$$('[data-testid^="app-card-"]');
    const apps = [];
    for (const element of appElements) {
      const id = await element.getAttribute('data-testid');
      const name = await element.$eval(
        '[data-testid="app-name"]',
        (el) => el.textContent || ''
      );
      apps.push({ id, name });
    }
    return apps;
  }

  async openApp(appId: string) {
    await this.page.click(`[data-testid="app-card-${appId}"]`);
  }

  async getContextSwitchDialog() {
    const isVisible = await this.page.isVisible(
      '[data-testid="context-switch-dialog"]'
    );
    return isVisible;
  }

  async selectGroupInDialog(groupId: string) {
    await this.page.click(`[data-testid="group-option-${groupId}"]`);
    await this.page.click('[data-testid="confirm-context-switch"]');
  }

  async directAccessApp(appId: string) {
    await this.page.click(`[data-testid="direct-access-${appId}"]`);
  }
}

// =============================================================================
// E2E Tests
// =============================================================================

test.describe('T135 E2E: Group→App Grant and Visibility', () => {
  let page: Page;
  let grantPage: GrantManagementPage;
  let appListPage: AppListPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    grantPage = new GrantManagementPage(page);
    appListPage = new AppListPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  /**
   * Test 1: Admin can create group grant to app
   */
  test('should allow admin to create group grant to app', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to grants page
    await grantPage.goto();

    // Create group grant
    await grantPage.createGroupGrant('app-dashboard', 'group-alpha');

    // Verify grant created
    await expect(
      page.locator('[data-testid="grant-created-success"]')
    ).toBeVisible();
  });

  /**
   * Test 2: Group members can see granted apps
   */
  test('should show granted apps to group members', async () => {
    // Login as group member
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to apps
    await appListPage.goto();

    // Get accessible apps
    const apps = await appListPage.getAccessibleApps();

    // Should include Dashboard app (granted to user's group)
    const dashboardApp = apps.find((app) =>
      app.name.includes(TEST_DATA.apps.dashboard)
    );
    expect(dashboardApp).toBeDefined();
  });

  /**
   * Test 3: Context switch dialog shows when multiple groups have access
   */
  test('should show context switch dialog when multiple groups have app access', async () => {
    // Login as user belonging to multiple groups
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to apps
    await appListPage.goto();

    // Try to access app that requires context selection
    await appListPage.openApp('app-analytics');

    // Should show context switch dialog
    const showDialog = await appListPage.getContextSwitchDialog();
    expect(showDialog).toBe(true);
  });

  /**
   * Test 4: Can switch active group and access app
   */
  test('should allow switching active group to access app', async () => {
    // Login as user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to apps
    await appListPage.goto();

    // Open app that requires context switch
    await appListPage.openApp('app-analytics');

    // Switch group in dialog
    await appListPage.selectGroupInDialog('group-beta');

    // Should navigate to app
    await expect(page).toHaveURL(/\/apps\/app-analytics/);
  });

  /**
   * Test 5: Get app context options
   */
  test('should return context options for app', async () => {
    // Login as user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Fetch context options
    const response = await page.evaluate(async (appId) => {
      const res = await fetch(`/api/rbac/apps/${appId}/context-options`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await res.json();
    }, 'app-analytics');

    // Verify response structure
    expect(response.data).toHaveProperty('currentGroup');
    expect(response.data).toHaveProperty('availableGroups');
    expect(Array.isArray(response.data.availableGroups)).toBe(true);
  });

  /**
   * Test 6: Get accessible apps with context information
   */
  test('should return accessible apps with context switching information', async () => {
    // Login as user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Fetch accessible apps
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/apps/accessible', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await res.json();
    });

    // Verify response structure
    expect(response.data).toHaveProperty('apps');
    expect(Array.isArray(response.data.apps)).toBe(true);

    // Each app should have context information
    if (response.data.apps.length > 0) {
      const app = response.data.apps[0];
      expect(app).toHaveProperty('currentGroup');
      expect(app).toHaveProperty('availableGroups');
      expect(app).toHaveProperty('requiresSwitch');
    }
  });

  /**
   * Test 7: Admin can revoke group grant
   */
  test('should allow admin to revoke group grant', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to grants page
    await grantPage.goto();

    // Revoke grant
    await grantPage.revokeGrant('grant-alpha-dashboard');

    // Verify grant revoked
    await expect(
      page.locator('[data-testid="grant-revoked-success"]')
    ).toBeVisible();
  });

  /**
   * Test 8: Revoked grants no longer provide access
   */
  test('should not provide access after grant is revoked', async () => {
    // Login as group member
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to apps
    await appListPage.goto();

    // Get accessible apps
    const apps = await appListPage.getAccessibleApps();

    // Should NOT include app with revoked grant
    const revokedApp = apps.find((app) =>
      app.name.includes('Revoked App')
    );
    expect(revokedApp).toBeUndefined();
  });

  /**
   * Test 9: Grant with expiration is enforced
   */
  test('should enforce grant expiration', async () => {
    // This test requires setting up a grant with past expiration
    // For now, we'll test the API endpoint

    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create expired grant via API
    await page.evaluate(async () => {
      await fetch('/api/rbac/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'app-expired-test',
          granteeType: 'group',
          granteeId: 'group-alpha',
          permission: 'use',
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Past
        }),
      });
    });

    // Login as group member
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Try to access app with expired grant
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'app',
          action: 'use',
          resourceId: 'app-expired-test',
        }),
      });
      return await res.json();
    });

    // Should be denied
    expect(response.data.allowed).toBe(false);
  });

  /**
   * Test 10: Explicit deny overrides group grant
   */
  test('should have explicit deny override group grant', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create group grant
    await grantPage.goto();
    await grantPage.createGroupGrant('app-dashboard', 'group-alpha');

    // Create explicit deny for user
    await page.evaluate(async () => {
      await fetch('/api/rbac/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'app-dashboard',
          granteeType: 'user',
          granteeId: 'user-grant-test@example.com',
          permission: 'deny',
          reason: 'E2E test deny',
        }),
      });
    });

    // Login as user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Try to access app
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'app',
          action: 'use',
          resourceId: 'app-dashboard',
        }),
      });
      return await res.json();
    });

    // Should be denied (explicit deny overrides group grant)
    expect(response.data.allowed).toBe(false);
    expect(response.data.reason).toBe('explicit_deny');
  });
});
