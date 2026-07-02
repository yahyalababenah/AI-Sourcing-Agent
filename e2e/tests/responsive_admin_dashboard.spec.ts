/**
 * Responsive layout check for the admin dashboard at mobile and tablet
 * viewports. `AdminLayout.tsx` hides the desktop `AdminSidebar` below the
 * `lg` (1024px) breakpoint and shows `MobileTabBar` instead (`lg:hidden`
 * on the tab bar itself) — both mobile (375x812) and tablet (768x1024)
 * viewports fall under that breakpoint, so both are expected to show the
 * same mobile tab-bar layout, not a separate tablet-specific one (there
 * isn't one — confirmed directly in the component source, not assumed).
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect, devices } from "@playwright/test";
import { createAdminUserDirectly } from "./helpers/testDb";
import { loginViaAdminUi } from "./helpers/uiAuth";

const VIEWPORTS = [
  { name: "mobile", ...devices["iPhone 13"].viewport },
  { name: "tablet", ...devices["iPad Mini"].viewport },
];

for (const viewport of VIEWPORTS) {
  test(`admin dashboard on ${viewport.name} viewport (${viewport.width}x${viewport.height}): sidebar hidden, mobile tab bar usable`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();

    const email = `e2e-responsive-admin-${Date.now()}-${viewport.name}@example.com`;
    const password = "AdminPass123!";
    await createAdminUserDirectly(email, password, "Responsive Test Admin");

    await loginViaAdminUi(page, email, password);

    // Desktop-only sidebar must not be visible at this width.
    await expect(page.locator("aside, nav").getByText("مراقبة النظام")).not.toBeVisible();

    // Mobile tab bar must be visible and navigate correctly.
    const monitorTab = page.getByRole("link", { name: "المراقبة" });
    await expect(monitorTab).toBeVisible();
    await monitorTab.click();
    await page.waitForURL(/\/admin\/monitor/);
    await expect(page.getByText("مراقبة النظام")).toBeVisible();

    // Page content must not overflow horizontally at this width (a common
    // responsive-layout regression).
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 1); // +1px rounding tolerance

    await context.close();
  });
}
