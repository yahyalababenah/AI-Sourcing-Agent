/**
 * From the pricing calculator to a built quotation to an actual PDF
 * download, verifying its real content (quote number, grand total) —
 * against real services (WeasyPrint rendering, real MinIO upload/presigned
 * URL), not a mocked download.
 *
 * PDF generation is asynchronous (Celery task `generate-quotation-pdf`, see
 * app/modules/output/tasks.py) — clicking "تحميل PDF" both triggers
 * generation (POST) and immediately opens the redirect URL (GET) in the
 * same click handler, so the first GET may arrive before the worker has
 * finished. This spec retries the popup briefly rather than assuming a
 * single click is always enough — a defensive pattern for the real async
 * timing, not evidence either way of a bug.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { PDFParse } from "pdf-parse";
import { createAgentUser, API_BASE_URL } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";

test("pricing calculator -> quotation -> real PDF download with correct content", async ({
  page, request,
}) => {
  const agent = await createAgentUser(request);
  await loginViaUi(page, agent.email, agent.password);

  let rfqId = "";

  await test.step("create an RFQ with a product to price", async () => {
    await page.goto("/rfq/create");
    await page.getByPlaceholder("أحمد محمد").fill("PDF Download Test Client");
    await page
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("طلب اختبار تحميل PDF");
    await page.getByPlaceholder("ميناء العقبة، الأردن").fill("Aqaba");
    await page.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await page.waitForURL(/\/rfq\/[^/]+$/);
    rfqId = new URL(page.url()).pathname.split("/").pop()!;

    // RFQDetailPage has no "add product" UI (products normally arrive via
    // document/OCR extraction, not manual entry) — the backend endpoint is
    // used directly here, since a product is a precondition for the pricing
    // calculator to show anything, not what this spec is testing.
    const accessToken = await page.evaluate(() => localStorage.getItem("access_token"));
    await request.post(`${API_BASE_URL}/intake/rfqs/${rfqId}/products`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { name: "Industrial LED Floodlight", quantity: "100" },
    });
  });

  let quotationId = "";
  let expectedGrandTotal = "";

  await test.step("use the pricing calculator to compute a quote and create it", async () => {
    await page.goto(`/pricing/calculate?rfq_id=${rfqId}`);
    await page.waitForSelector(`option[value="${rfqId}"]`, { timeout: 10_000 });

    const priceInputs = page.locator('input[type="number"][step="0.01"]');
    if (await priceInputs.count() > 0) {
      await priceInputs.first().fill("50");
    }

    await page.getByRole("button", { name: /حساب التسعير/ }).click();
    await expect(page.getByText("الإجمالي النهائي")).toBeVisible({ timeout: 15_000 });

    const grandTotalEl = page.locator("text=الإجمالي النهائي").locator("..").locator("p").nth(1);
    expectedGrandTotal = ((await grandTotalEl.textContent()) || "").trim();

    await page.getByRole("button", { name: /إنشاء عرض سعر/ }).click();
    await page.waitForURL(/\/quotes\/[^/]+$/, { timeout: 15_000 });
    quotationId = new URL(page.url()).pathname.split("/").pop()!;
  });

  let quotationNumber = "";

  await test.step("capture the quotation number shown in the UI", async () => {
    const heading = page.locator("text=/Q-\\d{8}-[A-Z0-9]{4}/").first();
    quotationNumber = ((await heading.textContent()) || "").trim();
    expect(quotationNumber).toMatch(/Q-\d{8}-[A-Z0-9]{4}/);
  });

  await test.step("download the real PDF and verify its content", async () => {
    let pdfBuffer: Buffer | null = null;

    for (let attempt = 0; attempt < 6 && !pdfBuffer; attempt++) {
      if (attempt > 0) await page.waitForTimeout(2_000); // let the Celery task finish

      const [popup] = await Promise.all([
        page.waitForEvent("popup", { timeout: 5_000 }).catch(() => null),
        page.getByRole("button", { name: "تحميل PDF" }).click(),
      ]);
      if (!popup) continue;

      const response = await popup.waitForEvent("response", { timeout: 5_000 }).catch(() => null);
      if (response && response.headers()["content-type"]?.includes("pdf")) {
        pdfBuffer = await response.body();
      }
      await popup.close().catch(() => {});
    }

    expect(pdfBuffer, "PDF should have downloaded within a few retries").not.toBeNull();
    expect(pdfBuffer!.subarray(0, 4).toString()).toBe("%PDF");

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer!) });
    const parsed = await parser.getText();
    expect(parsed.text).toContain(quotationNumber);
    // Grand total should appear somewhere in the rendered PDF (formatting
    // may differ slightly, so just check the numeric portion is present).
    const numericTotal = expectedGrandTotal.replace(/[^\d.]/g, "");
    if (numericTotal) {
      expect(parsed.text.replace(/[,\s]/g, "")).toContain(numericTotal);
    }
  });
});
