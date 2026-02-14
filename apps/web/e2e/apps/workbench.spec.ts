import { expect, test, type Page } from "@playwright/test";

const ALL_APPS = [
  {
    id: "app-sales",
    name: "Sales Copilot",
    description: "CRM helper",
    mode: "chat",
    icon: null,
    tags: ["sales", "crm"],
    isFavorite: true,
    lastUsedAt: "2026-02-14T09:00:00.000Z",
    availableGroups: [{ groupId: "grp-1", groupName: "Group 1", hasAccess: true }],
    requiresSwitch: false,
  },
  {
    id: "app-agent",
    name: "Ops Agent",
    description: "Operations automation",
    mode: "agent",
    icon: null,
    tags: ["ops"],
    isFavorite: false,
    lastUsedAt: null,
    availableGroups: [{ groupId: "grp-1", groupName: "Group 1", hasAccess: true }],
    requiresSwitch: false,
  },
];

async function mockAccessibleApps(page: Page) {
  await page.route("**/api/rbac/apps/accessible**", async (route) => {
    const url = new URL(route.request().url());
    const view = url.searchParams.get("view") ?? "all";

    let items = ALL_APPS;
    if (view === "favorites") {
      items = ALL_APPS.filter((app) => app.isFavorite);
    } else if (view === "recent") {
      items = ALL_APPS.filter((app) => Boolean(app.lastUsedAt));
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items,
          nextCursor: null,
        },
        meta: {
          traceId: "trace-e2e",
        },
      }),
    });
  });
}

test.describe("T022/T043 apps workbench", () => {
  test.beforeEach(async ({ page }) => {
    await mockAccessibleApps(page);
    await page.route("**/api/rbac/apps/*/favorite", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**/api/rbac/apps/*/recent-use", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
  });

  test("shows authorized apps and view tabs", async ({ page }) => {
    await page.goto("/apps");

    await expect(page.getByRole("heading", { name: "Apps" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Recent" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Favorites" })).toBeVisible();

    await expect(page.locator('[data-testid^="app-card-"]')).toHaveCount(2);

    await page.getByRole("tab", { name: "Favorites" }).click();
    await expect(page.locator('[data-testid^="app-card-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="app-card-app-sales"]')).toBeVisible();

    await page.getByRole("tab", { name: "Recent" }).click();
    await expect(page.locator('[data-testid^="app-card-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="app-card-app-sales"]')).toBeVisible();
  });

  test("shows degraded banner and disables new conversation after quota denial", async ({ page }) => {
    await page.unroute("**/api/rbac/apps/*/recent-use");
    await page.route("**/api/rbac/apps/*/recent-use", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "quota_guard_degraded_deny_new",
            message: "Quota service degraded",
          },
        }),
      });
    });

    await page.goto("/apps");
    await page.click('[data-testid="direct-access-app-sales"]');

    await expect(
      page.getByText(
        "Quota service is degraded. App browsing remains available, but new conversations are disabled."
      )
    ).toBeVisible();

    await expect(page.locator('[data-testid="direct-access-app-sales"]')).toBeDisabled();
    await expect(page.locator('[data-testid="direct-access-app-agent"]')).toBeDisabled();
  });
});
