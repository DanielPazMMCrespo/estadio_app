import { equipmentRepo, EQUIPMENT_CATEGORIES } from '../db/equipmentRepo.js';
import { reportsRepo } from '../db/reportsRepo.js';
import { toast } from './toast.js';

import { esc } from '../utils/html.js';
/** Rótulos em português das categorias do repositório. */
const CATEGORY_LABELS = {
  iluminacao: 'Iluminação',
  rega: 'Rega',
  eletrico: 'Elétrico',
  agua: 'Água',
  avac: 'AVAC',
  seguranca: 'Segurança',
  desporto: 'Desporto',
  outro: 'Outro'
};

/** Rótulos e classe de cor de cada estado. */
const STATUS_INFO = {
  ok: { label: 'Em serviço', cls: 'is-ok' },
  avariado: { label: 'Avariado', cls: 'is-broken' },
  manutencao: { label: 'Em manutenção', cls: 'is-maint' },
  abatido: { label: 'Abatido', cls: 'is-retired' }
};

/**
 * Ecrã de EQUIPAMENTO — o que está instalado no estádio.
 *
 * Do Limble (real-04, real-05, legacy-05) copiamos a ideia certa: a hierarquia
 * de local está sempre visível e o ativo é sempre um cubo de arame, nunca uma
 * foto. O que mudamos é o tamanho: os metadados dele estão a 13px, os nossos
 * nunca descem abaixo de 18px, e "Registar avaria" é um botão de dedo com luva
 * em vez de uma ligação azul de 14px.
 */
export class EquipmentViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNewReportForEquipment = options.onNewReportForEquipment || null;
    this.onViewEquipmentReports = options.onViewEquipmentReports || null;

    this.allEquipment = [];
    this.filtered = [];
    this.reportCounts = new Map();  // equipmentId -> nº de avarias registadas
    this.searchQuery = '';
    this.activeCategory = 'all';
    this.sheetEl = null;
  }

  // ---------------------------------------------------------------- render

  async render() {
    if (!this.container) return;

    await this.load();

    this.container.innerHTML = `
      <section class="equip-view animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Equipamento</h2>
            <p class="section-subtitle">O que está instalado no estádio</p>
          </div>
          <span class="section-badge">${this.allEquipment.length} ativos</span>
        </div>

        <div id="equip-broken-block">${this.renderBrokenBlock()}</div>

        <div class="search-bar">
          <span class="search-icon-svg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="input-search-equip" class="form-input search-input"
                 placeholder="Pesquisar equipamento..." value="${esc(this.searchQuery)}" />
        </div>

        <div class="d-cat-row">
          <button type="button" class="d-cat-pill${this.activeCategory === 'all' ? ' active' : ''}" data-cat="all">Todos</button>
          ${EQUIPMENT_CATEGORIES.map(c => `
            <button type="button" class="d-cat-pill${this.activeCategory === c ? ' active' : ''}" data-cat="${esc(c)}">${esc(CATEGORY_LABELS[c] || c)}</button>
          `).join('')}
        </div>

        <div class="d-card-list" id="equip-list">
          ${this.renderGroups()}
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
      let items = await equipmentRepo.getAll();
      if (!items.length) {
        await equipmentRepo.seedDefaults();
        items = await equipmentRepo.getAll();
      }
      this.allEquipment = items;
    } catch (e) {
      console.error('[Equipamento] Erro ao carregar:', e);
      this.allEquipment = [];
    }

    // Cruza as avarias por equipmentId; se o registo não tiver equipmentId,
    // cai para o locationId (é o que temos hoje na tabela de reports).
    this.reportCounts = new Map();
    try {
      const reports = await reportsRepo.getAll();
      const byLocation = new Map();
      for (const r of reports) {
        if (r.equipmentId) {
          this.reportCounts.set(r.equipmentId, (this.reportCounts.get(r.equipmentId) || 0) + 1);
        } else if (r.locationId) {
          byLocation.set(r.locationId, (byLocation.get(r.locationId) || 0) + 1);
        }
      }
      for (const eq of this.allEquipment) {
        if (this.reportCounts.has(eq.id)) continue;
        const n = byLocation.get(eq.locationId);
        if (n) this.reportCounts.set(eq.id, n);
      }
    } catch (e) {
      console.error('[Equipamento] Erro ao cruzar avarias:', e);
    }

    this.applyFilter();
  }

  applyFilter() {
    const q = this.norm(this.searchQuery);
    this.filtered = this.allEquipment.filter(eq => {
      if (this.activeCategory !== 'all' && eq.category !== this.activeCategory) return false;
      if (!q) return true;
      return this.norm(eq.name).includes(q) ||
             this.norm(eq.brand).includes(q) ||
             this.norm(eq.model).includes(q) ||
             this.norm(eq.serial).includes(q) ||
             this.norm(eq.locationName).includes(q);
    });
  }

  // ------------------------------------------------------------- avariados

  renderBrokenBlock() {
    const broken = this.allEquipment.filter(e => e.status === 'avariado');
    if (!broken.length) return '';
    return `
      <div class="d-alert d-alert-danger">
        <p class="d-alert-title">Avariado (${broken.length})</p>
        <ul class="d-alert-list">
          ${broken.map(e => `
            <li class="d-alert-line">
              <span class="d-alert-name">${esc(e.name)}</span>
              <span class="d-alert-where">${esc(e.locationName || '')}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // ---------------------------------------------------------------- lista

  renderGroups() {
    if (!this.filtered.length) {
      return `
        <div class="empty-state">
          <h3 class="empty-title">Nenhum equipamento encontrado</h3>
          <p class="empty-desc">Limpa a pesquisa ou escolhe outra categoria.</p>
        </div>
      `;
    }

    // Agrupa por localização, mantendo a ordem alfabética dos locais.
    const groups = new Map();
    for (const eq of this.filtered) {
      const key = eq.locationName || 'Sem localização atribuída';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(eq);
    }
    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));

    return keys.map(key => `
      <div class="d-loc-group">
        <div class="d-loc-head">
          <h3 class="d-loc-name">${esc(key)}</h3>
          <span class="d-loc-count">${groups.get(key).length}</span>
        </div>
        ${groups.get(key).map(eq => this.renderEquipCard(eq)).join('')}
      </div>
    `).join('');
  }

  renderEquipCard(eq) {
    const info = STATUS_INFO[eq.status] || STATUS_INFO.ok;
    const brandLine = [eq.brand, eq.model].filter(Boolean).join(' · ');
    const nReports = this.reportCounts.get(eq.id) || 0;

    return `
      <article class="d-equip-card ${info.cls}" data-equip-id="${esc(eq.id)}" tabindex="0" role="button">
        <div class="d-equip-head">
          <span class="d-equip-cube" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </span>
          <span class="d-equip-cat">${esc(CATEGORY_LABELS[eq.category] || eq.category || 'Outro')}</span>
        </div>

        <h4 class="d-equip-name">${esc(eq.name)}</h4>
        ${brandLine ? `<p class="d-equip-brand">${esc(brandLine)}</p>` : ''}
        <p class="d-equip-status ${info.cls}" data-status-for="${esc(eq.id)}">${esc(info.label)}</p>

        <div class="d-equip-actions">
          <button type="button" class="d-equip-btn-fault" data-act="fault" data-id="${esc(eq.id)}">Registar intervenção</button>
          ${nReports > 0 ? `<button type="button" class="d-equip-btn-reports" data-act="reports" data-id="${esc(eq.id)}">Ver intervenções (${nReports})</button>` : ''}
        </div>
      </article>
    `;
  }

  // --------------------------------------------------------------- events

  bindEvents() {
    if (!this.container) return;

    const search = this.container.querySelector('#input-search-equip');
    if (search) {
      search.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.refreshList();
      });
    }

    this.container.querySelectorAll('.d-cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.activeCategory = pill.dataset.cat;
        this.container.querySelectorAll('.d-cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.refreshList();
      });
    });

    this.bindCardEvents();
  }

  refreshList() {
    this.applyFilter();
    const list = this.container.querySelector('#equip-list');
    if (list) {
      list.innerHTML = this.renderGroups();
      this.bindCardEvents();
    }
  }

  bindCardEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.d-equip-card [data-act]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eq = this.allEquipment.find(x => x.id === btn.dataset.id);
        if (!eq) return;
        if (btn.dataset.act === 'fault') {
          if (this.onNewReportForEquipment) this.onNewReportForEquipment(eq);
          else toast.info('Registo de intervenção ainda não ligado neste ecrã');
        } else if (btn.dataset.act === 'reports') {
          if (this.onViewEquipmentReports) this.onViewEquipmentReports(eq);
          else toast.info('Lista de intervenções ainda não ligada neste ecrã');
        }
      });
    });

    this.container.querySelectorAll('.d-equip-card[data-equip-id]').forEach(card => {
      const open = () => {
        const eq = this.allEquipment.find(x => x.id === card.dataset.equipId);
        if (eq) this.openDetailSheet(eq);
      };
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        open();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  // --------------------------------------------------------------- sheet

  closeSheet() {
    if (this.sheetEl && this.sheetEl.parentNode) this.sheetEl.parentNode.removeChild(this.sheetEl);
    this.sheetEl = null;
  }

  /** Ficha completa do ativo com os botões de mudar estado. */
  openDetailSheet(eq) {
    this.closeSheet();

    const info = STATUS_INFO[eq.status] || STATUS_INFO.ok;
    const nReports = this.reportCounts.get(eq.id) || 0;

    const overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay d-sheet-overlay';
    overlay.innerHTML = `
      <div class="bottom-sheet-content d-sheet" role="dialog" aria-modal="true">
        <div class="sheet-drag-handle"><span class="drag-bar"></span></div>

        <div class="d-sheet-head">
          <h3 class="d-sheet-title">${esc(eq.name)}</h3>
          <button type="button" class="btn-close-detail" data-close="1" aria-label="Fechar">&times;</button>
        </div>

        <p class="d-sheet-crumbs">Estádio Municipal de Leiria / ${esc(eq.locationName || 'sem local')}</p>
        <p class="d-equip-status ${info.cls}" id="d-sheet-status">${esc(info.label)}</p>

        <dl class="d-spec-list">
          ${this.specRow('Categoria', CATEGORY_LABELS[eq.category] || eq.category)}
          ${this.specRow('Marca', eq.brand)}
          ${this.specRow('Modelo', eq.model)}
          ${this.specRow('Número de série', eq.serial)}
          ${this.specRow('Instalado em', this.fmtDate(eq.installedAt))}
          ${this.specRow('Notas', eq.notes)}
        </dl>

        <p class="d-warranty ${this.warrantyClass(eq.warrantyUntil)}">${esc(this.warrantyText(eq.warrantyUntil))}</p>

        <p class="d-field-label">Mudar estado</p>
        <div class="d-status-row">
          ${Object.keys(STATUS_INFO).map(s => `
            <button type="button" class="d-status-btn ${STATUS_INFO[s].cls}${eq.status === s ? ' active' : ''}" data-status="${esc(s)}">${esc(STATUS_INFO[s].label)}</button>
          `).join('')}
        </div>

        <button type="button" class="d-btn-primary-wide" id="d-sheet-fault">Registar intervenção</button>
        ${nReports > 0 ? `<button type="button" class="d-btn-quiet-wide" id="d-sheet-reports">Ver intervenções (${nReports})</button>` : ''}
        <button type="button" class="d-btn-quiet-wide" data-close="1">Fechar</button>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeSheet();
    });
    document.body.appendChild(overlay);
    this.sheetEl = overlay;

    overlay.querySelectorAll('[data-close="1"]').forEach(b => b.addEventListener('click', () => this.closeSheet()));

    overlay.querySelectorAll('.d-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        if (status === eq.status) return;
        btn.disabled = true;
        try {
          const updated = await equipmentRepo.setStatus(eq.id, status);
          eq.status = updated.status;

          const idx = this.allEquipment.findIndex(x => x.id === eq.id);
          if (idx >= 0) this.allEquipment[idx] = updated;

          const nextInfo = STATUS_INFO[updated.status] || STATUS_INFO.ok;
          const sheetStatus = overlay.querySelector('#d-sheet-status');
          if (sheetStatus) {
            sheetStatus.textContent = nextInfo.label;
            sheetStatus.className = `d-equip-status ${nextInfo.cls}`;
          }
          overlay.querySelectorAll('.d-status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === updated.status));

          const cardStatus = this.container.querySelector(`[data-status-for="${cssEscape(eq.id)}"]`);
          if (cardStatus) {
            cardStatus.textContent = nextInfo.label;
            cardStatus.className = `d-equip-status ${nextInfo.cls}`;
          }
          const card = this.container.querySelector(`.d-equip-card[data-equip-id="${cssEscape(eq.id)}"]`);
          if (card) {
            Object.values(STATUS_INFO).forEach(i => card.classList.remove(i.cls));
            card.classList.add(nextInfo.cls);
          }

          const brokenHost = this.container.querySelector('#equip-broken-block');
          if (brokenHost) brokenHost.innerHTML = this.renderBrokenBlock();

          toast.success(`Estado alterado para ${nextInfo.label.toLowerCase()}`);
        } catch (err) {
          toast.error(err && err.message ? err.message : 'Não foi possível mudar o estado');
        } finally {
          btn.disabled = false;
        }
      });
    });

    const fault = overlay.querySelector('#d-sheet-fault');
    if (fault) fault.addEventListener('click', () => {
      this.closeSheet();
      if (this.onNewReportForEquipment) this.onNewReportForEquipment(eq);
      else toast.info('Registo de intervenção ainda não ligado neste ecrã');
    });

    const reps = overlay.querySelector('#d-sheet-reports');
    if (reps) reps.addEventListener('click', () => {
      this.closeSheet();
      if (this.onViewEquipmentReports) this.onViewEquipmentReports(eq);
      else toast.info('Lista de intervenções ainda não ligada neste ecrã');
    });
  }

  specRow(label, value) {
    if (!value) return '';
    return `
      <div class="d-spec-row">
        <dt class="d-spec-key">${esc(label)}</dt>
        <dd class="d-spec-val">${esc(value)}</dd>
      </div>
    `;
  }

  // -------------------------------------------------------------- garantia

  warrantyClass(iso) {
    if (!iso) return 'is-unknown';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'is-unknown';
    return d.getTime() >= Date.now() ? 'is-valid' : 'is-expired';
  }

  warrantyText(iso) {
    if (!iso) return 'Garantia: sem data registada.';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Garantia: sem data registada.';
    const when = this.fmtDate(iso);
    return d.getTime() >= Date.now()
      ? `Ainda dentro da garantia, até ${when}.`
      : `Garantia terminou em ${when}. A reparação é paga.`;
  }

  // -------------------------------------------------------------- helpers

  fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
