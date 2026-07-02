/**
 * Accessibility scan (axe-core) across the app's main pages, with a
 * dedicated check for Arabic screen-reader/RTL setup (index.html declares
 * `lang="ar" dir="rtl"` at the document root — verified directly here,
 * since axe-core itself has no Arabic/RTL-specific rule set; its standard
 * ruleset (labels, color contrast, ARIA correctness) is what actually
 * verifies screen-reader compatibility, RTL or not).
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createAgentUser, createClientUser } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";

async function assertRtlArabicDocument(page: Page) {
  const dir = await page.locator("html").getAttribute("dir");
  const lang = await page.locator("html").getAttribute("lang");
  expect(dir).toBe("rtl");
  expect(lang).toBe("ar");
}

async function scanPage(page: Page, path: string) {
  await page.goto(path);
  await assertRtlArabicDocument(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe("accessibility — public pages", () => {
  test("login page has no WCAG 2 A/AA violations and is RTL/Arabic", async ({ page }) => {
    await scanPage(page, "/auth/login");
  });

  test("register page has no WCAG 2 A/AA violations and is RTL/Arabic", async ({ page }) => {
    await scanPage(page, "/auth/register");
  });

  test("admin login page has no WCAG 2 A/AA violations and is RTL/Arabic", async ({ page }) => {
    await scanPage(page, "/admin/login");
  });
});

test.describe("accessibility — authenticated client pages", () => {
  test("dashboard, marketplace, and RFQ pages have no WCAG 2 A/AA violations", async ({ page, request }) => {
    const client = await createClientUser(request);
    await loginViaUi(page, client.email, client.password);

    await scanPage(page, "/dashboard");
    await scanPage(page, "/marketplace");
    await scanPage(page, "/rfq");
    await scanPage(page, "/rfq/create");
    await scanPage(page, "/settings");
  });
});

test.describe("accessibility — authenticated agent pages", () => {
  test("RFQ inbox and pricing calculator have no WCAG 2 A/AA violations", async ({ page, request }) => {
    const agent = await createAgentUser(request);
    await loginViaUi(page, agent.email, agent.password);

    await scanPage(page, "/rfq/supplier-inbox");
    await scanPage(page, "/pricing/calculate");
    await scanPage(page, "/chat");
  });
});
