/**
 * Verifies the RFQ exclusive -> public transition end to end against real
 * services: a client submits an RFQ (unassigned, is_public=False by default),
 * confirm it's invisible in an agent's public RFQ pool tab while exclusive,
 * force its exclusive_deadline into the past, trigger the real
 * `expire-stale-matches` Celery Beat task (see TESTING_FINDINGS.md #7 —
 * confirmed to genuinely exist, this isn't test-driving new code), and
 * confirm the RFQ becomes visible in the agent's public pool tab
 * ("السوق العام" in SupplierRfqInbox).
 *
 * Requires docker-compose.test.yml running (for both the app and to exec
 * into celery_worker_test) — not runnable in the sandbox this was written in.
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";
import { setRfqExclusiveDeadlineInPast } from "./helpers/testDb";
import { triggerExpireStaleMatchesTask } from "./helpers/celery";

test("RFQ becomes visible in an agent's public pool tab after its exclusive window expires", async ({
  browser,
}) => {
  const clientContext = await browser.newContext();
  const agentContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  const agentPage = await agentContext.newPage();

  const uniqueClientName = `Exclusivity Test ${Date.now()}`;
  let rfqId = "";

  await test.step("client submits an RFQ (unassigned, exclusive by default)", async () => {
    const client = await createClientUser(clientPage.request);
    await loginViaUi(clientPage, client.email, client.password);
    await clientPage.goto("/rfq/create");
    // ClientRFQCreate schema doesn't take agent-only fields — the create form
    // for a client role should already restrict to the client schema.
    await clientPage.getByPlaceholder("أحمد محمد").fill(uniqueClientName);
    await clientPage
      .getByPlaceholder("اكتب وصف المنتجات المطلوبة بالتفصيل...")
      .fill("طلب اختبار نافذة الحصرية إلى العامة");
    await clientPage.getByRole("button", { name: "إنشاء طلب عرض السعر" }).click();
    await clientPage.waitForURL(/\/rfq\/[^/]+$/);
    rfqId = new URL(clientPage.url()).pathname.split("/").pop()!;
  });

  const agent = await createAgentUser(agentPage.request);
  await loginViaUi(agentPage, agent.email, agent.password);

  await test.step("the RFQ is NOT in the agent's public pool while exclusive", async () => {
    await agentPage.goto("/rfq/supplier-inbox");
    await agentPage.getByRole("button", { name: "السوق العام" }).click();
    await expect(agentPage.getByText(uniqueClientName)).not.toBeVisible();
  });

  await test.step("force the exclusive window into the past and run the real expiry task", async () => {
    await setRfqExclusiveDeadlineInPast(rfqId);
    triggerExpireStaleMatchesTask();
  });

  await test.step("the RFQ now appears in the agent's public pool tab", async () => {
    await agentPage.goto("/rfq/supplier-inbox");
    await agentPage.getByRole("button", { name: "السوق العام" }).click();
    await expect(agentPage.getByText(uniqueClientName)).toBeVisible({ timeout: 15_000 });
  });

  await clientContext.close();
  await agentContext.close();
});
