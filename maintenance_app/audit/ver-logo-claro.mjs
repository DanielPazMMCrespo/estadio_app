import { chromium, devices } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices['Pixel 5'], colorScheme: 'light' })).newPage();
await p.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await p.waitForSelector('.header-logo--light', { timeout: 10000 });
await p.waitForTimeout(500);
const r = await p.evaluate(() => {
  const vis = (s) => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
  return { claro: vis('.header-logo--light'), escuro: vis('.header-logo--dark') };
});
console.log('tema CLARO -> logo claro visivel:', r.claro, '| logo escuro visivel:', r.escuro);
console.log(r.claro && !r.escuro ? 'PASS' : 'FALHA');
await b.close();
