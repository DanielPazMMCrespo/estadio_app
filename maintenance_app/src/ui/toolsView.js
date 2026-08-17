import { toolsRepo, TOOL_UNITS } from '../db/toolsRepo.js';
import { toast } from './toast.js';

import { esc } from '../utils/html.js';
/**
 * Ecrã de FERRAMENTAS / STOCK.
 *
 * O que o Limble faz mal (legacy-17, legacy-06): a quantidade vive escondida
 * dentro de um campo de texto de formulário web, e mexer nela obriga a abrir
 * uma ficha e a gravar. Aqui a quantidade é o maior número do cartão e um
 * único toque num botão de 64px faz o movimento.
 */
export class ToolsViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNewReportForTool = options.onNewReportForTool || null;

    this.allTools = [];
    this.filteredTools = [];
    this.searchQuery = '';
    this.busy = new Set();       // ids com operação a decorrer
    this.sheetEl = null;         // folha aberta (bottom sheet)
    this.pressTimer = null;      // toque longo
    this.pressFired = false;
  }

  // ---------------------------------------------------------------- render

  async render() {
    if (!this.container) return;

    await this.load();

    this.container.innerHTML = `
      <section class="tools-view animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Ferramentas</h2>
            <p class="section-subtitle">Stock do armazém — tirar e repor</p>
          </div>
          <span class="section-badge">${this.allTools.length} artigos</span>
        </div>

        <button type="button" class="d-btn-primary-wide" id="btn-new-tool">
          + Nova ferramenta
        </button>

        <div id="tools-low-stock">${this.renderLowStock()}</div>

        <div class="search-bar">
          <span class="search-icon-svg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="input-search-tools" class="form-input search-input"
                 placeholder="Pesquisar ferramenta ou material..." value="${esc(this.searchQuery)}" />
        </div>

        <div class="d-card-list" id="tools-list">
          ${this.renderList()}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  async refresh() {
    await this.render();
  }

  async load() {
    try {
      let items = await toolsRepo.getAll();
      if (!items.length) {
        await toolsRepo.seedDefaults();
        items = await toolsRepo.getAll();
      }
      this.allTools = items;
    } catch (e) {
      console.error('[Ferramentas] Erro ao carregar:', e);
      this.allTools = [];
    }
    this.applyFilter();
  }

  applyFilter() {
    const q = this.norm(this.searchQuery);
    this.filteredTools = !q
      ? this.allTools.slice()
      : this.allTools.filter(t =>
          this.norm(t.name).includes(q) ||
          this.norm(t.locationName).includes(q) ||
          this.norm(t.notes).includes(q)
        );
  }

  // ------------------------------------------------------------ low stock

  isLow(tool) {
    return this.num(tool.qty) <= this.num(tool.minQty);
  }

  renderLowStock() {
    const low = this.allTools.filter(t => this.isLow(t));
    if (!low.length) return '';
    return `
      <div class="d-alert d-alert-warn">
        <p class="d-alert-title">Pouco stock (${low.length})</p>
        <ul class="d-alert-list">
          ${low.map(t => `
            <li class="d-alert-line">
              <span class="d-alert-name">${esc(t.name)}</span>
              <span class="d-alert-qty">${this.fmtQty(t.qty)} ${esc(t.unit || 'un')}</span>
            </li>
          `).join('')}
        </ul>
        <p class="d-alert-foot">Repõe antes de ires ao armazém.</p>
      </div>
    `;
  }

  refreshLowStock() {
    const host = this.container && this.container.querySelector('#tools-low-stock');
    if (host) host.innerHTML = this.renderLowStock();
  }

  // ----------------------------------------------------------------- list

  renderList() {
    if (!this.filteredTools.length) {
      return `
        <div class="empty-state">
          <h3 class="empty-title">Nenhuma ferramenta encontrada</h3>
          <p class="empty-desc">Limpa a pesquisa ou cria uma ferramenta nova.</p>
        </div>
      `;
    }
    return this.filteredTools.map(t => this.renderToolCard(t)).join('');
  }

  renderToolCard(tool) {
    const low = this.isLow(tool);
    return `
      <article class="d-tool-card${low ? ' is-low' : ''}" data-tool-id="${esc(tool.id)}">
        <div class="d-tool-top">
          <div class="d-tool-ident">
            <h3 class="d-tool-name">${esc(tool.name)}</h3>
            ${tool.locationName ? `
              <p class="d-tool-loc">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${esc(tool.locationName)}
              </p>
            ` : ''}
            ${low ? '<p class="d-tool-lowtag">Pouco stock</p>' : ''}
          </div>
          <div class="d-tool-qtybox">
            <span class="d-tool-qty" data-qty-for="${esc(tool.id)}">${this.fmtQty(tool.qty)}</span>
            <span class="d-tool-unit">${esc(tool.unit || 'un')}</span>
          </div>
        </div>

        <div class="d-tool-actions">
          <button type="button" class="d-tool-btn d-tool-take" data-act="take" data-id="${esc(tool.id)}">
            &minus; Tirar 1
          </button>
          <button type="button" class="d-tool-btn d-tool-restock" data-act="restock" data-id="${esc(tool.id)}">
            + Repor 1
          </button>
        </div>

        <div class="d-tool-links">
          <button type="button" class="d-tool-link" data-act="custom" data-id="${esc(tool.id)}">Outra quantidade</button>
          <button type="button" class="d-tool-link" data-act="moves" data-id="${esc(tool.id)}">Ver movimentos</button>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------------------- events

  bindEvents() {
    if (!this.container) return;

    const search = this.container.querySelector('#input-search-tools');
    if (search) {
      search.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.applyFilter();
        const list = this.container.querySelector('#tools-list');
        if (list) {
          list.innerHTML = this.renderList();
          this.bindCardEvents();
        }
      });
    }

    const btnNew = this.container.querySelector('#btn-new-tool');
    if (btnNew) btnNew.addEventListener('click', () => this.openNewToolSheet());

    this.bindCardEvents();
  }

  bindCardEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.d-tool-btn, .d-tool-link').forEach(btn => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pressFired) { this.pressFired = false; return; }
        if (act === 'take') this.applyMove(id, -1, btn);
        else if (act === 'restock') this.applyMove(id, 1, btn);
        else if (act === 'custom') this.openQtySheet(id, 'take');
        else if (act === 'moves') this.openMovesSheet(id);
      });

      // Toque longo nos botões de stock -> folha de quantidade
      if (act === 'take' || act === 'restock') {
        const start = () => {
          this.pressFired = false;
          clearTimeout(this.pressTimer);
          this.pressTimer = setTimeout(() => {
            this.pressFired = true;
            this.openQtySheet(id, act);
          }, 550);
        };
        const cancel = () => clearTimeout(this.pressTimer);
        btn.addEventListener('pointerdown', start);
        btn.addEventListener('pointerup', cancel);
        btn.addEventListener('pointerleave', cancel);
        btn.addEventListener('pointercancel', cancel);
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
      }
    });
  }

  // ----------------------------------------------------------- movimentos

  /**
   * Aplica um movimento de stock e actualiza só o número no ecrã.
   * Se a operação falhar, o número fica exactamente como estava.
   */
  async applyMove(id, delta, btnEl) {
    if (!id || this.busy.has(id)) return;
    this.busy.add(id);
    if (btnEl) btnEl.disabled = true;

    try {
      const amount = Math.abs(delta);
      const res = delta < 0
        ? await toolsRepo.take(id, amount, 'uso em obra')
        : await toolsRepo.restock(id, amount, 'reposição');

      const tool = res.tool;
      const idx = this.allTools.findIndex(t => t.id === id);
      if (idx >= 0) this.allTools[idx] = tool;
      const fidx = this.filteredTools.findIndex(t => t.id === id);
      if (fidx >= 0) this.filteredTools[fidx] = tool;

      this.patchCard(tool);
      this.refreshLowStock();

      toast.success(delta < 0
        ? `Tirado ${amount} ${tool.unit || 'un'} de ${tool.name}`
        : `Reposto ${amount} ${tool.unit || 'un'} de ${tool.name}`);
    } catch (err) {
      toast.error(err && err.message ? err.message : 'Não foi possível mexer no stock');
    } finally {
      this.busy.delete(id);
      if (btnEl) btnEl.disabled = false;
    }
  }

  /** Actualiza no sítio o número e o aviso de pouco stock de um cartão. */
  patchCard(tool) {
    if (!this.container || !tool) return;
    const qtyEl = this.container.querySelector(`[data-qty-for="${cssEscape(tool.id)}"]`);
    if (qtyEl) qtyEl.textContent = this.fmtQty(tool.qty);

    const card = this.container.querySelector(`.d-tool-card[data-tool-id="${cssEscape(tool.id)}"]`);
    if (!card) return;
    const low = this.isLow(tool);
    card.classList.toggle('is-low', low);
    const tag = card.querySelector('.d-tool-lowtag');
    if (low && !tag) {
      const ident = card.querySelector('.d-tool-ident');
      if (ident) {
        const p = document.createElement('p');
        p.className = 'd-tool-lowtag';
        p.textContent = 'Pouco stock';
        ident.appendChild(p);
      }
    } else if (!low && tag) {
      tag.remove();
    }
  }

  // -------------------------------------------------------------- sheets

  closeSheet() {
    if (this.sheetEl && this.sheetEl.parentNode) this.sheetEl.parentNode.removeChild(this.sheetEl);
    this.sheetEl = null;
  }

  /** Cria e monta uma folha inferior com o HTML interior dado. */
  openSheet(innerHtml) {
    this.closeSheet();
    const overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay d-sheet-overlay';
    overlay.innerHTML = `
      <div class="bottom-sheet-content d-sheet" role="dialog" aria-modal="true">
        <div class="sheet-drag-handle"><span class="drag-bar"></span></div>
        ${innerHtml}
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeSheet();
    });
    document.body.appendChild(overlay);
    this.sheetEl = overlay;
    return overlay;
  }

  /** Folha de quantidade com teclado numérico grande. */
  openQtySheet(id, mode = 'take') {
    const tool = this.allTools.find(t => t.id === id);
    if (!tool) return;

    let buffer = '';
    const unit = esc(tool.unit || 'un');

    const overlay = this.openSheet(`
      <div class="d-sheet-head">
        <h3 class="d-sheet-title">${esc(tool.name)}</h3>
        <button type="button" class="btn-close-detail" data-close="1" aria-label="Fechar">&times;</button>
      </div>
      <p class="d-sheet-sub">Em stock: <strong>${this.fmtQty(tool.qty)} ${unit}</strong></p>

      <div class="d-pad-display">
        <span class="d-pad-value" id="d-pad-value">0</span>
        <span class="d-pad-unit">${unit}</span>
      </div>

      <div class="d-pad-grid">
        ${['1','2','3','4','5','6','7','8','9'].map(n => `<button type="button" class="d-pad-key" data-key="${n}">${n}</button>`).join('')}
        <button type="button" class="d-pad-key" data-key="clear">C</button>
        <button type="button" class="d-pad-key" data-key="0">0</button>
        <button type="button" class="d-pad-key" data-key="back">&#9003;</button>
      </div>

      <div class="d-pad-actions">
        <button type="button" class="d-tool-btn d-tool-take" id="d-pad-take">&minus; Tirar</button>
        <button type="button" class="d-tool-btn d-tool-restock" id="d-pad-restock">+ Repor</button>
      </div>
    `);

    const valueEl = overlay.querySelector('#d-pad-value');
    const paint = () => { valueEl.textContent = buffer === '' ? '0' : buffer; };

    overlay.querySelectorAll('.d-pad-key').forEach(key => {
      key.addEventListener('click', () => {
        const k = key.dataset.key;
        if (k === 'clear') buffer = '';
        else if (k === 'back') buffer = buffer.slice(0, -1);
        else if (buffer.length < 5) buffer = (buffer === '' ? '' : buffer) + k;
        paint();
      });
    });

    const closeBtn = overlay.querySelector('[data-close="1"]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeSheet());

    const run = async (sign) => {
      const amount = Number(buffer);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.warning('Escreve uma quantidade maior do que zero');
        return;
      }
      this.closeSheet();
      await this.applyMove(id, sign * amount, null);
    };

    overlay.querySelector('#d-pad-take').addEventListener('click', () => run(-1));
    overlay.querySelector('#d-pad-restock').addEventListener('click', () => run(1));

    // pré-selecciona visualmente o modo de entrada
    const preferred = overlay.querySelector(mode === 'restock' ? '#d-pad-restock' : '#d-pad-take');
    if (preferred) preferred.classList.add('is-preferred');
  }

  /** Folha com os últimos movimentos de uma ferramenta. */
  async openMovesSheet(id) {
    const tool = this.allTools.find(t => t.id === id);
    if (!tool) return;

    let moves = [];
    try {
      moves = await toolsRepo.getMoves(id, 20);
    } catch (e) {
      console.error('[Ferramentas] Erro ao ler movimentos:', e);
    }

    const body = moves.length
      ? `<ul class="d-move-list">
          ${moves.map(m => {
            const positive = this.num(m.delta) > 0;
            return `
              <li class="d-move-row">
                <span class="d-move-delta ${positive ? 'is-in' : 'is-out'}">${positive ? '+' : '&minus;'}${this.fmtQty(Math.abs(this.num(m.delta)))}</span>
                <span class="d-move-meta">
                  <span class="d-move-when">${this.fmtDateTime(m.at)}</span>
                  <span class="d-move-reason">${esc(m.reason || (positive ? 'reposição' : 'uso em obra'))}</span>
                </span>
                <span class="d-move-after">ficou ${this.fmtQty(m.qtyAfter)}</span>
              </li>
            `;
          }).join('')}
        </ul>`
      : '<p class="d-sheet-sub">Ainda não há movimentos registados nesta ferramenta.</p>';

    const overlay = this.openSheet(`
      <div class="d-sheet-head">
        <h3 class="d-sheet-title">${esc(tool.name)}</h3>
        <button type="button" class="btn-close-detail" data-close="1" aria-label="Fechar">&times;</button>
      </div>
      <p class="d-sheet-sub">Últimos movimentos</p>
      ${body}
      ${this.onNewReportForTool ? `<button type="button" class="d-btn-primary-wide" id="d-tool-report">Registar intervenção com esta ferramenta</button>` : ''}
      <button type="button" class="d-btn-quiet-wide" data-close="1">Fechar</button>
    `);

    overlay.querySelectorAll('[data-close="1"]').forEach(b => b.addEventListener('click', () => this.closeSheet()));
    const rep = overlay.querySelector('#d-tool-report');
    if (rep) rep.addEventListener('click', () => {
      this.closeSheet();
      if (this.onNewReportForTool) this.onNewReportForTool(tool);
    });
  }

  /** Folha mínima de criação: nome, quantidade, unidade. Nada mais. */
  openNewToolSheet() {
    const overlay = this.openSheet(`
      <div class="d-sheet-head">
        <h3 class="d-sheet-title">Nova ferramenta</h3>
        <button type="button" class="btn-close-detail" data-close="1" aria-label="Fechar">&times;</button>
      </div>

      <label class="d-field-label" for="d-new-tool-name">Nome</label>
      <input type="text" class="form-input d-field-input" id="d-new-tool-name" placeholder="Ex: Chave de fendas" />

      <label class="d-field-label" for="d-new-tool-qty">Quantidade</label>
      <input type="number" inputmode="numeric" min="0" step="1" class="form-input d-field-input d-field-number" id="d-new-tool-qty" value="1" />

      <p class="d-field-label">Unidade</p>
      <div class="d-unit-row">
        ${TOOL_UNITS.map((u, i) => `<button type="button" class="d-unit-pill${i === 0 ? ' active' : ''}" data-unit="${esc(u)}">${esc(u)}</button>`).join('')}
      </div>

      <button type="button" class="d-btn-primary-wide" id="d-new-tool-save">Guardar ferramenta</button>
      <button type="button" class="d-btn-quiet-wide" data-close="1">Cancelar</button>
    `);

    let unit = TOOL_UNITS[0];
    overlay.querySelectorAll('.d-unit-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        overlay.querySelectorAll('.d-unit-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        unit = pill.dataset.unit;
      });
    });

    overlay.querySelectorAll('[data-close="1"]').forEach(b => b.addEventListener('click', () => this.closeSheet()));

    overlay.querySelector('#d-new-tool-save').addEventListener('click', async () => {
      const name = (overlay.querySelector('#d-new-tool-name').value || '').trim();
      const qty = Number(overlay.querySelector('#d-new-tool-qty').value);
      if (!name) {
        toast.warning('Escreve o nome da ferramenta');
        return;
      }
      try {
        await toolsRepo.create({ name, qty: Number.isFinite(qty) ? qty : 0, unit });
        this.closeSheet();
        toast.success('Ferramenta criada');
        await this.render();
      } catch (err) {
        toast.error(err && err.message ? err.message : 'Não foi possível criar a ferramenta');
      }
    });
  }

  // -------------------------------------------------------------- helpers

  num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  fmtQty(v) {
    const n = this.num(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
  }

  fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  norm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

}

/** Escapa um id para uso seguro dentro de um selector de atributo. */
function cssEscape(value) {
  return String(value == null ? '' : value).replace(/["\\]/g, '\\$&');
}
