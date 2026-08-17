import { reportsRepo } from '../db/reportsRepo.js';
import { PdfService } from '../services/pdfService.js';
import { toast } from './toast.js';

const WEEKDAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function startOfWeek(d) {
  const day = d.getDay(); // 0=domingo
  const diffToMonday = day === 0 ? 6 : day - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

const PERIODS = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mês' },
  { id: 'custom', label: 'Intervalo' }
];

/**
 * Ecrã "Relatórios" — junta as intervenções de um período (dia/semana/mês/intervalo),
 * opcionalmente filtradas por área, e gera um PDF único com todo o trabalho feito,
 * incluindo as fotos.
 */
export class ReportsViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.period = 'today';
    this.customStart = this.toDateInputValue(new Date());
    this.customEnd = this.toDateInputValue(new Date());
    this.sectorFilter = '';
    this.allReports = [];
    this.filtered = [];
  }

  toDateInputValue(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  getRange() {
    const now = new Date();
    if (this.period === 'today') {
      const start = startOfDay(now);
      return { start, end: new Date(start.getTime() + WEEKDAY_MS), label: 'Relatório Diário', rangeText: start.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) };
    }
    if (this.period === 'week') {
      const start = startOfWeek(now);
      const end = new Date(start.getTime() + 7 * WEEKDAY_MS);
      return { start, end, label: 'Relatório Semanal', rangeText: `${start.toLocaleDateString('pt-PT')} a ${new Date(end.getTime() - WEEKDAY_MS).toLocaleDateString('pt-PT')}` };
    }
    if (this.period === 'month') {
      const start = startOfMonth(now);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { start, end, label: 'Relatório Mensal', rangeText: start.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) };
    }
    // custom
    const start = new Date(`${this.customStart}T00:00:00`);
    const end = new Date(new Date(`${this.customEnd}T00:00:00`).getTime() + WEEKDAY_MS);
    return { start, end, label: 'Relatório Personalizado', rangeText: `${start.toLocaleDateString('pt-PT')} a ${new Date(end.getTime() - WEEKDAY_MS).toLocaleDateString('pt-PT')}` };
  }

  async loadAndFilter() {
    const { start, end } = this.getRange();
    try {
      this.allReports = await reportsRepo.getBetween(start.toISOString(), end.toISOString());
    } catch (e) {
      console.error('[ReportsView] Erro ao carregar intervenções:', e);
      this.allReports = [];
    }

    this.filtered = this.sectorFilter
      ? this.allReports.filter(r => (r.locationName || '') === this.sectorFilter)
      : this.allReports;
  }

  async render() {
    if (!this.container) return;
    await this.loadAndFilter();

    const sectorOptions = Array.from(new Set(this.allReports.map(r => r.locationName).filter(Boolean))).sort();
    const totalPhotos = this.filtered.reduce((sum, r) => sum + (Array.isArray(r.photos) ? r.photos.length : 0), 0);
    const critical = this.filtered.filter(r => r.priority === 'critical').length;
    const resolved = this.filtered.filter(r => r.status === 'resolved').length;

    this.container.innerHTML = `
      <section class="reports-view animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Relatórios</h2>
            <p class="section-subtitle">Junta o trabalho feito num período, com fotos</p>
          </div>
        </div>

        <div class="filter-chips-row" id="rv-period-chips">
          ${PERIODS.map(p => `<button type="button" class="filter-chip ${this.period === p.id ? 'active' : ''}" data-period="${p.id}">${p.label}</button>`).join('')}
        </div>

        ${this.period === 'custom' ? `
          <div class="form-group" style="display:flex; gap:10px; margin-bottom:14px;">
            <div style="flex:1;">
              <label class="form-label" for="rv-start">De</label>
              <input type="date" id="rv-start" class="form-input" value="${this.customStart}" />
            </div>
            <div style="flex:1;">
              <label class="form-label" for="rv-end">Até</label>
              <input type="date" id="rv-end" class="form-input" value="${this.customEnd}" />
            </div>
          </div>
        ` : ''}

        ${sectorOptions.length > 0 ? `
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" for="rv-sector">Área do estádio</label>
            <select id="rv-sector" class="form-input">
              <option value="">Todas as áreas</option>
              ${sectorOptions.map(name => `<option value="${this.esc(name)}" ${this.sectorFilter === name ? 'selected' : ''}>${this.esc(name)}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">${this.filtered.length}</div><div class="kpi-label">Intervenções</div></div>
          <div class="kpi-card"><div class="kpi-value" style="${critical > 0 ? 'color:var(--color-danger);' : ''}">${critical}</div><div class="kpi-label">Críticas</div></div>
          <div class="kpi-card"><div class="kpi-value">${resolved}</div><div class="kpi-label">Resolvidas</div></div>
          <div class="kpi-card"><div class="kpi-value">${totalPhotos}</div><div class="kpi-label">Fotos</div></div>
        </div>

        <button type="button" class="d-btn-primary-wide" id="rv-generate" ${this.filtered.length === 0 ? 'disabled' : ''}>
          Gerar Relatório em PDF
        </button>

        <div class="reports-feed-list" id="rv-preview-list" style="margin-top:20px;">
          ${this.renderPreviewList()}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  renderPreviewList() {
    if (!this.filtered.length) {
      return `
        <div class="empty-state animate-fade-in">
          <h3 class="empty-title">Sem intervenções neste período</h3>
          <p class="empty-desc">Escolha outro período ou outra área.</p>
        </div>
      `;
    }
    return this.filtered.map(r => {
      const date = new Date(r.date || Date.now());
      const dateStr = date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
      const hasPhotos = Array.isArray(r.photos) && r.photos.length > 0;
      return `
        <div class="issue-card priority-${r.priority || 'medium'} status-${r.status || 'pending'}">
          <div class="issue-card-header">
            <div class="issue-location-wrap">
              <span class="issue-sector-badge">${this.esc(r.locationName || 'Estádio')}</span>
              <span class="issue-time-meta">${dateStr}</span>
            </div>
          </div>
          <div class="issue-card-body">
            <p class="issue-description">${this.esc(r.description || '')}</p>
            ${hasPhotos ? `<div class="issue-media-tags"><span class="media-tag photo">${r.photos.length} Foto${r.photos.length > 1 ? 's' : ''}</span></div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    this.container.querySelectorAll('#rv-period-chips .filter-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        this.period = chip.dataset.period;
        await this.render();
      });
    });

    const startInput = this.container.querySelector('#rv-start');
    const endInput = this.container.querySelector('#rv-end');
    if (startInput) startInput.addEventListener('change', async (e) => { this.customStart = e.target.value; await this.render(); });
    if (endInput) endInput.addEventListener('change', async (e) => { this.customEnd = e.target.value; await this.render(); });

    const sectorSelect = this.container.querySelector('#rv-sector');
    if (sectorSelect) {
      sectorSelect.addEventListener('change', async (e) => {
        this.sectorFilter = e.target.value;
        await this.render();
      });
    }

    const generateBtn = this.container.querySelector('#rv-generate');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (!this.filtered.length) return;
        const { label, rangeText } = this.getRange();
        PdfService.exportSummaryReport(this.filtered, {
          periodLabel: label,
          rangeText,
          sectorLabel: this.sectorFilter || 'Todas as áreas'
        });
        toast.success('Relatório gerado. Escolha "Guardar como PDF" na janela de impressão.');
      });
    }
  }

  async refresh() { await this.render(); }

  esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
