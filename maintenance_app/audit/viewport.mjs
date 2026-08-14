/**
 * Screenshots do que cabe no ecrã SEM fazer scroll (390x844).
 * O fullPage engana: mostra 15000px que ele nunca vê de uma vez.
 *   node audit/viewport.mjs --label <nome>
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LABEL = arg('label', 'viewport');
const OUT = join(HERE, LABEL);
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['home', '01-hoje'], ['history', '02-avarias'], ['tasks', '03-tarefas'],
  ['more', '04-mais'], ['tools', '05-ferramentas'], ['equipment', '06-equipamento'],
  ['notes', '07-notas'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'], viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-PT',
});
const page = await ctx.newPage();
await page.goto(arg('url', 'http://127.0.0.1:5173'), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

for (const [route, name] of ROUTES) {
  await page.evaluate((r) => window.app?.navigateTo?.(r), route).catch(() => {});
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${name}.png`) });   // só o viewport
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${name}: pagina tem ${h}px de altura (${(h / 844).toFixed(1)} ecras de scroll)`);
}
await browser.close();
