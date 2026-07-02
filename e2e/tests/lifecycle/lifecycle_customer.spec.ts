/**
 * Full customer lifecycle, through the real UI end to end: self-registration
 * (via the actual RegisterPage form — fixed in TESTING_FINDINGS.md F4, so
 * this is now a real, exercisable path rather than an API shortcut) -> browse
 * the marketplace -> request a quote -> receive it -> accept -> track the
 * shipment.
 *
 * A supplier-rating/review-after-order feature does not exist anywhere in
 * the codebase (no model, no route, no UI) — confirmed during Phase 5
 * research. The brief marks that step optional ("إن وُجد"), so it's
 * intentionally omitted here rather than testing something that isn't real.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser } from "../helpers/testUsers";
import { loginViaUi } from "../helpers/uiAuth";
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

test("customer lifecycle: register -> RFQ -> receive quote -> accept -> track", async ({
  browser, request,
}) => {
  const agent = await createAgentUser(request);
  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();

  const customerEmail = `e2e-lifecycle-customer-${Date.now()}@example.com`;
  const customerPassword = "Secure@123";

  let agentUploadRfqId = "";
  let clientRfqId = "";
  let quotationId = "";

  await test.step("supplier prepares a catalogue product for the customer to find later", async () => {
    await loginViaUi(agentPage, agent.email, agent.password);
    await agentPage.goto("/rfq/create");
    await agentPage.getByPlaceholder("أحمد محمد").fill("Lifecycle Customer Co.");
    await agentPage
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("أحتاج 50 مصباح LED صناعي");
    await agentPage.getByPlaceholder("ميناء العقبة، الأردن").fill("Aqaba");
    await agentPage.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await agentPage.waitForURL(/\/rfq\/[^/]+$/);
    agentUploadRfqId = new URL(agentPage.url()).pathname.split("/").pop()!;

    await agentPage.goto("/documents/upload");
    const rfqOption = agentPage.locator("select option", { hasText: "Lifecycle Customer Co." });
    const rfqOptionValue = await rfqOption.getAttribute("value");
    await agentPage.locator("select").selectOption(rfqOptionValue!);
    await agentPage.locator('input[type="file"]').setInputFiles(makeTestCataloguePath());
    await agentPage.getByRole("button", { name: "رفع الملف واستخراج البيانات" }).click();
    await agentPage.waitForURL(/\/documents\/[^/]+$/, { timeout: 60_000 });

    await agentPage.goto("/supplier/review");
    const firstApprove = agentPage.getByRole("button", { name: "قبول" }).first();
    await expect(firstApprove).toBeVisible({ timeout: 30_000 });
    await firstApprove.click();
    await expect(agentPage.getByText("لا توجد منتجات تنتظر المراجعة")).toBeVisible({ timeout: 10_000 });
  });

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();

  await test.step("customer self-registers through the real RegisterPage UI (TESTING_FINDINGS.md F4)", async () => {
    await customerPage.goto("/auth/register");
    await customerPage.getByRole("button", { name: /عميل/ }).click();
    await customerPage.getByLabel("الاسم الكامل").fill("Lifecycle Customer");
    await customerPage.getByLabel("البريد الإلكتروني").fill(customerEmail);
    await customerPage.getByLabel("كلمة المرور").fill(customerPassword);
    await customerPage.getByLabel("تأكيد كلمة المرور").fill(customerPassword);
    await customerPage.getByLabel("اسم الشركة").fill("Lifecycle Customer Trading Co.");
    await customerPage.getByRole("button", { name: "إنشاء حساب" }).click();
    // useAuth.register() navigates to /auth/login, then this page navigates
    // to /dashboard — either destination proves the request truly succeeded.
    await customerPage.waitForURL(/\/(dashboard|auth\/login)/, { timeout: 10_000 });
  });

  await test.step("customer logs in (if not already authenticated) and browses the marketplace", async () => {
    if (!/\/dashboard/.test(customerPage.url())) {
      await loginViaUi(customerPage, customerEmail, customerPassword);
    }
    await customerPage.goto("/marketplace");
    await expect(customerPage.getByText("سوق الموردين")).toBeVisible();
    await expect(customerPage.getByRole("button", { name: "طلب عرض سعر" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("customer requests a quote for a marketplace product", async () => {
    await customerPage.getByRole("button", { name: "طلب عرض سعر" }).first().click();
    await customerPage.getByRole("button", { name: "إرسال طلب عرض السعر" }).click();
    await expect(customerPage.getByText("تم إرسال طلب عرض السعر بنجاح")).toBeVisible({ timeout: 10_000 });

    await customerPage.goto("/rfq");
    const firstRow = customerPage.locator("tbody tr").first();
    await firstRow.click();
    await customerPage.waitForURL(/\/rfq\/[^/]+$/);
    clientRfqId = new URL(customerPage.url()).pathname.split("/").pop()!;
    expect(clientRfqId).not.toBe(agentUploadRfqId);
  });

  await test.step("supplier matches and quotes the customer's RFQ", async () => {
    await agentPage.goto(`/rfq/${clientRfqId}`);
    const matchButton = agentPage.getByRole("button", { name: "تشغيل المطابقة" });
    if (await matchButton.isEnabled().catch(() => false)) {
      await matchButton.click();
      await expect(agentPage.getByText(/تمت المطابقة/)).toBeVisible({ timeout: 15_000 });
    }
    await agentPage.goto(`/rfq/${clientRfqId}/build-quote`);
    await agentPage.getByRole("button", { name: /إرسال عرض السعر للعميل/ }).click();
    await agentPage.waitForURL(/\/quotes\/[^/]+$/, { timeout: 20_000 });
    quotationId = new URL(agentPage.url()).pathname.split("/").pop()!;
  });

  await test.step("customer receives and accepts the quote", async () => {
    await customerPage.goto(`/quotes/${quotationId}`);
    await customerPage.getByRole("button", { name: "قبول عرض السعر" }).click();
    await expect(customerPage.getByText("وافقت على هذا العرض")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("customer tracks the resulting shipment", async () => {
    await customerPage.getByRole("button", { name: /تتبع الشحنة/ }).click();
    await customerPage.waitForURL(/\/orders\/[^/]+\/tracking/);
    await expect(customerPage.getByText("تتبع الطلب")).toBeVisible();
    await expect(customerPage.getByText("بانتظار الدفع")).toBeVisible();
  });

  await agentContext.close();
  await customerContext.close();
});
