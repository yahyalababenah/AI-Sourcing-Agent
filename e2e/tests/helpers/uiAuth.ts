import type { Page } from "@playwright/test";

/** Logs in through the real LoginPage UI (role tabs are cosmetic — they just
 * prefill the email field, which we override with the actual test user). */
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  const emailInput = page.locator('input[type="email"]');
  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

/** Logs in through the dedicated AdminLoginPage UI (/admin/login) rather
 * than the generic LoginPage — the real, distinct admin-portal entry point. */
export async function loginViaAdminUi(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.locator("#admin-email").fill(email);
  await page.locator("#admin-password").fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}
