/**
 * Login flow E2E tests (frontend contract with mocked auth endpoints).
 */

import { expect, test, type Page } from "@playwright/test";

async function mockLockoutCheck(page: Page) {
  await page.route("**/api/auth/check-lockout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isLocked: false,
        remainingAttempts: 5,
        lockoutTimeRemaining: 0,
        maxAttempts: 5,
      }),
    });
  });
}

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockLockoutCheck(page);
    await page.goto("/login");
  });

  test("should display login form", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Agentiful");
    await expect(page.locator("text=Sign in to your account")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.click('button[type="submit"]');

    await expect(page.locator("text=/email is required/i")).toBeVisible();
    await expect(page.locator("text=/password is required/i")).toBeVisible();
  });

  test("should show auth error for invalid credentials", async ({ page }) => {
    await page.route("**/api/auth/sign-in", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            message: "Authentication failed",
          },
        }),
      });
    });

    await page.fill('input[type="email"]', "locked@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=/authentication failed/i")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("should redirect to apps for valid credentials", async ({ page }) => {
    await page.route("**/api/auth/sign-in", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            user: {
              id: "user-test",
              email: "test@example.com",
            },
            tenant: null,
            token: "token-test",
            refreshToken: null,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        }),
      });
    });

    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/apps");
  });
});
