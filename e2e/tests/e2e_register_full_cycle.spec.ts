/**
 * Real self-registration through RegisterPage.tsx's UI, for both
 * self-registerable roles (client, agent) — regression coverage for
 * TESTING_FINDINGS.md #0d (the form was previously missing company_name /
 * factory_name / location_in_china, so registration always failed for real
 * users) and #0e (role is no longer freely choosable — only client/agent
 * are offered, admin isn't in the UI at all).
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there); verified for syntax only
 * (npx tsc --noEmit / npx playwright test --list), same as the rest of
 * Phase 4.
 */
import { test, expect } from "@playwright/test";

test.describe("real self-registration succeeds for both roles", () => {
  test("client tab: fills company_name, submits, and lands authenticated", async ({ page }) => {
    const email = `e2e-register-client-${Date.now()}@example.com`;

    await page.goto("/auth/register");
    await page.getByRole("button", { name: /عميل/ }).click();

    await page.getByLabel("الاسم الكامل").fill("E2E Client");
    await page.getByLabel("البريد الإلكتروني").fill(email);
    await page.getByLabel("كلمة المرور").fill("Secure@123");
    await page.getByLabel("تأكيد كلمة المرور").fill("Secure@123");
    await page.getByLabel("اسم الشركة").fill("E2E Trading Co.");

    await page.getByRole("button", { name: "إنشاء حساب" }).click();

    // useAuth.register() navigates to /auth/login on success, then this
    // page's own handleSubmit navigates to /dashboard — either destination
    // proves the request actually succeeded (no error toast/blocked submit).
    await page.waitForURL(/\/(dashboard|auth\/login)/, { timeout: 10_000 });
    await expect(page.getByText("فشل إنشاء الحساب")).not.toBeVisible();

    const login = await page.request.post("/api/v1/auth/login", {
      data: { email, password: "Secure@123" },
    });
    expect(login.ok()).toBeTruthy();
    expect((await login.json()).access_token).toBeTruthy();
  });

  test("agent tab: fills factory_name and location_in_china, submits, and lands authenticated", async ({
    page,
  }) => {
    const email = `e2e-register-agent-${Date.now()}@example.com`;

    await page.goto("/auth/register");
    // Agent is the default active tab.

    await page.getByLabel("الاسم الكامل").fill("E2E Agent");
    await page.getByLabel("البريد الإلكتروني").fill(email);
    await page.getByLabel("كلمة المرور").fill("Secure@123");
    await page.getByLabel("تأكيد كلمة المرور").fill("Secure@123");
    await page.getByLabel("اسم المصنع").fill("E2E Factory Ltd");
    await page.getByLabel("موقع المصنع في الصين").fill("Shenzhen, Guangdong");

    await page.getByRole("button", { name: "إنشاء حساب" }).click();

    await page.waitForURL(/\/(dashboard|auth\/login)/, { timeout: 10_000 });
    await expect(page.getByText("فشل إنشاء الحساب")).not.toBeVisible();

    const login = await page.request.post("/api/v1/auth/login", {
      data: { email, password: "Secure@123" },
    });
    expect(login.ok()).toBeTruthy();
    expect((await login.json()).access_token).toBeTruthy();
  });
});
