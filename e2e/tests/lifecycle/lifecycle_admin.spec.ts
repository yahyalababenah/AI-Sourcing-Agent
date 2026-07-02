/**
 * Full admin lifecycle: log in via the dedicated admin portal -> monitor
 * system health -> manage users -> verify a supplier -> review AI-cost
 * stats.
 *
 * Two steps in this spec are intentionally verified at the API level rather
 * than via UI navigation, both newly-documented gaps from Phase 5 research:
 *
 * - "manage users": AdminSidebar.tsx's "إدارة المستخدمين" link routes to
 *   the Settings stub (TESTING_FINDINGS.md #4), not a real user-management
 *   page — the capability is backend-only today (#5i). This spec follows
 *   the real sidebar link (confirming it does NOT crash, just shows the
 *   harmless stub) and separately exercises user status management via the
 *   real API the backend already supports.
 * - "AI-cost stats": no frontend page or route exists for
 *   GET /api/v1/admin/ai-costs at all (#5h) — verified directly via
 *   page.request instead of clicking through a nonexistent page.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser, API_BASE_URL } from "../helpers/testUsers";
import { createAdminUserDirectly } from "../helpers/testDb";
import { loginViaAdminUi } from "../helpers/uiAuth";

test.describe.configure({ mode: "serial" });

test("admin lifecycle: login -> monitor health -> manage users -> verify supplier -> review AI-cost stats", async ({
  page, request,
}) => {
  const adminEmail = `e2e-lifecycle-admin-${Date.now()}@example.com`;
  const adminPassword = "AdminPass123!";
  await createAdminUserDirectly(adminEmail, adminPassword, "Lifecycle Admin");

  const pendingSupplier = await createAgentUser(request, { full_name: "Pending Supplier For Verification" });
  const targetClient = await createClientUser(request);

  await test.step("admin logs in through the dedicated admin portal", async () => {
    await loginViaAdminUi(page, adminEmail, adminPassword);
  });

  await test.step("admin monitors real-time system health", async () => {
    await page.goto("/admin/monitor");
    await expect(page.getByText("مراقبة النظام")).toBeVisible();
    await page.getByRole("button", { name: "تحديث الآن" }).click();
    // Real service statuses must be present — database at minimum, since
    // the whole app is running against it.
    await expect(page.getByText("قاعدة البيانات")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("admin manages users — sidebar link lands on the (harmless) Settings stub, real management happens via the API", async () => {
    await page.getByRole("link", { name: "إدارة المستخدمين" }).click();
    await page.waitForURL(/\/settings/);
    await expect(page.getByText("سيتم تنفيذ صفحة الإعدادات في مرحلة لاحقة")).toBeVisible();
    // No console errors/crash from following this link to its real (stub) destination.

    const accessToken = await page.evaluate(() => localStorage.getItem("access_token"));
    const usersResp = await request.get(`${API_BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { role: "client" },
    });
    expect(usersResp.ok()).toBeTruthy();
    const users = (await usersResp.json()).items as Array<{ id: string; email: string; is_active: boolean }>;
    const targetUser = users.find((u) => u.email === targetClient.email);
    expect(targetUser, "the newly created client should be listed").toBeTruthy();

    const deactivateResp = await request.put(`${API_BASE_URL}/admin/users/${targetUser!.id}/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { is_active: false },
    });
    expect(deactivateResp.ok()).toBeTruthy();
    expect((await deactivateResp.json()).is_active).toBe(false);
  });

  await test.step("admin verifies a pending supplier through the real Verification page", async () => {
    await page.goto("/admin/verification");
    await expect(page.getByText("توثيق الموردين")).toBeVisible();
    const supplierCard = page.getByText(pendingSupplier.email);
    await expect(supplierCard).toBeVisible({ timeout: 15_000 });

    const card = page.locator(".card", { has: supplierCard });
    await card.getByRole("button", { name: "توثيق" }).click();

    // Move to the "verified" tab to confirm the status actually changed.
    await page.getByRole("button", { name: "موثَّق" }).click();
    await expect(page.getByText(pendingSupplier.email)).toBeVisible({ timeout: 10_000 });
  });

  await test.step("admin reviews AI-cost stats via the real backend endpoint (no frontend page exists yet, #5h)", async () => {
    const accessToken = await page.evaluate(() => localStorage.getItem("access_token"));
    const resp = await request.get(`${API_BASE_URL}/admin/ai-costs?days=30`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();
    const stats = await resp.json();
    expect(stats).toHaveProperty("total_cost");
    expect(stats).toHaveProperty("total_calls");
    expect(stats).toHaveProperty("by_model");
    expect(stats).toHaveProperty("by_provider");
    expect(stats.period_days).toBe(30);
  });
});
