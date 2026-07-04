import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('C:', m.type(), m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
await page.fill('input[type="email"], input[name="email"]', 'sales.rep@aisourcing.demo');
await page.fill('input[type="password"], input[name="password"]', 'Demo@Aqaba2026!');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 10000 }).catch((e)=>console.log('dashboard wait failed', e.message));
console.log('now going to build-quote page');
try {
  await page.goto('http://localhost:5173/rfq/75431159-030d-42ec-8ced-b1275f9bfefa/build-quote', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('navigated OK, url=', page.url());
} catch (e) {
  console.log('goto failed:', e.message);
}
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/claude-1000/-home-yahia-Desktop-Projects-ai-sourcing-hub/52f13648-6cef-472e-9c4b-dc9ace8127a6/scratchpad/shots/debug1.png', fullPage: true });
await browser.close();
