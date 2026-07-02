/**
 * Chat under a throttled (Slow 3G) connection and a simulated network drop,
 * confirming the SSE stream doesn't crash and reconnects smoothly.
 *
 * ChatRoomDetailPage.tsx's chat stream is NOT the browser's native
 * `EventSource` — it's a manual `fetch()` + `ReadableStream` reader with a
 * hardcoded 3-second reconnect-on-drop (`setTimeout(connect, 3000)`,
 * confirmed directly in the component; see TESTING_FINDINGS.md #6). Network
 * throttling is applied via a raw CDP session (`Network.emulateNetworkConditions`)
 * — the standard way to simulate "Slow 3G" in Chromium/Playwright, using the
 * same profile Lighthouse uses for its Slow 3G preset (400ms RTT, ~500kbps
 * up/down).
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there). Chromium-only (CDP sessions aren't
 * available on firefox/webkit projects).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser, createChatRoom, loginViaApi, getUserId } from "./helpers/testUsers";
import { loginViaUi } from "./helpers/uiAuth";

const SLOW_3G = {
  offline: false,
  latency: 400, // ms round-trip
  downloadThroughput: (500 * 1024) / 8, // ~500kbps
  uploadThroughput: (500 * 1024) / 8,
};

test("chat survives Slow 3G throttling and a simulated connection drop, reconnecting within a few seconds", async ({
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

  const pageErrors: string[] = [];
  supplierPage.on("pageerror", (err) => pageErrors.push(err.message));

  await loginViaUi(clientPage, client.email, client.password);
  await loginViaUi(supplierPage, supplier.email, supplier.password);

  await clientPage.goto(`/chat/${roomId}`);
  await supplierPage.goto(`/chat/${roomId}`);

  // Throttle only the supplier's tab — the client stays at normal speed so
  // its messages act as a reliable "control" signal.
  const cdpSession = await supplierContext.newCDPSession(supplierPage);
  await cdpSession.send("Network.enable");
  await cdpSession.send("Network.emulateNetworkConditions", SLOW_3G);

  await test.step("message still arrives on the throttled tab under Slow 3G, just slower", async () => {
    const message = `رسالة عبر شبكة بطيئة ${Date.now()}`;
    await clientPage.getByPlaceholder("اكتب رسالتك هنا...").fill(message);
    const clientButtons = await clientPage.getByRole("button").all();
    await clientButtons[clientButtons.length - 1].click();

    // Generous timeout — Slow 3G adds real latency, not a crash.
    await expect(supplierPage.getByText(message)).toBeVisible({ timeout: 15_000 });
  });

  await test.step("a full connection drop is followed by automatic reconnection within ~3-6 seconds", async () => {
    // Simulate the connection dropping entirely (offline), forcing the
    // fetch-based stream to fail and hit its reconnect branch.
    await cdpSession.send("Network.emulateNetworkConditions", { ...SLOW_3G, offline: true });
    await supplierPage.waitForTimeout(1_500);
    // Restore connectivity (still throttled, not pristine) — the component's
    // own 3s reconnect timer should pick the stream back up without any
    // page reload or user action.
    await cdpSession.send("Network.emulateNetworkConditions", SLOW_3G);

    const message = `رسالة بعد إعادة الاتصال ${Date.now()}`;
    await clientPage.getByPlaceholder("اكتب رسالتك هنا...").fill(message);
    const clientButtons = await clientPage.getByRole("button").all();
    await clientButtons[clientButtons.length - 1].click();

    await expect(supplierPage.getByText(message)).toBeVisible({ timeout: 15_000 });
  });

  await test.step("no uncaught page errors were thrown by the throttling/drop cycle", async () => {
    expect(pageErrors).toEqual([]);
  });

  await cdpSession.detach().catch(() => {});
  await clientContext.close();
  await supplierContext.close();
});
