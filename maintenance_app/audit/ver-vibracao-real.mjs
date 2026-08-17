import { chromium, devices } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 5'] });
const p = await ctx.newPage();
await p.addInitScript(() => {
  window.__vibes = [];
  Object.defineProperty(navigator, 'vibrate', {
    value: (pattern) => { window.__vibes.push(pattern); return true; }, configurable: true
  });
});
const out = [];
const ok = (n, c, d='') => { out.push({n,c}); console.log(`${c?'PASS':'FALHA'}  ${n}${d?'  — '+d:''}`); };

await p.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await p.waitForSelector('#qc-description', { timeout: 10000 });
await p.waitForTimeout(600);

// 1. gravar no ecra Hoje
await p.fill('#qc-description', 'Teste vibracao ecra Hoje');
await p.click('#btn-save-capture');
await p.waitForTimeout(1300);
let v = await p.evaluate(() => window.__vibes);
ok('vibra ao gravar no ecrã Hoje', v.length > 0, JSON.stringify(v));

// 2. eliminar no historico -> padrao diferente
await p.evaluate(() => window.__vibes = []);
p.on('dialog', d => d.accept());
await p.click('[data-tab="history"]');
await p.waitForTimeout(1000);
const temCartao = await p.locator('.btn-card-del').count();
if (temCartao > 0) {
  await p.locator('.btn-card-del').first().click();
  await p.waitForTimeout(1300);
  v = await p.evaluate(() => window.__vibes);
  ok('vibra ao eliminar', v.length > 0, JSON.stringify(v));
  ok('eliminar tem padrão diferente de gravar', Array.isArray(v[0]), Array.isArray(v[0]) ? 'array (dois toques)' : 'numero (igual a gravar)');
} else {
  ok('cartao para eliminar existe', false, 'sem cartoes no historico');
}
console.log('\n' + (out.every(x=>x.c) ? 'TUDO OK' : 'HA FALHAS'));
await b.close();
process.exit(out.every(x=>x.c) ? 0 : 1);
