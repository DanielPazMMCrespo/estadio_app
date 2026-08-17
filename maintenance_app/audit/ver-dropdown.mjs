import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForSelector('#qc-description', { timeout: 10000 });

await page.fill('#qc-description', 'Projetor fundido na torre norte');
await page.click('#qc-loc-search');
await page.fill('#qc-loc-search', 'Um local que nao existe XPTO');
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const dd = document.getElementById('qc-loc-dropdown');
  const btn = document.getElementById('btn-save-capture');
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), display: getComputedStyle(el).display }; };
  const ddr = dd ? dd.getBoundingClientRect() : null;
  const btr = btn ? btn.getBoundingClientRect() : null;
  let overlap = false;
  if (ddr && btr && getComputedStyle(dd).display !== 'none') {
    overlap = !(ddr.bottom < btr.top || ddr.top > btr.bottom);
  }
  // Quem esta realmente no ponto central do botao?
  let hit = null;
  if (btr) {
    const el = document.elementFromPoint(btr.left + btr.width / 2, btr.top + btr.height / 2);
    hit = el ? (el.id || el.className || el.tagName) : null;
  }
  return { dropdown: r(dd), botao: r(btr ? btn : null), overlap, elementoNoPontoDoBotao: hit };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'audit/dropdown-tapa-botao.png', fullPage: false });
console.log('captura em audit/dropdown-tapa-botao.png');
await browser.close();
