/**
 * Login Flow E2E Test
 *
 * Tests the complete login and tenant switching flow
 */

import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("should display login form", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Sign in to your account");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.click('button[type="submit"]');

    await expect(page.locator("text=/email is required/i")).toBeVisible();
  });

  test("should show account lockout after 5 failed attempts", async ({ page }) => {
    const email = "locked@example.com";
    const password = "wrongpassword";

    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');

      if (i < 4) {
        await expect(page.locator("text=/Authentication failed/i")).toBeVisible();
      }
    }

    // 5th attempt should show lockout
    await expect(page.locator("text=/Account is locked/i")).toBeVisible();
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    // TODO: Add test user creation
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard");
  });
});

test.describe("Tenant Switching", () => {
  test("should display tenant selector when user has multiple tenants", async ({ page }) => {
    // TODO: Login with user who has multiple tenants
    await page.goto("/dashboard");

    const tenantSelector = page.locator('[data-testid="tenant-selector"]');
    await expect(tenantSelector).toBeVisible();
  });

  test("should switch tenant context", async ({ page }) => {
    await page.goto("/dashboard");

    const tenantSelector = page.locator('[data-testid="tenant-selector"]');
    await tenantSelector.click();

    // Select different tenant
    await page.click('text=/Second Tenant/');

    // Verify context switched
    await expect(page.locator('[data-testid="current-tenant"]')).toContainText("Second Tenant");
  });
});
