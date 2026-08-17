import { chromium } from '@playwright/test';
const b = await chromium.launch();
// 320px = o telemovel mais estreito que ainda se usa (iPhone SE 1a geracao)
for (const w of [320, 360, 393, 430]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 700 }, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await p.waitForSelector('.app-header', { timeout: 10000 });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const l = document.querySelector('.header-logo--light');
    const bg = document.querySelector('.status-badge');
    const lb = l.getBoundingClientRect(), bb = bg.getBoundingClientRect();
    return { logoW: Math.round(lb.width), badgeL: Math.round(bb.left), logoR: Math.round(lb.right),
      sobrepoe: !(lb.right < bb.left), transbordaX: document.documentElement.scrollWidth > window.innerWidth };
  });
  const ok = !r.sobrepoe && !r.transbordaX && r.logoW > 70;
  console.log(`${w}px: logo=${r.logoW}px termina em ${r.logoR}px, estado comeca em ${r.badgeL}px | sobrepoe=${r.sobrepoe} transborda=${r.transbordaX} -> ${ok?'PASS':'FALHA'}`);
}
await b.close();
