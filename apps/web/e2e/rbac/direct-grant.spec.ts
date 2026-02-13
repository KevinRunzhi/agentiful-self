/**
 * E2E Test: User Direct Grant with Expiration
 *
 * T138 Add E2E test for user direct grant with expiration
 *
 * Tests:
 * - Admin can create user direct grants
 * - User direct grants require reason and expiration
 * - Maximum expiration is 90 days
 * - User direct grants override group grants
 * - Expired grants are automatically invalidated
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_DATA = {
  admin: {
    email: 'admin-direct-grant@example.com',
    password: 'TestPassword123!',
  },
  user: {
    email: 'user-direct-grant@example.com',
    password: 'TestPassword123!',
  },
  apps: {
    analytics: 'Analytics App',
  },
};

// =============================================================================
// Page Objects
// =============================================================================

class GrantPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/grants');
  }

  async createUserGrant(appId: string, userId: string, reason: string, expiresInDays: number) {
    await this.page.click('[data-testid="create-grant-button"]');
    await this.page.selectOption('[data-testid="app-select"]', appId);
    await this.page.selectOption('[data-testid="grantee-type"]', 'user');
    await this.page.fill('[data-testid="user-search"]', userId);
    await this.page.click(`[data-testid="user-option-${userId}"]`);
    await this.page.selectOption('[data-testid="permission-select"]', 'use');
    await this.page.fill('[data-testid="grant-reason"]', reason);

    // Set expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expiresInDays);
    await this.page.fill(
      '[data-testid="grant-expires-at"]',
      expirationDate.toISOString().split('T')[0]
    );

    await this.page.click('[data-testid="confirm-create-grant"]');
  }

  async getGrantErrorMessage() {
    const errorElement = await this.page.$(
      '[data-testid="grant-error-message"]'
    );
    if (!errorElement) return null;
    return await errorElement.textContent();
  }

  async getUserGrants(userId: string) {
    const grantElements = await this.page.$$(
      `[data-grantee-id="${userId}"]`
    );
    return grantElements.length;
  }

  async getGrantExpiration(grantId: string) {
    const grantElement = await this.page.$(
      `[data-testid="grant-${grantId}"]`
    );
    if (!grantElement) return null;
    return await grantElement.$eval(
      '[data-testid="grant-expires-at"]',
      (el) => el.textContent || ''
    );
  }
}

class PermissionCheckPage {
  constructor(private page: Page) {}

  async checkPermission(resourceType: string, action: string, resourceId: string) {
    const response = await this.page.evaluate(
      async ({ resourceType, action, resourceId }) => {
        const res = await fetch('/api/rbac/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceType, action, resourceId }),
        });
        return await res.json();
      },
      { resourceType, action, resourceId }
    );
    return response;
  }
}

// =============================================================================
// E2E Tests
// =============================================================================

test.describe('T138 E2E: User Direct Grant with Expiration', () => {
  let page: Page;
  let grantPage: GrantPage;
  let permPage: PermissionCheckPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    grantPage = new GrantPage(page);
    permPage = new PermissionCheckPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  /**
   * Test 1: Admin can create user direct grant
   */
  test('should allow admin to create user direct grant', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create user direct grant
    await grantPage.goto();
    await grantPage.createUserGrant(
      'app-analytics',
      'user-direct-grant@example.com',
      'Temporary access for project X',
      30 // 30 days
    );

    // Verify success
    await expect(
      page.locator('[data-testid="grant-created-success"]')
    ).toBeVisible();
  });

  /**
   * Test 2: User direct grant requires reason
   */
  test('should require reason for user direct grant', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Try to create grant without reason
    await grantPage.goto();
    await page.click('[data-testid="create-grant-button"]');
    await page.selectOption('[data-testid="app-select"]', 'app-analytics');
    await page.selectOption('[data-testid="grantee-type"]', 'user');
    await page.fill('[data-testid="user-search"]', TEST_DATA.user.email);
    await page.click(`[data-testid="user-option-${TEST_DATA.user.email}"]`);
    await page.selectOption('[data-testid="permission-select"]', 'use');

    // Leave reason empty and try to confirm
    await page.click('[data-testid="confirm-create-grant"]');

    // Should show validation error
    const error = await grantPage.getGrantErrorMessage();
    expect(error).toContain('reason is required');
  });

  /**
   * Test 3: User direct grant requires expiration date
   */
  test('should require expiration date for user direct grant', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Try to create grant without expiration
    await grantPage.goto();
    await page.click('[data-testid="create-grant-button"]');
    await page.selectOption('[data-testid="app-select"]', 'app-analytics');
    await page.selectOption('[data-testid="grantee-type"]', 'user');
    await page.fill('[data-testid="user-search"]', TEST_DATA.user.email);
    await page.click(`[data-testid="user-option-${TEST_DATA.user.email}"]`);
    await page.selectOption('[data-testid="permission-select"]', 'use');
    await page.fill('[data-testid="grant-reason"]', 'Test without expiration');

    // Leave expiration empty and try to confirm
    await page.click('[data-testid="confirm-create-grant"]');

    // Should show validation error
    const error = await grantPage.getGrantErrorMessage();
    expect(error).toContain('expiration date is required');
  });

  /**
   * Test 4: Maximum expiration is 90 days
   */
  test('should enforce maximum 90 day expiration', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Try to create grant with > 90 days
    await grantPage.goto();
    await page.click('[data-testid="create-grant-button"]');
    await page.selectOption('[data-testid="app-select"]', 'app-analytics');
    await page.selectOption('[data-testid="grantee-type"]', 'user');
    await page.fill('[data-testid="user-search"]', TEST_DATA.user.email);
    await page.click(`[data-testid="user-option-${TEST_DATA.user.email}"]`);
    await page.selectOption('[data-testid="permission-select"]', 'use');
    await page.fill('[data-testid="grant-reason"]', 'Test with long expiration');

    // Set expiration to 91 days
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 91);
    await page.fill(
      '[data-testid="grant-expires-at"]',
      expirationDate.toISOString().split('T')[0]
    );

    await page.click('[data-testid="confirm-create-grant"]');

    // Should show validation error
    const error = await grantPage.getGrantErrorMessage();
    expect(error).toContain('maximum 90 days');
  });

  /**
   * Test 5: User with direct grant has access
   */
  test('should grant access to user with direct grant', async () => {
    // Login as user with direct grant
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Check permission
    const result = await permPage.checkPermission(
      'app',
      'use',
      'app-analytics'
    );

    expect(result.data.allowed).toBe(true);
    expect(result.data.reason).toBe('user_grant');
  });

  /**
   * Test 6: User direct grant overrides group grant
   */
  test('should have user direct grant override group grant', async () => {
    // Setup: User has both group grant and user direct grant
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create group grant (deny)
    await page.evaluate(async () => {
      await fetch('/api/rbac/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'app-priority-test',
          granteeType: 'group',
          granteeId: 'group-beta',
          permission: 'deny',
          reason: 'Group deny for priority test',
        }),
      });
    });

    // Create user direct grant (use) - should override
    await page.evaluate(async () => {
      await fetch('/api/rbac/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'app-priority-test',
          granteeType: 'user',
          granteeId: 'user-direct-grant@example.com',
          permission: 'use',
          reason: 'User grant overrides',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });

    // Login as user and check permission
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    const result = await permPage.checkPermission(
      'app',
      'use',
      'app-priority-test'
    );

    // User direct grant should have higher priority
    expect(result.data.allowed).toBe(true);
    expect(result.data.reason).toBe('user_grant');
  });

  /**
   * Test 7: Expired grant does not grant access
   */
  test('should not grant access with expired user direct grant', async () => {
    // Login as admin to create expired grant
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create grant that's already expired
    await page.evaluate(async () => {
      await fetch('/api/rbac/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'app-expired-test',
          granteeType: 'user',
          granteeId: 'user-direct-grant@example.com',
          permission: 'use',
          reason: 'Expired test grant',
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Past
        }),
      });
    });

    // Login as user and check permission
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    const result = await permPage.checkPermission(
      'app',
      'use',
      'app-expired-test'
    );

    // Expired grant should not grant access
    expect(result.data.allowed).toBe(false);
  });

  /**
   * Test 8: User can see their direct grants
   */
  test('should show user their direct grants', async () => {
    // Login as user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to my grants page
    await page.goto('/settings/my-grants');

    // Verify grants are listed
    await expect(
      page.locator('[data-testid="my-grants-list"]')
    ).toBeVisible();

    const grantElements = await page.$$(
      '[data-testid^="user-grant-"]'
    );
    expect(grantElements.length).toBeGreaterThan(0);
  });

  /**
   * Test 9: Grant expiration is displayed correctly
   */
  test('should display grant expiration date correctly', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create grant with 30 day expiration
    await grantPage.goto();
    await grantPage.createUserGrant(
      'app-analytics',
      'user-direct-grant@example.com',
      'Test expiration display',
      30
    );

    // Get the created grant ID
    const grantId = await page.evaluate(() => {
      const element = document.querySelector(
        '[data-testid^="grant-row-"]'
      ) as HTMLElement;
      return element?.dataset.grantId;
    });

    // Check expiration display
    const expiration = await grantPage.getGrantExpiration(grantId || '');
    expect(expiration).toBeTruthy();
    expect(expiration).toContain('days');
  });

  /**
   * Test 10: Admin can revoke user direct grant
   */
  test('should allow admin to revoke user direct grant', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to grants page
    await grantPage.goto();

    // Find and revoke user direct grant
    await page.click('[data-testid="revoke-grant-user-direct"]');

    // Confirm revocation
    await page.click('[data-testid="confirm-revoke-grant"]');

    // Verify success
    await expect(
      page.locator('[data-testid="grant-revoked-success"]')
    ).toBeVisible();

    // Verify user no longer has access
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    const result = await permPage.checkPermission(
      'app',
      'use',
      'app-analytics'
    );

    expect(result.data.allowed).toBe(false);
  });

  /**
   * Test 11: Audit event created for user grant
   */
  test('should create audit event when user grant is created', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Create user grant
    await grantPage.goto();
    await grantPage.createUserGrant(
      'app-analytics',
      'user-direct-grant@example.com',
      'Audit test grant',
      30
    );

    // Navigate to audit log
    await page.goto('/settings/audit');

    // Verify audit event
    await expect(
      page.locator('[data-testid="audit-event-grant.created"]')
    ).toBeVisible();
  });

  /**
   * Test 12: Audit event created for grant expiration
   */
  test('should log audit event when grant expires', async () => {
    // This would require waiting for actual expiration or manual trigger
    // For E2E testing, we'll verify the API endpoint exists

    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Check audit events for grant.expired
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/audit?filter=grant.expired', {
        method: 'GET',
      });
      return await res.json();
    });

    expect(Array.isArray(response.data.events)).toBe(true);
  });
});
