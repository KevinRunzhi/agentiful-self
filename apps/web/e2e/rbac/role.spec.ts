/**
 * E2E Test: Role Assignment and Permission Check Workflow
 *
 * T134 Add E2E test for role assignment and permission check workflow
 *
 * Tests:
 * - Admin can assign roles to users
 * - Assigned roles grant expected permissions
 * - Permission checks work correctly via API
 * - Role assignment is audited
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_DATA = {
  admin: {
    email: 'admin-role-test@example.com',
    password: 'TestPassword123!',
    name: 'Role Test Admin',
  },
  user: {
    email: 'user-role-test@example.com',
    password: 'TestPassword123!',
    name: 'Role Test User',
  },
  tenant: {
    name: 'Role Test Tenant',
    slug: 'role-test-tenant',
  },
};

// =============================================================================
// Page Objects
// =============================================================================

class RoleManagementPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/roles');
  }

  async assignRoleToUser(userId: string, roleId: number) {
    await this.page.click(`[data-testid="assign-role-button-${userId}"]`);
    await this.page.selectOption(`[data-testid="role-select"]`, roleId.toString());
    await this.page.click('[data-testid="confirm-assign-role"]');
  }

  async removeRoleFromUser(userId: string, roleId: number) {
    await this.page.click(`[data-testid="remove-role-${userId}-${roleId}"]`);
    await this.page.click('[data-testid="confirm-remove-role"]');
  }

  async getUserRoles(userId: string) {
    const rolesElement = await this.page.$(`[data-testid="user-roles-${userId}"]`);
    return await rolesElement?.textContent();
  }

  async verifyPermissionCheck(resourceType: string, action: string) {
    const response = await this.page.evaluate(
      async ({ resourceType, action }) => {
        const res = await fetch('/api/rbac/permissions/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceType,
            action,
            resourceId: 'test-resource-id',
          }),
        });
        return await res.json();
      },
      { resourceType, action }
    );
    return response;
  }
}

// =============================================================================
// E2E Tests
// =============================================================================

test.describe('T134 E2E: Role Assignment and Permission Check', () => {
  let page: Page;
  let rolePage: RoleManagementPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    rolePage = new RoleManagementPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  /**
   * Test 1: Admin can assign tenant_admin role to user
   */
  test('should allow admin to assign tenant_admin role to user', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to role management
    await rolePage.goto();

    // Assign role to user
    await rolePage.assignRoleToUser('user-role-test@example.com', 2); // tenant_admin

    // Verify role assigned
    await expect(page.locator('[data-testid="role-assign-success"]')).toBeVisible();
  });

  /**
   * Test 2: User with tenant_admin role has tenant:manage permission
   */
  test('should grant tenant:manage permission to tenant_admin role', async () => {
    // Login as user with tenant_admin role
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Check permission
    const result = await rolePage.verifyPermissionCheck('tenant', 'manage');

    expect(result.data.allowed).toBe(true);
    expect(result.data.reason).toBe('role_permission');
  });

  /**
   * Test 3: User with user role has app:use permission only
   */
  test('should grant app:use permission to user role', async () => {
    // Login as regular user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.user.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.user.password);
    await page.click('[data-testid="login-button"]');

    // Check app:use permission
    const appUseResult = await rolePage.verifyPermissionCheck('app', 'use');
    expect(appUseResult.data.allowed).toBe(true);

    // Check tenant:manage permission (should be denied)
    const tenantManageResult = await rolePage.verifyPermissionCheck(
      'tenant',
      'manage'
    );
    expect(tenantManageResult.data.allowed).toBe(false);
  });

  /**
   * Test 4: Role assignment creates audit event
   */
  test('should create audit event when role is assigned', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Assign role
    await rolePage.goto();
    await rolePage.assignRoleToUser('user-role-test@example.com', 2);

    // Navigate to audit log
    await page.goto('/settings/audit');

    // Verify audit event exists
    await expect(
      page.locator('[data-testid="audit-event-role.assigned"]')
    ).toBeVisible();
  });

  /**
   * Test 5: Admin cannot delete system roles
   */
  test('should prevent deletion of system roles', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to roles page
    await rolePage.goto();

    // Try to delete system role
    await page.click('[data-testid="delete-role-1"]'); // root_admin

    // Should show error
    await expect(
      page.locator('[data-testid="error-system-role-not-deletable"]')
    ).toBeVisible();
  });

  /**
   * Test 6: Cannot remove last tenant admin
   */
  test('should prevent removal of last tenant admin', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to role management
    await rolePage.goto();

    // Try to remove last tenant admin role
    await rolePage.removeRoleFromUser('admin-role-test@example.com', 2);

    // Should show error
    await expect(
      page.locator('[data-testid="error-last-admin-not-removable"]')
    ).toBeVisible();
  });

  /**
   * Test 7: List all roles
   */
  test('should list all available roles', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to roles page
    await rolePage.goto();

    // Verify all roles are listed
    await expect(page.locator('[data-testid="role-root_admin"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="role-tenant_admin"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="role-user"]')).toBeVisible();
  });

  /**
   * Test 8: Get role details with permissions
   */
  test('should show role details with associated permissions', async () => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', TEST_DATA.admin.email);
    await page.fill('[data-testid="password-input"]', TEST_DATA.admin.password);
    await page.click('[data-testid="login-button"]');

    // Navigate to role details
    await page.goto('/settings/roles/2'); // tenant_admin

    // Verify role details
    await expect(
      page.locator('[data-testid="role-name-tenant_admin"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="permission-tenant:manage"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="permission-app:use"]')
    ).toBeVisible();
  });
});
