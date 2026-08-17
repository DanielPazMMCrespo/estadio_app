import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['Pixel 5'] })).newPage();
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForSelector('.bottom-nav', { timeout: 10000 });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const w = document.querySelector('.bottom-nav-wrapper');
  const cs = w ? getComputedStyle(w) : null;
  const b = w ? w.getBoundingClientRect() : null;
  const app = document.querySelector('.app-container');
  const main = document.getElementById('main-content');
  return {
    viewportH: window.innerHeight,
    scrollH: document.documentElement.scrollHeight,
    wrapper: cs ? { position: cs.position, bottom: cs.bottom, zIndex: cs.zIndex } : null,
    wrapperRect: b ? { top: Math.round(b.top), bottom: Math.round(b.bottom) } : null,
    encostadaAoFundo: b ? Math.abs(b.bottom - window.innerHeight) < 3 : false,
    appOverflow: app ? getComputedStyle(app).overflow : null,
    mainPadBottom: main ? getComputedStyle(main).paddingBottom : null
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'audit/barra-viewport.png' });  // SEM fullPage
console.log('captura (so o visivel) em audit/barra-viewport.png');
await browser.close();
