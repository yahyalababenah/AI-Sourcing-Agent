/**
 * Full supplier lifecycle: register -> add products (catalogue upload) ->
 * human review -> appears in marketplace -> receives an exclusive match ->
 * responds within the deadline (real behavior) -> responds after the
 * deadline (forced expiry).
 *
 * Two real, already-documented gaps shape this spec rather than being
 * worked around silently:
 *
 * - TESTING_FINDINGS.md #5j: there is no "wait for admin verification" UI
 *   gate anywhere — a freshly self-registered, still-`pending` supplier can
 *   upload/get-reviewed/appear-in-marketplace/receive-matches immediately.
 *   This spec runs the whole flow with a still-pending supplier and asserts
 *   nothing blocks it, instead of asserting a wait state that doesn't exist.
 * - TESTING_FINDINGS.md #0: `POST /intake/matches/{id}/claim` crashes
 *   unconditionally (`current_user` bound to `None`). Clicking "قبول
 *   والتسعير" (accept & quote) or "رفض" (decline) on a pending match calls
 *   this exact endpoint with no `onError` handler on the frontend mutation
 *   — so the real, current behavior is a silent failure: the request 500s,
 *   the match's status never leaves "pending", and the UI shows no error at
 *   all. "Scenario 1" below asserts this real (broken) behavior directly,
 *   not the ideal behavior the endpoint should have once #0 is fixed.
 * - Because scenario 1's response never actually succeeds (by construction
 *   of the bug), the SAME match is reused for "scenario 2": its
 *   response_deadline is forced into the past and the real Celery Beat task
 *   is triggered, which is exactly what would happen to a real supplier who
 *   tried to respond and silently failed, same as this test does.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser } from "../helpers/testUsers";
import { loginViaUi } from "../helpers/uiAuth";
import { setMatchResponseDeadlineInPast } from "../helpers/testDb";
import { triggerExpireStaleMatchesTask } from "../helpers/celery";
import path from "path";
import fs from "fs";

test.describe.configure({ mode: "serial" });

function makeTestCataloguePath(): string {
  const dir = test.info().outputDir;
  const filePath = path.join(dir, "catalogue.pdf");
  const minimalPdf =
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, minimalPdf);
  return filePath;
}

test("supplier lifecycle: register (still pending) -> upload -> review -> marketplace -> exclusive match -> respond (broken) -> respond after deadline", async ({
  browser, request,
}) => {
  const supplier = await createAgentUser(request, { full_name: "Lifecycle Supplier" });
  const client = await createClientUser(request);

  const supplierContext = await browser.newContext();
  const clientContext = await browser.newContext();
  const supplierPage = await supplierContext.newPage();
  const clientPage = await clientContext.newPage();

  let uploadRfqId = "";
  let clientRfqId = "";

  await test.step("supplier logs in immediately after registering — no verification wait gates anything (#5j)", async () => {
    await loginViaUi(supplierPage, supplier.email, supplier.password);
    // Profile shows "قيد المراجعة" (pending) but nothing here blocks the flow below.
    await supplierPage.goto("/profile");
    await expect(supplierPage.getByText("قيد المراجعة")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("supplier (still pending) uploads a catalogue and it's OCR-processed", async () => {
    await supplierPage.goto("/rfq/create");
    await supplierPage.getByPlaceholder("أحمد محمد").fill("Lifecycle Supplier Upload Co.");
    await supplierPage
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("كشافات إضاءة صناعية LED");
    await supplierPage.getByPlaceholder("ميناء العقبة، الأردن").fill("Aqaba");
    await supplierPage.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await supplierPage.waitForURL(/\/rfq\/[^/]+$/);
    uploadRfqId = new URL(supplierPage.url()).pathname.split("/").pop()!;

    await supplierPage.goto("/documents/upload");
    const rfqOption = supplierPage.locator("select option", { hasText: "Lifecycle Supplier Upload Co." });
    const rfqOptionValue = await rfqOption.getAttribute("value");
    await supplierPage.locator("select").selectOption(rfqOptionValue!);
    await supplierPage.locator('input[type="file"]').setInputFiles(makeTestCataloguePath());
    await supplierPage.getByRole("button", { name: "رفع الملف واستخراج البيانات" }).click();
    await supplierPage.waitForURL(/\/documents\/[^/]+$/, { timeout: 60_000 });
  });

  await test.step("supplier (still pending) reviews/approves their own extracted product — no gate blocks this either", async () => {
    await supplierPage.goto("/supplier/review");
    const firstApprove = supplierPage.getByRole("button", { name: "قبول" }).first();
    await expect(firstApprove).toBeVisible({ timeout: 30_000 });
    await firstApprove.click();
    await expect(supplierPage.getByText("لا توجد منتجات تنتظر المراجعة")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("the approved product appears in the public marketplace", async () => {
    await loginViaUi(clientPage, client.email, client.password);
    await clientPage.goto("/marketplace");
    await expect(clientPage.getByRole("button", { name: "طلب عرض سعر" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("a client requests a quote, creating a fresh unassigned RFQ", async () => {
    await clientPage.getByRole("button", { name: "طلب عرض سعر" }).first().click();
    await clientPage.getByRole("button", { name: "إرسال طلب عرض السعر" }).click();
    await expect(clientPage.getByText("تم إرسال طلب عرض السعر بنجاح")).toBeVisible({ timeout: 10_000 });

    await clientPage.goto("/rfq");
    const firstRow = clientPage.locator("tbody tr").first();
    await firstRow.click();
    await clientPage.waitForURL(/\/rfq\/[^/]+$/);
    clientRfqId = new URL(clientPage.url()).pathname.split("/").pop()!;
    expect(clientRfqId).not.toBe(uploadRfqId);
  });

  let matchId = "";

  await test.step("supplier receives the exclusive match in their inbox", async () => {
    await supplierPage.goto(`/rfq/${clientRfqId}`);
    const matchButton = supplierPage.getByRole("button", { name: "تشغيل المطابقة" });
    if (await matchButton.isEnabled().catch(() => false)) {
      await matchButton.click();
      await expect(supplierPage.getByText(/تمت المطابقة/)).toBeVisible({ timeout: 15_000 });
    }

    await supplierPage.goto("/rfq/supplier-inbox");
    await expect(supplierPage.getByRole("button", { name: "المباريات الحصرية" })).toBeVisible();
    await expect(supplierPage.getByText("قيد الانتظار")).toBeVisible({ timeout: 15_000 });

    const matchesResp = await supplierPage.request.get("/api/v1/intake/rfqs/matched?limit=50");
    const matches = (await matchesResp.json()).items as Array<{ id: string; rfq_id: string }>;
    const match = matches.find((m) => m.rfq_id === clientRfqId);
    expect(match, "the newly created match should be listed in the supplier's inbox").toBeTruthy();
    matchId = match!.id;
  });

  await test.step("scenario 1 — supplier tries to respond within the deadline: real (broken) behavior, not the ideal one", async () => {
    await supplierPage.reload();
    await supplierPage.getByRole("button", { name: "قبول والتسعير" }).first().click();
    // No onError handler exists on this mutation (SupplierRfqInbox.tsx) — the
    // real, current behavior is silence: no error toast, no status change.
    // Wait past the request's round-trip, then confirm the match card is
    // still exactly where it started (still "pending", claim buttons still
    // present) rather than asserting it moved to "responded".
    await supplierPage.waitForTimeout(2_000);
    await expect(supplierPage.getByText("قيد الانتظار").first()).toBeVisible();
    await expect(supplierPage.getByRole("button", { name: "قبول والتسعير" }).first()).toBeVisible();
  });

  await test.step("scenario 2 — after the response deadline passes, the match expires and can no longer be responded to", async () => {
    await setMatchResponseDeadlineInPast(matchId);
    await triggerExpireStaleMatchesTask();

    await supplierPage.goto("/rfq/supplier-inbox");
    await expect(supplierPage.getByText("منتهية").first()).toBeVisible({ timeout: 15_000 });
    await expect(supplierPage.getByText("انتهت المهلة الحصرية")).toBeVisible();
    await expect(supplierPage.getByRole("button", { name: "قبول والتسعير" })).toHaveCount(0);
  });

  await supplierContext.close();
  await clientContext.close();
});
