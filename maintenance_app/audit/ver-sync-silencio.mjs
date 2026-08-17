import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['Pixel 5'] })).newPage();
const msgs = [];
page.on('console', m => msgs.push({ t: m.type(), x: m.text() }));
page.on('pageerror', e => msgs.push({ t: 'pageerror', x: e.message }));
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => window.syncEngine.sync({ manual: true }));
await page.waitForTimeout(800);
console.log('resultado do sync:', JSON.stringify(r));
console.log('\nmensagens (sem os 503 de rede do browser):');
msgs.filter(m => !m.x.includes('Failed to load resource')).forEach(m => console.log(` [${m.t}] ${m.x.slice(0,120)}`));
console.log('\npageerror ou console.error do NOSSO codigo:',
  msgs.filter(m => (m.t === 'error' || m.t === 'pageerror') && !m.x.includes('Failed to load resource')).length);
await browser.close();
