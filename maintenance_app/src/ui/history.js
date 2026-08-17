import { reportsRepo } from '../db/reportsRepo.js';
import { getPhotoDataUrl } from '../db/db.js';
import { toast } from './toast.js';

import { esc } from '../utils/html.js';
import { haptics } from '../services/haptics.js';
/**
 * Feed / History Component — Rich Issue Cards with Status & Priority badges,
 * instant search, fast status toggle, and filter chips.
 */
export class HistoryComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onReportClick = options.onReportClick || null;
    this.onEdit = options.onEdit || null;
    this.onDelete = options.onDelete || null;
    this.allReports = [];
    this.filteredReports = [];
    this.searchQuery = '';
    this.activeFilter = options.initialFilter || 'all'; // 'all' | 'critical' | 'pending' | 'in_progress' | 'resolved'
    this.sectorFilter = options.initialSector || null;
    // Temporizador da pesquisa: sem isto, cada tecla redesenhava a lista toda.
    this.searchTimer = null;
  }

  async render() {
    if (!this.container) return;
    try {
      this.allReports = await reportsRepo.getAll();
    } catch (e) {
      console.error('[History] Erro ao carregar:', e);
    }

    this.applyFilters();

    const sectorFilterNotice = this.sectorFilter ? `
      <div class="active-sector-filter-badge">
        <span>Filtro Setor: <strong>${esc(this.sectorFilter)}</strong></span>
        <button type="button" class="btn-clear-sector" id="btn-clear-sector-filter">&times;</button>
      </div>
    ` : '';

    this.container.innerHTML = `
      <section class="history-view animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Intervenções & Ocorrências</h2>
            <p class="section-subtitle">Registo e Acompanhamento de Trabalhos</p>
          </div>
          <span class="section-badge">${this.filteredReports.length} filtradas</span>
        </div>

        <!-- Search Bar -->
        <div class="search-bar">
          <span class="search-icon-svg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="input-search-reports" class="form-input search-input" placeholder="Pesquisar setor, intervenção, material..." value="${esc(this.searchQuery)}" />
          ${this.searchQuery ? '<button type="button" id="btn-clear-search" class="btn-clear-search">&times;</button>' : ''}
        </div>

        ${sectorFilterNotice}

        <!-- Filter Chips Carousel -->
        <div class="filter-chips-row">
          <button type="button" class="filter-chip ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
          <button type="button" class="filter-chip crit ${this.activeFilter === 'critical' ? 'active' : ''}" data-filter="critical">Críticas</button>
          <button type="button" class="filter-chip ${this.activeFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pendentes</button>
          <button type="button" class="filter-chip inprog ${this.activeFilter === 'in_progress' ? 'active' : ''}" data-filter="in_progress">Em Curso</button>
          <button type="button" class="filter-chip done ${this.activeFilter === 'resolved' ? 'active' : ''}" data-filter="resolved">Resolvidos</button>
        </div>

        <!-- Issue Feed List -->
        <div class="reports-feed-list" id="history-list">
          ${this.renderFeedList()}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  applyFilters() {
    this.filteredReports = this.allReports.filter(r => {
      // Sector filter
      if (this.sectorFilter) {
        const matchSector = (r.sectorCode === this.sectorFilter) || 
                            (r.locationId === this.sectorFilter) ||
                            (r.locationName || '').toLowerCase().includes(this.sectorFilter.toLowerCase());
        if (!matchSector) return false;
      }

      // Status / Priority filter
      if (this.activeFilter === 'critical' && r.priority !== 'critical') return false;
      if (this.activeFilter === 'pending' && (r.status !== 'pending' && r.status !== undefined)) return false;
      if (this.activeFilter === 'in_progress' && r.status !== 'in_progress') return false;
      if (this.activeFilter === 'resolved' && r.status !== 'resolved') return false;

      // Text query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const inLoc = (r.locationName || '').toLowerCase().includes(q);
        const inDesc = (r.description || '').toLowerCase().includes(q);
        const inMat = (r.materials || '').toLowerCase().includes(q);
        if (!inLoc && !inDesc && !inMat) return false;
      }

      return true;
    });
  }

  renderFeedList() {
    if (!this.filteredReports.length) {
      return `
        <div class="empty-state animate-fade-in">
          <div class="empty-icon-svg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m9.17 14.83-4.24 4.24"></path></svg>
          </div>
          <h3 class="empty-title">${this.searchQuery || this.activeFilter !== 'all' ? 'Nenhuma ocorrência encontrada' : 'Sem registos de manutenção'}</h3>
          <p class="empty-desc">Tente ajustar os filtros ou registar uma nova intervenção.</p>
        </div>
      `;
    }

    return this.filteredReports.map((r, i) => this.renderReportCard(r, i)).join('');
  }

  renderReportCard(report, index) {
    const date = new Date(report.date || Date.now());
    const dateStr = date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
    const timeStr = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    const priority = report.priority || 'medium';
    const status = report.status || 'pending';

    const priorityLabels = {
      critical: { label: 'CRÍTICO', cls: 'crit' },
      medium: { label: 'MÉDIO', cls: 'med' },
      low: { label: 'BAIXO', cls: 'low' }
    };
    const pInfo = priorityLabels[priority] || priorityLabels.medium;

    const statusLabels = {
      resolved: { label: 'Resolvido', cls: 'resolved', next: null },
      in_progress: { label: 'Em Curso', cls: 'in_progress', next: 'resolved', nextLabel: 'Concluir' },
      pending: { label: 'Pendente', cls: 'pending', next: 'in_progress', nextLabel: 'Iniciar' }
    };
    const sInfo = statusLabels[status] || statusLabels.pending;

    // Has photo indicator
    const hasPhotos = Array.isArray(report.photos) && report.photos.length > 0;

    return `
      <div class="issue-card animate-fade-in priority-${priority} status-${status}" 
           data-report-id="${report.id}" 
           style="--stagger-index:${index}">
        
        <div class="issue-card-header">
          <div class="issue-location-wrap">
            <span class="issue-sector-badge">${esc(report.locationName || 'Estádio')}</span>
            <span class="issue-time-meta">${dateStr} · ${timeStr}</span>
          </div>
          <div class="issue-badges-row">
            <span class="chip-priority ${pInfo.cls}">${pInfo.label}</span>
            <span class="chip-status ${sInfo.cls}">${sInfo.label}</span>
          </div>
        </div>

        <div class="issue-card-body">
          <p class="issue-description">${esc(report.description || '')}</p>

          <!-- Multimedia badges -->
          <div class="issue-media-tags">
            ${hasPhotos ? `
              <span class="media-tag photo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                ${report.photos.length} Foto${report.photos.length > 1 ? 's' : ''}
              </span>
            ` : ''}
            ${report.timeSpent ? `
              <span class="media-tag time">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${report.timeSpent} min
              </span>
            ` : ''}
          </div>
        </div>

        <div class="issue-card-footer">
          <div class="sync-indicator ${report.synced ? 'synced' : 'pending'}">
            <span class="sync-dot"></span>
            ${report.synced ? 'Sincronizado' : 'Local'}
          </div>

          <div class="issue-card-actions" style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn-card-edit" data-id="${report.id}" style="background:transparent; border:none; color:var(--color-text-secondary); cursor:pointer; font-size:0.9rem; padding:4px 6px;" title="Editar Intervenção">✎</button>
            <button type="button" class="btn-card-del" data-id="${report.id}" style="background:transparent; border:none; color:var(--color-danger); cursor:pointer; font-size:1.1rem; padding:4px 6px;" title="Eliminar Intervenção">&times;</button>
            ${sInfo.next ? `
              <button type="button" class="btn-fast-advance" data-action="advance" data-next="${sInfo.next}" data-id="${report.id}">
                ${sInfo.nextLabel} ➔
              </button>
            ` : `
              <span class="resolved-check">✓ Concluído</span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    // Search input
    const searchInput = this.container.querySelector('#input-search-reports');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        // Espera 250 ms sem escrever antes de redesenhar. Escrever "relvado"
        // passa de 7 redesenhos completos da lista para 1.
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.searchTimer = null;
          this.refreshFeed();
        }, 250);
      });
    }

    const clearSearch = this.container.querySelector('#btn-clear-search');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        if (searchInput) searchInput.value = '';
        this.refreshFeed();
      });
    }

    // Sector clear
    const clearSector = this.container.querySelector('#btn-clear-sector-filter');
    if (clearSector) {
      clearSector.addEventListener('click', () => {
        this.sectorFilter = null;
        this.render();
      });
    }

    // Filter chips
    this.container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.refreshFeed();
      });
    });

    this.bindCardClicks();
  }

  bindCardClicks() {
    if (!this.container) return;

    // Card click -> open detail
    this.container.querySelectorAll('.issue-card[data-report-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-fast-advance') || e.target.closest('.btn-card-edit') || e.target.closest('.btn-card-del')) return;
        const id = card.dataset.reportId;
        if (id && this.onReportClick) this.onReportClick(id);
      });
    });

    // Quick Edit button
    this.container.querySelectorAll('.btn-card-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id && this.onEdit) this.onEdit(id);
      });
    });

    // Quick Delete button
    this.container.querySelectorAll('.btn-card-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm('Tem a certeza que pretende eliminar esta intervenção?')) return;
        try {
          await reportsRepo.remove(id);
          // Dois toques em vez de um: eliminar não deve sentir-se igual a gravar.
          haptics.warning();
          toast.success('Intervenção eliminada');
          await this.render();
          if (this.onDelete) this.onDelete(id);
        } catch (err) {
          toast.error('Erro ao eliminar');
        }
      });
    });

    // Fast advance button
    this.container.querySelectorAll('.btn-fast-advance').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const nextStatus = btn.dataset.next;
        try {
          await reportsRepo.setStatus(id, nextStatus);
          haptics.success();
          toast.success(nextStatus === 'resolved' ? 'Intervenção concluída!' : 'Trabalho em curso!');
          await this.render();
        } catch (err) {
          toast.error('Erro ao atualizar estado');
        }
      });
    });
  }

  refreshFeed() {
    this.applyFilters();
    const feed = this.container.querySelector('#history-list');
    if (feed) {
      feed.innerHTML = this.renderFeedList();
      this.bindCardClicks();
    }
    const badge = this.container.querySelector('.section-badge');
    if (badge) badge.textContent = `${this.filteredReports.length} filtradas`;
  }

  setSectorFilter(sectorCode) {
    this.sectorFilter = sectorCode;
    this.render();
  }

  async refresh() { await this.render(); }

}
