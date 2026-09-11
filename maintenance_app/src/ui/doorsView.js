import { doorsRepo, DOOR_TYPES, DOOR_SIDES, DOOR_FLOORS } from '../db/doorsRepo.js';
import { reportsRepo } from '../db/reportsRepo.js';
import { toast } from './toast.js';
import { canCurrentUserEditDoors } from '../services/profile.js';

import { esc, reportListHtml } from '../utils/html.js';

/** Rótulos em português dos tipos normalizados. */
const TYPE_LABELS = {
  tecnica: 'Técnica',
  wc: 'WC',
  arrecadacao: 'Arrecadação',
  passagem: 'Passagem',
  persiana: 'Persiana',
  camarote: 'Camarote',
  posto_medico: 'Posto Médico',
  gabinete: 'Gabinete',
  desportiva: 'Desportiva',
  bar: 'Bar',
  geral: 'Geral'
};

/** Rótulos dos lados. O técnico diz "nascente", não "SEC_NASCENTE". */
const SIDE_LABELS = {
  nascente: 'Nascente',
  poente: 'Poente',
  sul: 'Sul'
};

/** Combining diacritical marks range (U+0300..U+036F). */
const DIACRITICS_RE = new RegExp('[\u0300-\u036f]', 'g');

/** Rótulos e classe de cor de cada estado, iguais aos do Equipamento. */
const STATUS_INFO = {
  ok: { label: 'Em serviço', cls: 'is-ok' },
  avariado: { label: 'Avariada', cls: 'is-broken' },
  manutencao: { label: 'Em manutenção', cls: 'is-maint' },
  abatido: { label: 'Abatida', cls: 'is-retired' }
};

/** Nome do piso por extenso. "-1" sozinho não diz nada de luvas e ao sol. */
function floorLabel(piso) {
  if (piso === -1) return 'Cave';
  if (piso === 0) return 'Piso 0';
  return 'Piso ' + piso;
}

/**
 * Ecrã de PORTAS — o chaveiro do Estádio Municipal de Leiria.
 *
 * São 464 portas. Uma lista corrida de 464 cartões é inútil no telemóvel, por
 * isso o ecrã abre já filtrado: primeiro escolhe-se o lado, depois o piso. A
 * caixa de pesquisa aceita o número novo e o número antigo da chave, que é
 * como o técnico realmente procura ("dá-me a 9026").
 */
export class DoorsViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNewReportForDoor = options.onNewReportForDoor || null;
    this.onOpenReport = options.onOpenReport || null;

    this.allDoors = [];
    this.filtered = [];
    this.searchQuery = '';
    this.activeSide = 'all';
    this.activeFloor = 'all';
    this.activeType = 'all';
    this.sheetEl = null;
  }

  // ---------------------------------------------------------------- render

  async render() {
    if (!this.container) return;

    await this.load();

    this.container.innerHTML = `
      <section class="doors-view animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Portas</h2>
            <p class="section-subtitle">O chaveiro do estádio</p>
          </div>
          <span class="section-badge">${this.allDoors.length} portas</span>
        </div>

        <div id="doors-broken-block">${this.renderBrokenBlock()}</div>

        <div class="search-bar">
          <span class="search-icon-svg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="input-search-doors" class="form-input search-input"
                 placeholder="Número da porta ou da chave antiga..." value="${esc(this.searchQuery)}" />
        </div>

        <p class="pt-filter-label">Lado</p>
        <div class="d-cat-row">
          <button type="button" class="d-cat-pill${this.activeSide === 'all' ? ' active' : ''}" data-side="all">Todos</button>
          ${DOOR_SIDES.map(s => `
            <button type="button" class="d-cat-pill${this.activeSide === s ? ' active' : ''}" data-side="${esc(s)}">${esc(SIDE_LABELS[s] || s)}</button>
          `).join('')}
        </div>

        <p class="pt-filter-label">Piso</p>
        <div class="d-cat-row">
          <button type="button" class="d-cat-pill${this.activeFloor === 'all' ? ' active' : ''}" data-floor="all">Todos</button>
          ${DOOR_FLOORS.map(f => `
            <button type="button" class="d-cat-pill${this.activeFloor === String(f) ? ' active' : ''}" data-floor="${esc(String(f))}">${esc(floorLabel(f))}</button>
          `).join('')}
        </div>

        <p class="pt-filter-label">Tipo</p>
        <div class="d-cat-row">
          <button type="button" class="d-cat-pill${this.activeType === 'all' ? ' active' : ''}" data-type="all">Todos</button>
          ${DOOR_TYPES.map(t => `
            <button type="button" class="d-cat-pill${this.activeType === t ? ' active' : ''}" data-type="${esc(t)}">${esc(TYPE_LABELS[t] || t)}</button>
          `).join('')}
        </div>

        <p class="pt-count" id="doors-count" aria-live="polite">${this.countText()}</p>

        <div class="d-card-list" id="doors-list">
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
      let items = await doorsRepo.getAll();
      if (!items.length) {
        await doorsRepo.seedDefaults();
        items = await doorsRepo.getAll();
      }
      this.allDoors = items;
    } catch (e) {
      console.error('[Portas] Erro ao carregar:', e);
      this.allDoors = [];
    }
    this.applyFilter();
  }

  applyFilter() {
    const q = this.norm(this.searchQuery);
    this.filtered = this.allDoors.filter(d => {
      if (this.activeSide !== 'all' && d.lado !== this.activeSide) return false;
      if (this.activeFloor !== 'all' && String(d.piso) !== this.activeFloor) return false;
      if (this.activeType !== 'all' && d.tipo !== this.activeType) return false;
      if (!q) return true;
      return this.norm(d.numero).includes(q) ||
             this.norm(d.numeroAntigo).includes(q) ||
             this.norm(d.descricao).includes(q) ||
             this.norm(d.areaOriginal).includes(q);
    });
  }

  countText() {
    const n = this.filtered.length;
    if (n === 0) return 'Nenhuma porta encontrada.';
    if (n === 1) return '1 porta à vista.';
    return `${n} portas à vista.`;
  }

  // ------------------------------------------------------------- avariadas

  renderBrokenBlock() {
    const broken = this.allDoors.filter(d => d.status === 'avariado');
    if (!broken.length) return '';
    return `
      <div class="d-alert d-alert-danger">
        <p class="d-alert-title">Avariadas (${broken.length})</p>
        <ul class="d-alert-list">
          ${broken.map(d => `
            <li class="d-alert-line">
              <span class="d-alert-name">Porta ${esc(d.numero)}</span>
              <span class="d-alert-where">${esc(d.descricao || '')}</span>
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
          <h3 class="empty-title">Nenhuma porta encontrada</h3>
          <p class="empty-desc">Limpa a pesquisa ou escolhe outro lado ou piso.</p>
        </div>
      `;
    }

    // Agrupa por lado e piso: é assim que o técnico anda pelo estádio.
    const groups = new Map();
    for (const d of this.filtered) {
      const key = `${SIDE_LABELS[d.lado] || d.lado} · ${floorLabel(d.piso)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }

    return Array.from(groups.entries()).map(([key, list]) => `
      <div class="d-loc-group">
        <div class="d-loc-head">
          <h3 class="d-loc-name">${esc(key)}</h3>
          <span class="d-loc-count">${list.length}</span>
        </div>
        <div class="pt-row-list">
          ${list.map(d => this.renderDoorRow(d)).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Uma linha por porta. O número vem primeiro e grande: é o que o técnico
   * lê na chave que tem na mão.
   */
  renderDoorRow(d) {
    const info = STATUS_INFO[d.status] || STATUS_INFO.ok;
    return `
      <button type="button" class="pt-row touch-target ${info.cls}" data-door-id="${esc(d.id)}"
              aria-label="Porta ${esc(d.numero)}, ${esc(d.descricao || 'sem descrição')}">
        <span class="pt-num">${esc(d.numero)}</span>
        <span class="pt-body">
          <span class="pt-desc">${esc(d.descricao || 'Sem descrição')}</span>
          <span class="pt-meta">${esc(TYPE_LABELS[d.tipo] || d.tipo)}${d.numeroAntigo ? ' · chave ' + esc(d.numeroAntigo) : ''}</span>
        </span>
        ${d.status !== 'ok' ? `<span class="pt-flag ${info.cls}" data-status-for="${esc(d.id)}">${esc(info.label)}</span>` : ''}
      </button>
    `;
  }

  // --------------------------------------------------------------- events

  bindEvents() {
    if (!this.container) return;

    const search = this.container.querySelector('#input-search-doors');
    if (search) {
      search.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        // Espera 250 ms sem escrever antes de redesenhar (igual ao histórico).
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.searchTimer = null;
          this.refreshList();
        }, 250);
      });
    }

    this.bindPillRow('data-side', 'activeSide');
    this.bindPillRow('data-floor', 'activeFloor');
    this.bindPillRow('data-type', 'activeType');

    this.bindRowEvents();
  }

  /** Liga uma fila de botões de filtro ao campo de estado correspondente. */
  bindPillRow(attr, field) {
    const pills = this.container.querySelectorAll(`.d-cat-pill[${attr}]`);
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        this[field] = pill.getAttribute(attr);
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.refreshList();
      });
    });
  }

  refreshList() {
    this.applyFilter();
    const list = this.container.querySelector('#doors-list');
    if (list) {
      list.innerHTML = this.renderGroups();
      this.bindRowEvents();
    }
    const count = this.container.querySelector('#doors-count');
    if (count) count.textContent = this.countText();
  }

  bindRowEvents() {
    if (!this.container) return;
    this.container.querySelectorAll('.pt-row[data-door-id]').forEach(row => {
      row.addEventListener('click', () => {
        const door = this.allDoors.find(x => x.id === row.dataset.doorId);
        if (door) this.openDetailSheet(door);
      });
    });
  }

  // --------------------------------------------------------------- sheet

  closeSheet() {
    if (this.sheetEl && this.sheetEl.parentNode) this.sheetEl.parentNode.removeChild(this.sheetEl);
    this.sheetEl = null;
  }

  /** Ficha da porta com os botões de mudar estado. */
  openDetailSheet(door) {
    this.closeSheet();

    const info = STATUS_INFO[door.status] || STATUS_INFO.ok;
    const canEditDoors = canCurrentUserEditDoors();

    const overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay d-sheet-overlay';
    overlay.innerHTML = `
      <div class="bottom-sheet-content d-sheet" role="dialog" aria-modal="true">
        <div class="sheet-drag-handle"><span class="drag-bar"></span></div>

        <div class="d-sheet-head">
          <h3 class="d-sheet-title">Porta ${esc(door.numero)}</h3>
          <button type="button" class="btn-close-detail" data-close="1" aria-label="Fechar">&times;</button>
        </div>

        <p class="d-sheet-crumbs">${esc(door.sectorName || '')} / ${esc(floorLabel(door.piso))}</p>
        <p class="d-equip-status ${info.cls}" id="d-sheet-status">${esc(info.label)}</p>

        <dl class="d-spec-list">
          ${this.specRow('Descrição', door.descricao)}
          ${this.specRow('Tipo', TYPE_LABELS[door.tipo] || door.tipo)}
          ${this.specRow('Número da chave antiga', door.numeroAntigo)}
          ${this.specRow('Lado', SIDE_LABELS[door.lado] || door.lado)}
          ${this.specRow('Piso', floorLabel(door.piso))}
          ${this.specRow('Área no chaveiro', door.areaOriginal)}
          ${this.specRow('Notas', door.notas)}
        </dl>

        <p class="d-field-label">Mudar estado</p>
        ${!canEditDoors ? `
          <div class="d-perm-notice">
            <span>🔒 Apenas administradores podem alterar o estado da porta. Como técnico, pode registar uma intervenção abaixo.</span>
          </div>
        ` : ''}
        <div class="d-status-row${canEditDoors ? '' : ' is-disabled'}">
          ${Object.keys(STATUS_INFO).map(s => `
            <button type="button" class="d-status-btn ${STATUS_INFO[s].cls}${door.status === s ? ' active' : ''}" data-status="${esc(s)}" ${canEditDoors ? '' : 'disabled title="Apenas administradores podem alterar o estado" aria-disabled="true"'}>${esc(STATUS_INFO[s].label)}</button>
          `).join('')}
        </div>

        <button type="button" class="d-btn-primary-wide" id="d-sheet-fault">Registar intervenção</button>
        <button type="button" class="d-btn-quiet-wide" id="d-sheet-reports">Ver intervenções</button>
        <div id="d-sheet-replist" hidden></div>
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
        if (!canCurrentUserEditDoors()) {
          toast.warning('Apenas administradores podem alterar o estado da porta.');
          return;
        }
        const status = btn.dataset.status;
        if (status === door.status) return;
        btn.disabled = true;
        try {
          const updated = await doorsRepo.setStatus(door.id, status);
          door.status = updated.status;

          const idx = this.allDoors.findIndex(x => x.id === door.id);
          if (idx >= 0) this.allDoors[idx] = updated;

          const nextInfo = STATUS_INFO[updated.status] || STATUS_INFO.ok;
          const sheetStatus = overlay.querySelector('#d-sheet-status');
          if (sheetStatus) {
            sheetStatus.textContent = nextInfo.label;
            sheetStatus.className = `d-equip-status ${nextInfo.cls}`;
          }
          overlay.querySelectorAll('.d-status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === updated.status));

          this.refreshList();
          const brokenHost = this.container.querySelector('#doors-broken-block');
          if (brokenHost) brokenHost.innerHTML = this.renderBrokenBlock();

          toast.success(`Porta ${updated.numero}: ${nextInfo.label.toLowerCase()}`);
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
      if (this.onNewReportForDoor) this.onNewReportForDoor(door);
      else toast.info('Registo de intervenção ainda não ligado neste ecrã');
    });

    const reps = overlay.querySelector('#d-sheet-reports');
    const replist = overlay.querySelector('#d-sheet-replist');
    if (reps && replist) reps.addEventListener('click', async () => {
      if (!replist.hidden) {
        replist.hidden = true;
        return;
      }
      replist.hidden = false;
      replist.innerHTML = '<p class="d-sheet-sub">A carregar…</p>';
      try {
        const rows = await reportsRepo.getByDoorId(door.id, door.sectorCode || '');
        replist.innerHTML = reportListHtml(rows);
        replist.querySelectorAll('[data-report-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (this.onOpenReport) {
              this.closeSheet();
              this.onOpenReport(btn.dataset.reportId);
            }
          });
        });
      } catch (err) {
        console.error('[Portas] histórico:', err);
        replist.innerHTML = '<p class="d-sheet-sub">Não foi possível carregar.</p>';
      }
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

  // -------------------------------------------------------------- helpers

  norm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(DIACRITICS_RE, '')
      .toLowerCase()
      // O chaveiro mistura "13a" com "480 a": sem isto, pesquisar "480a"
      // não encontrava "480 a" e o técnico ficava sem a porta. Os dados
      // ficam exatamente como estão — só a pesquisa ignora os espaços.
      .replace(/\s+/g, '')
      .trim();
  }
}
