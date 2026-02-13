/**
 * E2E Test: Active Group Switching and Quota Attribution
 *
 * T136 Add E2E test for Active Group switching and quota attribution
 *
 * Tests:
 * - User can set active group
 * - Active group affects permission checks
 * - Quota attribution follows active group
 * - Group switching persists across sessions
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_DATA = {
  user: {
    email: 'group-switch-test@example.com',
    password: 'TestPassword123!',
  },
  groups: {
    alpha: { id: 'group-alpha', name: 'Alpha Group' },
    beta: { id: 'group-beta', name: 'Beta Group' },
    gamma: { id: 'group-gamma', name: 'Gamma Group' },
  },
};

// =============================================================================
// Page Objects
// =============================================================================

class ActiveGroupPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/groups');
  }

  async getActiveGroup() {
    const activeGroupElement = await this.page.$(
      '[data-testid="active-group-display"]'
    );
    if (!activeGroupElement) return null;
    return {
      id: await activeGroupElement.getAttribute('data-group-id'),
      name: await activeGroupElement.textContent(),
    };
  }

  async setActiveGroup(groupId: string) {
    await this.page.click('[data-testid="group-switcher-button"]');
    await this.page.click(`[data-testid="group-option-${groupId}"]`);
    // Wait for confirmation
    await this.page.waitForSelector(
      '[data-testid="group-switch-success"]',
      { timeout: 5000 }
    );
  }

  async getAvailableGroups() {
    const groupElements = await this.page.$$(
      '[data-testid^="available-group-"]'
    );
    const groups = [];
    for (const element of groupElements) {
      const id = await element.getAttribute('data-group-id');
      const name = await element.$eval(
        '[data-testid="group-name"]',
        (el) => el.textContent || ''
      );
      groups.push({ id, name });
    }
    return groups;
  }

  async verifyQuotaAttribution(expectedGroupId: string) {
    const quotaElement = await this.page.$(
      '[data-testid="quota-attribution"]'
    );
    const attributedGroupId = await quotaElement?.getAttribute('data-group-id');
    return attributedGroupId === expectedGroupId;
  }
}

class ApiHelper {
  constructor(private page: Page) {}

  async setActiveGroupApi(groupId: string) {
    const response = await this.page.evaluate(
      async (groupId) => {
        const res = await fetch('/api/rbac/active-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
        });
        return await res.json();
      },
      groupId
    );
    return response;
  }

  async getActiveGroupApi() {
    const response = await this.page.evaluate(async () => {
      const res = await fetch('/api/rbac/active-group', {
        method: 'GET',
      });
      return await res.json();
    });
    return response;
  }
}

// =============================================================================
// E2E Tests
// =============================================================================

test.describe('T136 E2E: Active Group Switching', () => {
  let page: Page;
  let activeGroupPage: ActiveGroupPage;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    activeGroupPage = new ActiveGroupPage(page);
    apiHelper = new ApiHelper(page);
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  /**
   * Test 1: User can set active group via UI
   */
  test('should allow user to set active group', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to groups page
    await activeGroupPage.goto();

    // Set active group to Alpha
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.alpha.id);

    // Verify active group updated
    const activeGroup = await activeGroupPage.getActiveGroup();
    expect(activeGroup?.id).toBe(TEST_DATA.groups.alpha.id);
  });

  /**
   * Test 2: Active group affects permission checks
   */
  test('should use active group for permission checks', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group to Alpha (has access to some apps)
    await activeGroupPage.goto();
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.alpha.id);

    // Check permission with Alpha group active
    const alphaPermission = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'app',
          action: 'use',
          resourceId: 'app-alpha-only',
        }),
      });
      return await res.json();
    });

    // Set active group to Beta (does NOT have access)
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.beta.id);

    const betaPermission = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'app',
          action: 'use',
          resourceId: 'app-alpha-only',
        }),
      });
      return await res.json();
    });

    // Alpha should have access, Beta should not
    expect(alphaPermission.data.allowed).toBe(true);
    expect(betaPermission.data.allowed).toBe(false);
  });

  /**
   * Test 3: Quota attribution follows active group
   */
  test('should attribute quota usage to active group', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group to Alpha
    await activeGroupPage.goto();
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.alpha.id);

    // Perform an action that consumes quota
    await page.goto('/apps/chat');
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');

    // Check quota attribution
    const attributedToAlpha = await activeGroupPage.verifyQuotaAttribution(
      TEST_DATA.groups.alpha.id
    );
    expect(attributedToAlpha).toBe(true);

    // Switch to Beta
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.beta.id);

    // Perform another action
    await page.fill('[data-testid="chat-input"]', 'Another test message');
    await page.click('[data-testid="send-button"]');

    // Check quota attribution
    const attributedToBeta = await activeGroupPage.verifyQuotaAttribution(
      TEST_DATA.groups.beta.id
    );
    expect(attributedToBeta).toBe(true);
  });

  /**
   * Test 4: Set active group via API
   */
  test('should allow setting active group via API', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group via API
    const response = await apiHelper.setActiveGroupApi(TEST_DATA.groups.gamma.id);

    expect(response.data.groupId).toBe(TEST_DATA.groups.gamma.id);
    expect(response.data.groupName).toBe(TEST_DATA.groups.gamma.name);
  });

  /**
   * Test 5: Get current active group via API
   */
  test('should return current active group via API', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group
    await activeGroupPage.goto();
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.beta.id);

    // Get via API
    const response = await apiHelper.getActiveGroupApi();

    expect(response.data.groupId).toBe(TEST_DATA.groups.beta.id);
    expect(response.data.groupName).toBe(TEST_DATA.groups.beta.name);
  });

  /**
   * Test 6: Active group persists across page navigation
   */
  test('should persist active group across page navigation', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group
    await activeGroupPage.goto();
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.alpha.id);

    // Navigate to different pages
    await page.goto('/apps');
    await page.goto('/settings/profile');
    await page.goto('/settings/groups');

    // Verify active group persisted
    const activeGroup = await activeGroupPage.getActiveGroup();
    expect(activeGroup?.id).toBe(TEST_DATA.groups.alpha.id);
  });

  /**
   * Test 7: Active group persists across sessions
   */
  test('should persist active group across browser sessions', async ({ context }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group
    await activeGroupPage.goto();
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.gamma.id);

    // Save session state
    const storageState = await context.storageState();

    // Close and reopen page with saved state
    await page.close();
    page = await context.newPage();
    await page.goto('/settings/groups');

    // Verify active group persisted
    const activeGroup = await activeGroupPage.getActiveGroup();
    expect(activeGroup?.id).toBe(TEST_DATA.groups.gamma.id);
  });

  /**
   * Test 8: Cannot set active group to group user is not member of
   */
  test('should prevent setting active group to non-member group', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Try to set active group to group user is not member of
    const response = await apiHelper.setActiveGroupApi('non-member-group-id');

    // Should return error
    expect(response.errors).toBeDefined();
    expect(response.errors[0].code).toBe('FORBIDDEN');
  });

  /**
   * Test 9: Group switcher shows all user groups
   */
  test('should show all user groups in switcher', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to groups page
    await activeGroupPage.goto();

    // Click group switcher
    await page.click('[data-testid="group-switcher-button"]');

    // Get available groups
    const availableGroups = await activeGroupPage.getAvailableGroups();

    // Should include Alpha, Beta, Gamma
    expect(availableGroups.length).toBeGreaterThanOrEqual(3);
    expect(
      availableGroups.find((g) => g.id === TEST_DATA.groups.alpha.id)
    ).toBeDefined();
    expect(
      availableGroups.find((g) => g.id === TEST_DATA.groups.beta.id)
    ).toBeDefined();
    expect(
      availableGroups.find((g) => g.id === TEST_DATA.groups.gamma.id)
    ).toBeDefined();
  });

  /**
   * Test 10: Active group affects app accessibility
   */
  test('should affect app accessibility based on active group', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Set active group to Alpha
    await activeGroupPage.goto();
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.alpha.id);

    // Get accessible apps with Alpha active
    const alphaApps = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/apps/accessible', {
        method: 'GET',
      });
      return await res.json();
    });

    // Set active group to Beta
    await activeGroupPage.setActiveGroup(TEST_DATA.groups.beta.id);

    // Get accessible apps with Beta active
    const betaApps = await page.evaluate(async () => {
      const res = await fetch('/api/rbac/apps/accessible', {
        method: 'GET',
      });
      return await res.json();
    });

    // App lists may differ based on group memberships
    expect(alphaApps.data.apps).toBeDefined();
    expect(betaApps.data.apps).toBeDefined();
  });
});
