import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });

for (const url of [
  'http://localhost:4173/?demo=1',
  'http://localhost:4173/v/nosuchtransaction?demo=1',
]) {
  failures.length = 0;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  console.log(`${url}\n  ${failures.length ? failures.join('\n  ') : 'no failing requests'}`);
}
await browser.close();
