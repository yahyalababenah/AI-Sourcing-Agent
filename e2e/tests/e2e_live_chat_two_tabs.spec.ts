/**
 * Live two-tab chat: two separate browser contexts (client + supplier,
 * mirroring two browser tabs/devices), each with their own SSE connection
 * to ChatRoomDetailPage's inline useRoomSSE hook (fetch + ReadableStream,
 * not EventSource — TESTING_FINDINGS.md finding #6). A message sent from
 * one tab must appear in the other within a couple of seconds with no
 * manual refresh or polling.
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser, createChatRoom, loginViaApi, getUserId } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";

test("a message sent in one tab appears live in the other tab within seconds, no refresh", async ({
  browser, request,
}) => {
  const client = await createClientUser(request);
  const supplier = await createAgentUser(request);

  const clientTokens = await loginViaApi(request, client.email, client.password);
  const supplierId = await getUserId(request, (await loginViaApi(request, supplier.email, supplier.password)).access_token);
  const roomId = await createChatRoom(request, clientTokens.access_token, supplierId);

  const clientContext = await browser.newContext();
  const supplierContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  const supplierPage = await supplierContext.newPage();

  await loginViaUi(clientPage, client.email, client.password);
  await loginViaUi(supplierPage, supplier.email, supplier.password);

  // Both tabs open the same room and establish their SSE connections before
  // either sends anything.
  await clientPage.goto(`/chat/${roomId}`);
  await supplierPage.goto(`/chat/${roomId}`);

  const clientMessage = `رسالة من العميل ${Date.now()}`;
  const supplierMessage = `رد من المورد ${Date.now()}`;

  await test.step("client sends a message, supplier's open tab receives it live", async () => {
    const start = Date.now();
    await clientPage.getByPlaceholder("اكتب رسالتك هنا...").fill(clientMessage);
    // Send button is icon-only (no accessible name) — it's the last button in the DOM.
    const clientButtons = await clientPage.getByRole("button").all();
    await clientButtons[clientButtons.length - 1].click();

    await expect(supplierPage.getByText(clientMessage)).toBeVisible({ timeout: 5_000 });
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(5_000); // "within a couple of seconds", per the brief
  });

  await test.step("supplier replies, client's open tab receives it live without reloading", async () => {
    await supplierPage.getByPlaceholder("اكتب رسالتك هنا...").fill(supplierMessage);
    const supplierButtons = await supplierPage.getByRole("button").all();
    await supplierButtons[supplierButtons.length - 1].click();

    await expect(clientPage.getByText(supplierMessage)).toBeVisible({ timeout: 5_000 });
  });

  await clientContext.close();
  await supplierContext.close();
});
