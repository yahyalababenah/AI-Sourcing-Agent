/**
 * Client-side UI behavior when an RFQ's matching run finds zero suppliers.
 *
 * TESTING_FINDINGS.md #5g (discovered while writing this spec): there is no
 * dedicated "no match found" message anywhere in the UI.
 * `RFQDetailPage.tsx`'s match-result success alert only renders when
 * `matchResult.count > 0` — on a genuine zero-match result, nothing appears
 * beyond the pre-existing "لا يوجد" (none) text already shown by the
 * "Matched Suppliers" card whether or not matching has ever run. This spec
 * verifies that real (silent) behavior directly, not a message that
 * doesn't exist.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createClientUser } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";
import { forceRfqNoMatchFound } from "./helpers/testDb";

test("client sees no success banner and the pre-existing empty state when a match finds zero suppliers", async ({
  page, request,
}) => {
  const client = await createClientUser(request);
  await loginViaUi(page, client.email, client.password);

  let rfqId = "";

  await test.step("client creates an RFQ", async () => {
    await page.goto("/rfq/create");
    await page.getByPlaceholder("أحمد محمد").fill("No Match Test Client");
    await page
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("منتج نادر جداً لن يطابقه أي مورد في هذا الاختبار");
    await page.getByPlaceholder("ميناء العقبة، الأردن").fill("Aqaba");
    await page.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await page.waitForURL(/\/rfq\/[^/]+$/);
    rfqId = new URL(page.url()).pathname.split("/").pop()!;
  });

  await test.step("client runs matching from the real UI", async () => {
    const matchButton = page.getByRole("button", { name: "تشغيل المطابقة" });
    if (await matchButton.isEnabled().catch(() => false)) {
      await matchButton.click();
      // Whatever the real result is, wait for the mutation to settle before
      // forcing the deterministic zero-match state below.
      await page.waitForTimeout(2_000);
    }
  });

  await test.step("force the deterministic zero-match backend state and reload", async () => {
    await forceRfqNoMatchFound(rfqId);
    await page.reload();
  });

  await test.step("no success banner appears, and the Matched Suppliers card shows its empty state", async () => {
    await expect(page.getByText(/تمت المطابقة — تم العثور على/)).toHaveCount(0);
    await expect(page.getByText("الموردين المطابقين")).toBeVisible();
    await expect(page.getByText("لا يوجد")).toBeVisible();
    // The RFQ should now show as available in the public pool, per the
    // real backend behavior for a zero-match result.
    await expect(page.getByText("متاح للجميع")).toBeVisible();
  });
});
