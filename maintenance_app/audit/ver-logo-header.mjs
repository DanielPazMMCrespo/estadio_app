import { chromium, devices } from '@playwright/test';
const b = await chromium.launch();
for (const tema of ['light', 'dark']) {
  const p = await (await b.newContext({ ...devices['Pixel 5'], colorScheme: tema })).newPage();
  await p.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await p.waitForSelector('.app-header', { timeout: 10000 });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); const bb = e.getBoundingClientRect(); return { visivel: cs.display !== 'none' && bb.width > 0, w: Math.round(bb.width), h: Math.round(bb.height), carregou: e.complete && e.naturalWidth > 0, src: e.src.split('/').pop() }; };
    const badge = document.querySelector('.status-badge');
    const bb = badge ? badge.getBoundingClientRect() : null;
    const logo = document.querySelector('.header-logo--light, .header-logo--dark');
    const lb = logo ? logo.getBoundingClientRect() : null;
    return { claro: vis('.header-logo--light'), escuro: vis('.header-logo--dark'),
      sobrepoe: (lb && bb) ? !(lb.right < bb.left || lb.left > bb.right) : null,
      larguraEcra: window.innerWidth };
  });
  const ativo = tema === 'dark' ? r.escuro : r.claro;
  console.log(`\n[${tema}] logo ativo: ${ativo.src}  ${ativo.w}x${ativo.h}px  carregou=${ativo.carregou}`);
  console.log(`  ratio no ecra: ${(ativo.w/ativo.h).toFixed(2)}  |  sobrepoe o estado: ${r.sobrepoe}  |  ecra: ${r.larguraEcra}px`);
  console.log(`  ${ativo.carregou && ativo.visivel && !r.sobrepoe && ativo.w > 80 ? 'PASS' : 'FALHA'}`);
  await p.screenshot({ path: `audit/header-${tema}.png`, clip: { x: 0, y: 0, width: 393, height: 70 } });
}
await b.close();
