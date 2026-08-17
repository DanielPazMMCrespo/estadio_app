/**
 * Verifica as duas coisas que os testes unitários não conseguem ver:
 *   1. o tema escuro (a revisão previu que os botões de prioridade ficavam presos
 *      às cores do tema claro, por serem escritas no elemento)
 *   2. o modo offline a sério (é o caso NORMAL desta app)
 */
import { chromium, devices } from '@playwright/test';

const URL = 'http://127.0.0.1:5173';
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FALHA'}  ${name}${detail ? '  — ' + detail : ''}`);
}

/** Luminância relativa (WCAG) a partir de "rgb(r, g, b)". */
function lum(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return null;
  const [r, g, b] = m.slice(0, 3).map(Number).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const a = lum(fg), b = lum(bg);
  if (a === null || b === null) return null;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const browser = await chromium.launch();

/* ===================== TEMA ESCURO ===================== */
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'], colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bottom-nav', { timeout: 10000 });
  await page.waitForTimeout(600);

  const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('escuro: fundo do corpo escurece', lum(fundo) < 0.2, fundo);

  // O logótipo normal é escuro e desaparecia no tema escuro.
  const logo = await page.evaluate(() => {
    const l = document.querySelector('.header-logo--light');
    const d = document.querySelector('.header-logo--dark');
    const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    return { claroVisivel: vis(l), escuroVisivel: vis(d), temAmbos: !!l && !!d };
  });
  check('escuro: usa o logótipo claro (o normal desaparecia)',
    logo.temAmbos && logo.escuroVisivel && !logo.claroVisivel,
    `claro=${logo.claroVisivel} escuro=${logo.escuroVisivel}`);

  // Contraste do texto principal sobre o fundo
  const contraste = await page.evaluate(() => {
    const h = document.querySelector('.home-view h2');
    if (!h) return null;
    return { fg: getComputedStyle(h).color, bg: getComputedStyle(document.body).backgroundColor };
  });
  const ratio = contraste ? contrast(contraste.fg, contraste.bg) : null;
  check('escuro: título legível (contraste >= 4.5:1)', ratio !== null && ratio >= 4.5,
    ratio ? `${ratio}:1` : 'não medido');

  // O problema previsto: cores escritas no elemento nos botões de prioridade
  await page.waitForSelector('#qc-description', { timeout: 8000 });
  await page.fill('#qc-description', 'teste tema escuro');
  await page.click('#btn-open-full-form');
  await page.waitForTimeout(900);

  const prio = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#priority-options-group .priority-select-btn')];
    if (!btns.length) return null;
    const bg = getComputedStyle(document.body).backgroundColor;
    return btns.map(b => ({
      p: b.dataset.priority,
      cor: getComputedStyle(b).color,
      inline: b.getAttribute('style') || '',
      bg
    }));
  });

  if (prio) {
    const piores = prio.map(p => ({ p: p.p, r: contrast(p.cor, p.bg) })).filter(x => x.r !== null && x.r < 4.5);
    check('escuro: botões de prioridade legíveis',
      piores.length === 0,
      piores.length ? piores.map(x => `${x.p}=${x.r}:1`).join(', ') : prio.map(p => `${p.p}=${contrast(p.cor, p.bg)}:1`).join(', '));

    const comCorFixa = prio.filter(p => /color\s*:\s*(#|rgb)/i.test(p.inline));
    check('escuro: prioridades não usam cor fixa no elemento',
      comCorFixa.length === 0,
      comCorFixa.length ? comCorFixa.map(p => p.p).join(', ') : 'usam variáveis do tema');
  } else {
    check('escuro: botões de prioridade encontrados', false, 'formulário não abriu');
  }

  await page.screenshot({ path: 'audit/tema-escuro.png' });
  await ctx.close();
}

/* ===================== OFFLINE ===================== */
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#qc-description', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Cortar a rede
  await ctx.setOffline(true);
  await page.waitForTimeout(800);

  const badge = await page.evaluate(() => {
    const b = document.querySelector('#connectivity-badge .status-text');
    return b ? b.textContent.trim() : null;
  });
  check('offline: indicador diz Offline', badge === 'Offline', String(badge));

  // Gravar SEM rede — é o caso normal desta app
  await page.fill('#qc-description', 'AVARIA GRAVADA SEM REDE — bomba de rega');
  await page.click('#btn-save-capture');
  await page.waitForTimeout(1200);

  const gravado = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('EstadioMaintenanceDB');
    req.onsuccess = () => {
      const tx = req.result.transaction(['reports', 'sync_queue'], 'readonly');
      const gr = tx.objectStore('reports').getAll();
      const gq = tx.objectStore('sync_queue').getAll();
      let r = null, q = null;
      gr.onsuccess = () => { r = gr.result; if (q !== null) resolve({ r, q }); };
      gq.onsuccess = () => { q = gq.result; if (r !== null) resolve({ r, q }); };
    };
    req.onerror = () => resolve({ r: [], q: [] });
  }));

  const semRede = gravado.r.filter(x => (x.description || '').includes('SEM REDE'));
  check('offline: avaria grava no telemóvel', semRede.length === 1,
    semRede.length ? `id=${String(semRede[0].id).slice(0, 8)}` : 'não gravou');
  check('offline: mutação entra na fila para subir depois',
    gravado.q.length > 0, `${gravado.q.length} na fila`);
  check('offline: registo fica marcado como não sincronizado',
    semRede.length === 1 && semRede[0].synced === 0,
    semRede.length ? `synced=${semRede[0].synced}` : 'n/a');

  // Sincronizar sem rede não pode rebentar
  const syncOffline = await page.evaluate(() => window.syncEngine.sync({ manual: true }));
  check('offline: sincronizar sem rede não rebenta',
    syncOffline && syncOffline.success === false && !!syncOffline.reason,
    JSON.stringify(syncOffline));

  // Navegar por todos os ecrãs sem rede
  const ecras = ['history', 'tasks', 'more', 'tools', 'equipment', 'notes', 'settings', 'metrics', 'reports', 'home'];
  let falhou = null;
  for (const e of ecras) {
    try {
      await page.evaluate((v) => window.app.navigateTo(v), e);
      await page.waitForTimeout(350);
      const vazio = await page.evaluate(() => {
        const f = document.getElementById('dashboard-feed');
        return !f || f.textContent.trim().length < 10;
      });
      if (vazio) { falhou = e; break; }
    } catch (err) { falhou = e + ': ' + err.message; break; }
  }
  check('offline: os 10 ecrãs abrem com conteúdo', falhou === null, falhou || '');

  check('offline: sem erros de JavaScript', erros.length === 0, erros.slice(0, 2).join(' | '));

  // Voltar a ter rede
  await ctx.setOffline(false);
  await page.waitForTimeout(1200);
  const badgeVolta = await page.evaluate(() => {
    const b = document.querySelector('#connectivity-badge .status-text');
    return b ? b.textContent.trim() : null;
  });
  check('offline: indicador recupera ao voltar a rede',
    badgeVolta !== 'Offline', String(badgeVolta));

  await ctx.close();
}

await browser.close();

const falhas = results.filter(r => !r.ok);
console.log('\n' + '='.repeat(60));
console.log(`TOTAL: ${results.length - falhas.length}/${results.length} passaram`);
if (falhas.length) {
  console.log('\nFALHAS:');
  falhas.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
console.log('TUDO OK');
