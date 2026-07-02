/**
 * Full rep/agent lifecycle: receive an RFQ -> review it -> add a shipping
 * cost override -> generate and send a quote -> follow its status through
 * to client acceptance, all via the real UI (RFQDetailPage ->
 * QuoteBuilderPage -> QuotationDetailPage).
 *
 * There is no separate "add shipping details" step anywhere in the UI —
 * confirmed during Phase 5 research: shipping/freight is a single override
 * field ("تكلفة الشحن الفعلية") inside QuoteBuilderPage itself, not a
 * distinct page/step. This spec fills that field explicitly (rather than
 * leaving it on its auto-calculated default) to genuinely exercise the
 * "add shipping" part of the brief, folded into the real flow as it
 * actually exists.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser, API_BASE_URL } from "../helpers/testUsers";
import { loginViaUi } from "../helpers/uiAuth";

test.describe.configure({ mode: "serial" });

test("rep lifecycle: receive RFQ -> review -> add shipping -> send quote -> follow status to acceptance", async ({
  browser, request,
}) => {
  const agent = await createAgentUser(request, { full_name: "Lifecycle Rep" });
  const client = await createClientUser(request);

  const agentContext = await browser.newContext();
  const clientContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  const clientPage = await clientContext.newPage();

  let rfqId = "";
  let quotationId = "";

  await test.step("client creates an RFQ that the rep will receive", async () => {
    await loginViaUi(clientPage, client.email, client.password);
    await clientPage.goto("/rfq/create");
    await clientPage.getByPlaceholder("أحمد محمد").fill("Lifecycle Rep Client");
    await clientPage
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("طلب اختبار دورة حياة المندوب — 200 وحدة إضاءة LED");
    await clientPage.getByPlaceholder("ميناء العقبة، الأردن").fill("Aqaba");
    await clientPage.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await clientPage.waitForURL(/\/rfq\/[^/]+$/);
    rfqId = new URL(clientPage.url()).pathname.split("/").pop()!;

    // RFQDetailPage has no "add product" UI (products normally arrive via
    // OCR) — add one directly via the API, a precondition for pricing, not
    // what this spec is testing.
    const accessToken = await clientPage.evaluate(() => localStorage.getItem("access_token"));
    await request.post(`${API_BASE_URL}/intake/rfqs/${rfqId}/products`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { name: "Industrial LED Floodlight", quantity: "200" },
    });
  });

  await test.step("rep reviews the RFQ in the real detail page", async () => {
    await loginViaUi(agentPage, agent.email, agent.password);
    await agentPage.goto(`/rfq/${rfqId}`);
    await expect(agentPage.getByText("تفاصيل طلب عرض السعر")).toBeVisible();
    await expect(agentPage.getByText("Lifecycle Rep Client")).toBeVisible();
    await expect(agentPage.getByText("Industrial LED Floodlight")).toBeVisible();
  });

  await test.step("rep opens the quote builder and adds a shipping cost override", async () => {
    await agentPage.getByRole("button", { name: "إنشاء وإرسال عرض السعر" }).click();
    await agentPage.waitForURL(/\/rfq\/.+\/build-quote/);

    // Product was added via API (no OCR-extracted unit price), so the
    // manual CNY unit-price field is required to enable pricing.
    const manualPriceInput = agentPage.getByLabel(/سعر الوحدة \(CNY\)/);
    if (await manualPriceInput.isVisible().catch(() => false)) {
      await manualPriceInput.fill("45");
    }
    await expect(agentPage.getByText("الإجمالي الكلي")).toBeVisible({ timeout: 15_000 });

    // The "add shipping" step: override the auto-calculated freight cost.
    await agentPage.getByLabel(/تكلفة الشحن الفعلية/).fill("350");
  });

  await test.step("rep generates and sends the quote to the client", async () => {
    await agentPage.getByRole("button", { name: "إرسال عرض السعر للعميل" }).click();
    await agentPage.waitForURL(/\/quotes\/[^/]+$/, { timeout: 20_000 });
    quotationId = new URL(agentPage.url()).pathname.split("/").pop()!;
    await expect(agentPage.getByText("تم الإرسال")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("rep follows the quote's status before the client responds", async () => {
    await agentPage.goto(`/quotes/${quotationId}`);
    await expect(agentPage.getByText("تم الإرسال")).toBeVisible();
    // Rep is not the client, so the accept/reject panel must not appear here.
    await expect(agentPage.getByRole("button", { name: "قبول عرض السعر" })).toHaveCount(0);
  });

  await test.step("client accepts the quote", async () => {
    await clientPage.goto(`/quotes/${quotationId}`);
    await clientPage.getByRole("button", { name: "قبول عرض السعر" }).click();
    await expect(clientPage.getByText("وافقت على هذا العرض")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("rep sees the quote's status has followed through to acceptance", async () => {
    await agentPage.goto(`/quotes/${quotationId}`);
    await expect(agentPage.getByText("مقبول", { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  await agentContext.close();
  await clientContext.close();
});
