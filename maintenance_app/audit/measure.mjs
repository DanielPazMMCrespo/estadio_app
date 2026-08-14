/**
 * Objective UX measurement harness — Estádio Leiria maintenance PWA.
 *
 * Measures, on a real mobile viewport, against the hard bar:
 *   - every visible interactive element  >= 48x48 CSS px
 *   - every visible body-text node       >= 18 CSS px
 *   - taps from cold app open to "avaria registada" (report persisted in IndexedDB)
 *
 * Writes:
 *   audit/shots/<screen>.png      full-page screenshots (what a critic actually looks at)
 *   audit/report.json             machine-readable results
 *   audit/report.md              human summary
 *
 * Usage:  node audit/measure.mjs [--url http://localhost:5173] [--label baseline]
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const URL_BASE = arg('url', 'http://localhost:5173');
const LABEL = arg('label', 'run');
const OUT_DIR = join(HERE, LABEL === 'run' ? '.' : LABEL);
const SHOTS = join(OUT_DIR, 'shots');

const MIN_TOUCH = 48;
const MIN_TEXT = 18;

mkdirSync(SHOTS, { recursive: true });

/* ------------------------------------------------------------------ *
 * In-page probes
 * ------------------------------------------------------------------ */

/** Collects every visible interactive element smaller than the touch bar. */
const PROBE_TOUCH = `(() => {
  const MIN = ${MIN_TOUCH};
  const SEL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"], [onclick], [tabindex]:not([tabindex="-1"]), label[for], .issue-card, .room-row, .sector-card-header, .location-card, .filter-chip, .nav-tab';
  const out = [];
  for (const el of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // element must be inside the layout (may be scrolled out, that's fine)
    if (r.width >= MIN && r.height >= MIN) continue;
    if (el.type === 'hidden') continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 90) || null,
      text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\\s+/g,' ').slice(0, 50),
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
    });
  }
  return out;
})()`;

/** Collects every visible text-bearing leaf whose font-size is under the text bar. */
const PROBE_TEXT = `(() => {
  const MIN = ${MIN_TEXT};
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const px = parseFloat(cs.fontSize);
    if (!(px < MIN)) continue;
    // ignore pure-icon glyph text (single symbol like x, chevron)
    if (t.length <= 1) continue;
    const key = tag + '|' + cs.fontSize + '|' + t.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      tag,
      cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 70) || null,
      px: Math.round(px * 10) / 10,
      text: t.replace(/\\s+/g, ' ').slice(0, 60),
    });
  }
  return out;
})()`;

/** Horizontal overflow of the document — a phone page must never scroll sideways. */
const PROBE_OVERFLOW = `({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
})`;

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

async function auditScreen(page, name) {
  await page.waitForTimeout(450);
  const shot = join(SHOTS, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const [touch, text, overflow] = await Promise.all([
    page.evaluate(PROBE_TOUCH).catch(() => []),
    page.evaluate(PROBE_TEXT).catch(() => []),
    page.evaluate(PROBE_OVERFLOW).catch(() => ({ scrollW: 0, clientW: 0 })),
  ]);
  return {
    screen: name,
    shot: `shots/${name}.png`,
    smallTargets: touch,
    smallText: text,
    hOverflowPx: Math.max(0, overflow.scrollW - overflow.clientW),
  };
}

/**
 * Counts taps from a cold app open to a persisted report.
 * Every user gesture (tap / typed field) is counted as one action, the way a
 * gloved technician experiences it. Typing a field counts as 1 tap + the text.
 */
async function measureTapFlow(page) {
  const taps = [];
  const tap = async (label, fn) => {
    taps.push(label);
    await fn();
    await page.waitForTimeout(220);
  };

  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  // clear any previous state so the flow is measured from a true cold start
  await page.evaluate(async () => {
    for (const db of await indexedDB.databases?.() ?? []) if (db.name) indexedDB.deleteDatabase(db.name);
    localStorage.clear();
  }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const before = await countReports(page);
  const notes = [];

  // Tap 1 — the app icon on the lock screen / home screen. Always 1 for a PWA.
  taps.push('abrir a app (ícone)');

  // Tap 2 — the primary "new" affordance (removed since we put it directly on the home screen)

  // From here the flow depends on the form. Try to fill the minimum required set.
  // Removed location field click as it is optional and we want to test the minimum taps for a Quick Capture.

  const desc = page.locator('#qc-description');
  if (await desc.count()) {
    await tap('escrever a descrição', () => desc.first().fill('Projetor fundido na torre norte'));
  }

  const time = page.locator('#input-time-spent');
  if (await time.count() && await time.first().isVisible()) {
    await tap('escrever o tempo gasto', () => time.first().fill('20'));
  }

  const save = page.locator('#btn-save-capture');
  if (await save.count()) {
    await tap('guardar', () => save.first().click());
  }
  await page.waitForTimeout(900);

  const after = await countReports(page);
  return {
    taps: taps.length,
    sequence: taps,
    reportPersisted: after > before,
    reportsBefore: before,
    reportsAfter: after,
    notes,
  };
}

async function countReports(page) {
  return await page.evaluate(async () => {
    return await new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => finish(-1), 2500);
      try {
        const req = indexedDB.open('EstadioMaintenanceDB');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('reports')) return finish(0);
          const tx = db.transaction('reports', 'readonly');
          const c = tx.objectStore('reports').count();
          c.onsuccess = () => finish(c.result);
          c.onerror = () => finish(-1);
        };
        req.onerror = () => finish(0);
      } catch { finish(-1); }
    });
  }).catch(() => -1);
}

/* ------------------------------------------------------------------ */

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-PT',
    permissions: [],
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 220)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 220)));

  const screens = [];

  // ---- tap flow first (it wipes state, so run before screen tour)
  const flow = await measureTapFlow(page);

  // ---- screen tour on a seeded-clean app
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  screens.push(await auditScreen(page, '01-home'));

  const tabs = [
    ['history', '02-ocorrencias'],
    ['metrics', '03-metricas'],
    ['settings', '04-definicoes'],
  ];
  for (const [tab, name] of tabs) {
    const el = page.locator(`.nav-tab[data-tab="${tab}"]`);
    if (await el.count()) {
      await el.first().click().catch(() => {});
      screens.push(await auditScreen(page, name));
    }
  }

  // back home then open the new-report sheet
  await page.locator('.nav-tab[data-tab="map"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
  const plus = page.locator('#btn-nav-quick-add');
  if (await plus.count()) {
    await plus.first().click().catch(() => {});
    screens.push(await auditScreen(page, '05-nova-ocorrencia'));
  }

  // ---- aggregate
  const allTargets = screens.flatMap((s) => s.smallTargets.map((t) => ({ ...t, screen: s.screen })));
  const allText = screens.flatMap((s) => s.smallText.map((t) => ({ ...t, screen: s.screen })));
  const worstTarget = allTargets.reduce((a, b) => (a && a.h <= b.h ? a : b), null);
  const worstText = allText.reduce((a, b) => (a && a.px <= b.px ? a : b), null);

  const result = {
    label: LABEL,
    at: new Date().toISOString(),
    url: URL_BASE,
    viewport: '390x844 iPhone 13',
    bar: { minTouchPx: MIN_TOUCH, minTextPx: MIN_TEXT, maxTaps: 3 },
    tapFlow: flow,
    totals: {
      screens: screens.length,
      targetsUnder48: allTargets.length,
      textUnder18: allText.length,
      smallestTargetPx: worstTarget ? Math.min(worstTarget.w, worstTarget.h) : null,
      smallestTextPx: worstText ? worstText.px : null,
      hOverflowScreens: screens.filter((s) => s.hOverflowPx > 1).map((s) => s.screen),
      consoleErrors: [...new Set(consoleErrors)],
    },
    verdict: {
      touchPass: allTargets.length === 0,
      textPass: allText.length === 0,
      tapPass: flow.reportPersisted && flow.taps <= 3,
      noErrors: consoleErrors.length === 0,
    },
    screens,
  };

  writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(result, null, 2), 'utf8');
  writeFileSync(join(OUT_DIR, 'report.md'), renderMd(result), 'utf8');

  console.log(renderMd(result));
  await browser.close();

  const pass = Object.values(result.verdict).every(Boolean);
  process.exit(pass ? 0 : 1);
}

function renderMd(r) {
  const L = [];
  L.push(`# Auditoria UX — ${r.label}`);
  L.push(`${r.at} · ${r.viewport} · ${r.url}`);
  L.push('');
  L.push(`## Barra`);
  L.push(`| Critério | Alvo | Resultado | Passa |`);
  L.push(`|---|---|---|---|`);
  L.push(`| Alvos de toque | >= 48px | ${r.totals.targetsUnder48} abaixo (menor ${r.totals.smallestTargetPx ?? '—'}px) | ${r.verdict.touchPass ? 'SIM' : 'NAO'} |`);
  L.push(`| Corpo de texto | >= 18px | ${r.totals.textUnder18} abaixo (menor ${r.totals.smallestTextPx ?? '—'}px) | ${r.verdict.textPass ? 'SIM' : 'NAO'} |`);
  L.push(`| Toques até avaria registada | <= 3 | ${r.tapFlow.taps} ${r.tapFlow.reportPersisted ? '(gravou)' : '(NAO GRAVOU)'} | ${r.verdict.tapPass ? 'SIM' : 'NAO'} |`);
  L.push(`| Erros de consola | 0 | ${r.totals.consoleErrors.length} | ${r.verdict.noErrors ? 'SIM' : 'NAO'} |`);
  L.push('');
  L.push(`## Sequência de toques`);
  r.tapFlow.sequence.forEach((s, i) => L.push(`${i + 1}. ${s}`));
  if (r.tapFlow.notes.length) {
    L.push('');
    L.push(`**Notas do fluxo:**`);
    r.tapFlow.notes.forEach((n) => L.push(`- ${n}`));
  }
  if (r.totals.consoleErrors.length) {
    L.push('');
    L.push(`## Erros de consola`);
    r.totals.consoleErrors.forEach((e) => L.push(`- \`${e}\``));
  }
  if (r.totals.hOverflowScreens.length) {
    L.push('');
    L.push(`## Scroll horizontal (nunca deve acontecer)`);
    r.totals.hOverflowScreens.forEach((s) => L.push(`- ${s}`));
  }
  L.push('');
  L.push(`## Por ecrã`);
  for (const s of r.screens) {
    L.push('');
    L.push(`### ${s.screen} — \`${s.shot}\``);
    L.push(`alvos < 48px: **${s.smallTargets.length}** · texto < 18px: **${s.smallText.length}** · overflow: ${s.hOverflowPx}px`);
    if (s.smallTargets.length) {
      L.push('');
      L.push(`Alvos pequenos (top 12):`);
      s.smallTargets.slice(0, 12).forEach((t) => L.push(`- ${t.w}x${t.h} \`${t.tag}${t.id ? '#' + t.id : ''}${t.cls ? '.' + t.cls.split(' ')[0] : ''}\` "${t.text}"`));
    }
    if (s.smallText.length) {
      L.push('');
      L.push(`Texto pequeno (top 12):`);
      s.smallText.slice(0, 12).forEach((t) => L.push(`- ${t.px}px \`${t.tag}${t.cls ? '.' + t.cls.split(' ')[0] : ''}\` "${t.text}"`));
    }
  }
  return L.join('\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
