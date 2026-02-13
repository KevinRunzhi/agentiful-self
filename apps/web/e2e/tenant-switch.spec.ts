/**
 * Tenant Switch E2E Test
 *
 * Tests multi-tenant isolation and switching
 */

import { test, expect } from "@playwright/test";

test.describe("Multi-Tenant Switching", () => {
  test("should isolate data between tenants", async ({ page, context }) => {
    // Login with user who has access to multiple tenants
    await context.addCookies([
      {
        name: "session",
        value: "multi-tenant-session-token",
        url: "http://localhost:3000",
        domain: "localhost",
      },
    ]);

    await page.goto("/dashboard");

    // Verify data is from correct tenant
    const currentTenant = page.locator('[data-testid="current-tenant"]');
    await expect(currentTenant).toContainText("Tenant A");

    // Switch to different tenant
    await page.locator('[data-testid="tenant-selector"]').click();
    await page.click('text=/Tenant B/');

    // Verify data is now from Tenant B
    await expect(currentTenant).toContainText("Tenant B");

    // Verify data from Tenant A is not visible
    await expect(page.locator('text=/Tenant A Data/')).not.toBeVisible();
  });

  test("should not allow access to tenants user is not member of", async ({ page, request }) => {
    // Try to access resources from a tenant the user doesn't have access to
    const response = await request.get("/api/tenants/unknown-tenant/data");

    expect(response.status()).toBe(403);
  });

  test("should maintain tenant context across page navigation", async ({ page }) => {
    // Login and select tenant
    await page.goto("/dashboard");
    await page.locator('[data-testid="tenant-selector"]').click();
    await page.click('text=/Tenant A/');
    await page.waitForURL(/dashboard/);

    // Navigate to different page
    await page.click('text=/Settings/');

    // Verify tenant context is maintained
    await expect(page.locator('[data-testid="current-tenant"]')).toContainText("Tenant A");
  });
});
