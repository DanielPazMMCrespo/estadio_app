/**
 * Visita todos os ecrãs novos e mede cada um.
 * Usa a API real da app (window.app.navigateTo) para não depender de selectores de nav.
 *   node audit/tour.mjs --label <nome>
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const URL_BASE = arg('url', 'http://127.0.0.1:5173');
const LABEL = arg('label', 'tour');
const OUT = join(HERE, LABEL);
const SHOTS = join(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });

const PROBE = `(() => {
  const MINT = 48, MINX = 18;
  const SEL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [onclick], [tabindex]:not([tabindex="-1"]), label[for], .issue-card, .room-row, .sector-card-header, .location-card, .filter-chip, .nav-tab';
  const small = [], text = [];
  for (const el of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.width >= MINT && r.height >= MINT) continue;
    if (el.type === 'hidden') continue;
    small.push({ w: Math.round(r.width), h: Math.round(r.height),
      what: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''),
      txt: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40) });
  }
  const seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (t.length < 2) continue;
    const el = n.parentElement; if (!el) continue;
    const tag = el.tagName.toLowerCase();
    if (['script','style','noscript'].includes(tag)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const px = parseFloat(cs.fontSize); if (!(px < MINX)) continue;
    const k = tag + px + t.slice(0, 20); if (seen.has(k)) continue; seen.add(k);
    text.push({ px: Math.round(px * 10) / 10, txt: t.slice(0, 50) });
  }
  // texto cortado por overflow (reticências reais)
  const clipped = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (t.length < 3) continue;
    if (el.scrollWidth > el.clientWidth + 2) {
      const cs = getComputedStyle(el);
      if (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis') {
        clipped.push({ txt: t.slice(0, 45), scrollW: el.scrollWidth, clientW: el.clientWidth });
      }
    }
  }
  return { small, text, clipped,
    hOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
})()`;

const ROUTES = ['home', 'history', 'tasks', 'more', 'tools', 'equipment', 'notes', 'sectors', 'settings', 'metrics'];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'], viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-PT',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 200)));

await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const out = [];
for (const r of ROUTES) {
  const ok = await page.evaluate((route) => {
    if (window.app && typeof window.app.navigateTo === 'function') { window.app.navigateTo(route); return true; }
    return false;
  }, r).catch(() => false);
  if (!ok) { out.push({ route: r, reachable: false }); continue; }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(SHOTS, `${r}.png`), fullPage: true }).catch(() => {});
  const probe = await page.evaluate(PROBE).catch(() => null);
  const bodyText = await page.evaluate(() => (document.getElementById('dashboard-feed')?.innerText || '').trim().slice(0, 160)).catch(() => '');
  out.push({ route: r, reachable: true, empty: bodyText.length < 5, preview: bodyText, ...probe });
}

const L = [`# Tour dos ecrãs — ${LABEL}`, `${new Date().toISOString()} · 390x844`, ''];
L.push('| rota | chega lá | vazio | alvos<48 | texto<18 | cortado | overflow |');
L.push('|---|---|---|---|---|---|---|');
for (const s of out) {
  L.push(`| ${s.route} | ${s.reachable ? 'sim' : '**NAO**'} | ${s.empty ? '**SIM**' : 'no'} | ${s.small?.length ?? '—'} | ${s.text?.length ?? '—'} | ${s.clipped?.length ?? '—'} | ${s.hOverflow ?? '—'} |`);
}
L.push('', `## Erros de consola (${new Set(errors).size})`);
[...new Set(errors)].forEach(e => L.push(`- \`${e}\``));
for (const s of out) {
  if (!s.reachable) continue;
  if (!s.small?.length && !s.text?.length && !s.clipped?.length) continue;
  L.push('', `### ${s.route}`);
  s.small?.slice(0, 10).forEach(t => L.push(`- alvo ${t.w}x${t.h} \`${t.what}\` "${t.txt}"`));
  s.text?.slice(0, 10).forEach(t => L.push(`- texto ${t.px}px "${t.txt}"`));
  s.clipped?.slice(0, 10).forEach(t => L.push(`- cortado (${t.scrollW}>${t.clientW}) "${t.txt}"`));
}
writeFileSync(join(OUT, 'report.md'), L.join('\n'), 'utf8');
console.log(L.join('\n'));
await browser.close();
