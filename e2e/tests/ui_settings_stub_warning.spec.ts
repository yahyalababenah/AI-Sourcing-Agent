/**
 * Confirms the Settings page stub (TESTING_FINDINGS.md #4) renders as an
 * honest "coming soon" placeholder — not a blank white screen, a console
 * error, or a broken route — even though it has zero real functionality.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createClientUser } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";

test("Settings page shows an honest placeholder, not a blank screen or console error", async ({
  page, request,
}) => {
  const client = await createClientUser(request);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await loginViaUi(page, client.email, client.password);
  await page.goto("/settings");

  // Both an <h1> and an <h3> read "الإعدادات" (page title + stub-card
  // heading) — .first() avoids a strict-mode multiple-match error.
  await expect(page.getByRole("heading", { name: "الإعدادات" }).first()).toBeVisible();
  await expect(page.getByText("سيتم تنفيذ صفحة الإعدادات في مرحلة لاحقة")).toBeVisible();

  // Not a blank screen: real visible content exists in the page body.
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.trim().length).toBeGreaterThan(20);

  // No real form controls exist yet (it's genuinely a stub) — this should
  // start failing the moment someone builds the real page, forcing a
  // conscious test update rather than silently going stale.
  await expect(page.locator("input, textarea, select")).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
