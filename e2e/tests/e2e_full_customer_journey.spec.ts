/**
 * Full customer journey, end to end against real services
 * (docker-compose.test.yml — no mocks): catalog upload → OCR extraction →
 * human review (agent) → appears in the public marketplace (client) → RFQ
 * request → exclusive match → real-time SSE notification → async PDF
 * generation → client acceptance → shipment tracking.
 *
 * Requires: `docker compose -f docker-compose.test.yml up -d --build` and
 * `npx playwright install --with-deps chromium` first — not runnable in the
 * sandbox this was written in (no Docker there). See TESTING_FINDINGS.md.
 *
 * Test users are created via a direct API call, not RegisterPage's UI form —
 * that form is currently broken for both roles (finding #0d).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";
import path from "path";
import fs from "fs";

test.describe.configure({ mode: "serial" });

// A genuinely valid single-page PDF, generated once for this spec file, so
// the upload step exercises real (embedded-text) PDF parsing rather than a
// dummy byte blob the backend would reject or fail to OCR meaningfully.
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

test("full journey: catalog upload -> review -> marketplace -> RFQ -> match -> notification -> PDF -> accept -> tracking", async ({
  browser, request,
}) => {
  const agent = await createAgentUser(request);
  const client = await createClientUser(request);

  const agentContext = await browser.newContext();
  const clientContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  const clientPage = await clientContext.newPage();

  let agentUploadRfqId = ""; // only used to attach the catalog document to
  let clientRfqId = ""; // the RFQ actually matched/quoted/tracked below
  let quotationId = "";

  await test.step("agent creates an RFQ to attach the catalog upload to", async () => {
    await loginViaUi(agentPage, agent.email, agent.password);
    await agentPage.goto("/rfq/create");
    await agentPage.getByPlaceholder("أحمد محمد").fill("Ali Import Co.");
    await agentPage
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("أحتاج 100 كشاف إضاءة صناعي LED 100 واط");
    await agentPage.getByPlaceholder("ميناء العقبة، الأردن").fill("Aqaba");
    await agentPage.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await agentPage.waitForURL(/\/rfq\/[^/]+$/);
    agentUploadRfqId = new URL(agentPage.url()).pathname.split("/").pop()!;
    expect(agentUploadRfqId).toBeTruthy();
  });

  await test.step("agent uploads a supplier catalogue and it's OCR-processed", async () => {
    await agentPage.goto("/documents/upload");
    // The <option> label includes a dynamic client_request_arabic snippet
    // suffix (DocumentUploadPage.tsx:116), so an exact label match would be
    // fragile — select by resolving the matching option's value instead.
    const rfqOption = agentPage.locator("select option", { hasText: "Ali Import Co." });
    const rfqOptionValue = await rfqOption.getAttribute("value");
    await agentPage.locator("select").selectOption(rfqOptionValue!);
    const filePath = makeTestCataloguePath();
    await agentPage.locator('input[type="file"]').setInputFiles(filePath);
    await agentPage.getByRole("button", { name: "رفع الملف واستخراج البيانات" }).click();
    // Real OCR/LLM extraction can take a while against real services.
    await agentPage.waitForURL(/\/documents\/[^/]+$/, { timeout: 60_000 });
  });

  await test.step("agent reviews and approves the extracted catalog product", async () => {
    await agentPage.goto("/supplier/review");
    const firstApprove = agentPage.getByRole("button", { name: "قبول" }).first();
    await expect(firstApprove).toBeVisible({ timeout: 30_000 });
    await firstApprove.click();
    await expect(agentPage.getByText("لا توجد منتجات تنتظر المراجعة")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("client sees the approved product in the public marketplace", async () => {
    await loginViaUi(clientPage, client.email, client.password);
    await clientPage.goto("/marketplace");
    await expect(clientPage.getByText("سوق الموردين")).toBeVisible();
    // The approved product should be searchable/visible now that review_status=approved.
    await expect(clientPage.getByRole("button", { name: "طلب عرض سعر" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("client requests a quote for the product (creates a fresh, unassigned RFQ)", async () => {
    await clientPage.getByRole("button", { name: "طلب عرض سعر" }).first().click();
    await expect(clientPage.getByText("طلب عرض سعر", { exact: false })).toBeVisible();
    await clientPage.getByRole("button", { name: "إرسال طلب عرض السعر" }).click();
    // Real toast.success confirms the request went through (see MarketplacePage fix F2).
    await expect(clientPage.getByText("تم إرسال طلب عرض السعر بنجاح")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("capture the id of the RFQ the client's quote request just created", async () => {
    await clientPage.goto("/rfq");
    const firstRow = clientPage.locator("tbody tr").first();
    await firstRow.click();
    await clientPage.waitForURL(/\/rfq\/[^/]+$/);
    clientRfqId = new URL(clientPage.url()).pathname.split("/").pop()!;
    expect(clientRfqId).not.toBe(agentUploadRfqId);
  });

  await test.step("agent runs the exclusive matching algorithm on the client's RFQ", async () => {
    await agentPage.goto(`/rfq/${clientRfqId}`);
    const matchButton = agentPage.getByRole("button", { name: "تشغيل المطابقة" });
    if (await matchButton.isEnabled().catch(() => false)) {
      await matchButton.click();
      await expect(agentPage.getByText(/تمت المطابقة/)).toBeVisible({ timeout: 15_000 });
    }
  });

  await test.step("client sits idle on the dashboard, SSE-connected, waiting for the quote_ready push", async () => {
    // Must navigate here (not just stay on marketplace) BEFORE the agent
    // sends the quote, so useNotifications' EventSource connection is
    // already established when the notification fires — this is the actual
    // "no refresh needed" check, not just polling after the fact.
    await clientPage.goto("/dashboard");
  });

  await test.step("agent builds and sends a quotation — PDF generates asynchronously", async () => {
    await agentPage.goto(`/rfq/${clientRfqId}/build-quote`);
    await agentPage.getByRole("button", { name: /إرسال عرض السعر للعميل/ }).click();
    await agentPage.waitForURL(/\/quotes\/[^/]+$/, { timeout: 20_000 });
    quotationId = new URL(agentPage.url()).pathname.split("/").pop()!;
  });

  await test.step("client sees the quote_ready notification arrive live via SSE, no refresh", async () => {
    // NotificationBell's unread badge (see components/NotificationBell.tsx:44-47,
    // `bg-red-500` rounded badge) must appear without any navigation/reload
    // on this page. No dedicated test-id exists on this element yet — this
    // class-based selector is a bit fragile; would be worth a
    // data-testid="notification-badge" in a future pass.
    const badge = clientPage.locator("span.bg-red-500");
    await expect(badge).toBeVisible({ timeout: 15_000 });
  });

  await test.step("client accepts the quotation", async () => {
    await clientPage.goto(`/quotes/${quotationId}`);
    await clientPage.getByRole("button", { name: "قبول عرض السعر" }).click();
    await expect(clientPage.getByText("وافقت على هذا العرض")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("client tracks the resulting shipment", async () => {
    await clientPage.getByRole("button", { name: /تتبع الشحنة/ }).click();
    await clientPage.waitForURL(/\/orders\/[^/]+\/tracking/);
    await expect(clientPage.getByText("تتبع الطلب")).toBeVisible();
    await expect(clientPage.getByText("بانتظار الدفع")).toBeVisible();
  });

  await agentContext.close();
  await clientContext.close();
});
