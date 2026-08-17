import { reportsRepo } from '../db/reportsRepo.js';
import { locationsRepo } from '../db/locationsRepo.js';

import { esc } from '../utils/html.js';
/**
 * Stadium Navigator Component — Hierarchical Sectors & Technical Rooms Explorer
 * Powered dynamically by Dexie IndexedDB (locationsRepo).
 * Mobile-first structured facility browser with 1-tap drill-down, live issue badges,
 * instant room search, and quick issue creation pre-filling exact stadium locations.
 */
export class StadiumNavigatorComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onSelectRoom = options.onSelectRoom || null;
    this.onNewReportForRoom = options.onNewReportForRoom || null;
    this.onViewRoomReports = options.onViewRoomReports || null;
    this.expandedSectorId = null;
    this.searchQuery = '';
    this.filterMode = 'all'; // 'all' | 'with_issues' | 'critical'
    this.reports = [];
    this.sectors = [];
  }

  async render() {
    if (!this.container) return;

    try {
      this.reports = await reportsRepo.getAll();
      this.sectors = await locationsRepo.getGroupedBySector();
    } catch (e) {
      console.error('[StadiumNavigator] Erro ao carregar:', e);
    }

    const activeReports = this.reports.filter(r => r.status !== 'resolved');
    const criticalReports = activeReports.filter(r => r.priority === 'critical');
    const inProgressReports = activeReports.filter(r => r.status === 'in_progress');

    // Aggregate issues per room and per sector dynamically
    const stats = this.aggregateIssues(activeReports);

    this.container.innerHTML = `
      <section class="stadium-nav-view animate-fade-in">
        <!-- Top Operational Status Strip -->
        <div class="map-stats-strip">
          <div class="map-stat-pill">
            <span class="stat-dot warning"></span>
            <span class="stat-label">Ativas:</span>
            <strong class="stat-value">${activeReports.length}</strong>
          </div>
          <div class="map-stat-pill">
            <span class="stat-dot danger"></span>
            <span class="stat-label">Críticas:</span>
            <strong class="stat-value">${criticalReports.length}</strong>
          </div>
          <div class="map-stat-pill">
            <span class="stat-dot in-progress"></span>
            <span class="stat-label">Em Curso:</span>
            <strong class="stat-value">${inProgressReports.length}</strong>
          </div>
        </div>

        <div class="section-header" style="margin-top:4px;">
          <div>
            <h2 class="section-title">Setores & Instalações</h2>
            <p class="section-subtitle">Navegue pelas bancadas, salas técnicas e equipamentos</p>
          </div>
        </div>

        <!-- Room & Sector Search Bar -->
        <div class="search-bar">
          <span class="search-icon-svg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="input-search-sectors" class="form-input search-input" placeholder="Pesquisar sala, bancada, caldeira, bomba..." value="${esc(this.searchQuery)}" />
          ${this.searchQuery ? '<button type="button" id="btn-clear-sec-search" class="btn-clear-search">&times;</button>' : ''}
        </div>

        <!-- Filter Quick Pills -->
        <div class="filter-chips-row">
          <button type="button" class="filter-chip ${this.filterMode === 'all' ? 'active' : ''}" data-navfilter="all">Todos os Setores</button>
          <button type="button" class="filter-chip ${this.filterMode === 'with_issues' ? 'active' : ''}" data-navfilter="with_issues">Com Intervenções (${activeReports.length})</button>
          <button type="button" class="filter-chip crit ${this.filterMode === 'critical' ? 'active' : ''}" data-navfilter="critical">Críticas (${criticalReports.length})</button>
        </div>

        <!-- Hierarchical Sectors Accordion -->
        <div class="sectors-accordion-list" id="sectors-accordion-list">
          ${this.renderSectorsList(stats)}
        </div>
      </section>
    `;

    this.bindEvents(stats);
  }

  aggregateIssues(activeReports) {
    const stats = {
      sectors: {},
      rooms: {}
    };

    this.sectors.forEach(sec => {
      stats.sectors[sec.id] = { total: 0, critical: 0, inProgress: 0, reports: [] };
      sec.rooms.forEach(room => {
        stats.rooms[room.id] = { total: 0, critical: 0, inProgress: 0, reports: [] };
      });
    });

    activeReports.forEach(r => {
      const locId = r.locationId || '';
      const locName = (r.locationName || '').toLowerCase();

      let matchedRoomId = null;
      let matchedSectorId = null;

      // Find exact room match or name match
      for (const sec of this.sectors) {
        if (locId === sec.code || locName.includes(sec.name.toLowerCase())) {
          matchedSectorId = sec.id;
        }
        for (const room of sec.rooms) {
          if (locId === room.id || locName.includes(room.name.toLowerCase())) {
            matchedRoomId = room.id;
            matchedSectorId = sec.id;
            break;
          }
        }
        if (matchedRoomId) break;
      }

      // Default fallback match
      if (!matchedSectorId && this.sectors.length > 0) {
        matchedSectorId = this.sectors[0].id;
      }

      if (stats.sectors[matchedSectorId]) {
        stats.sectors[matchedSectorId].total++;
        if (r.priority === 'critical') stats.sectors[matchedSectorId].critical++;
        if (r.status === 'in_progress') stats.sectors[matchedSectorId].inProgress++;
        stats.sectors[matchedSectorId].reports.push(r);
      }

      if (matchedRoomId && stats.rooms[matchedRoomId]) {
        stats.rooms[matchedRoomId].total++;
        if (r.priority === 'critical') stats.rooms[matchedRoomId].critical++;
        if (r.status === 'in_progress') stats.rooms[matchedRoomId].inProgress++;
        stats.rooms[matchedRoomId].reports.push(r);
      }
    });

    return stats;
  }

  renderSectorsList(stats) {
    const q = this.searchQuery.toLowerCase().trim();

    const filteredSectors = this.sectors.map(sec => {
      const secStat = stats.sectors[sec.id] || { total: 0, critical: 0 };
      
      // Filter rooms matching query
      const matchingRooms = (sec.rooms || []).filter(r => {
        const matchesQuery = !q || r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q)) || sec.name.toLowerCase().includes(q);
        const roomStat = stats.rooms[r.id] || { total: 0, critical: 0 };
        
        if (this.filterMode === 'with_issues' && roomStat.total === 0 && secStat.total === 0) return false;
        if (this.filterMode === 'critical' && roomStat.critical === 0 && secStat.critical === 0) return false;

        return matchesQuery;
      });

      const secMatchesQuery = !q || sec.name.toLowerCase().includes(q) || (sec.description && sec.description.toLowerCase().includes(q)) || matchingRooms.length > 0;

      if (this.filterMode === 'with_issues' && secStat.total === 0 && matchingRooms.length === 0) return null;
      if (this.filterMode === 'critical' && secStat.critical === 0 && matchingRooms.length === 0) return null;

      if (!secMatchesQuery && matchingRooms.length === 0) return null;

      return {
        ...sec,
        displayRooms: q ? matchingRooms : sec.rooms,
        secStat
      };
    }).filter(Boolean);

    if (filteredSectors.length === 0) {
      return `
        <div class="empty-state animate-fade-in">
          <div class="empty-icon-svg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          </div>
          <h3 class="empty-title">Nenhum setor ou sala encontrada</h3>
          <p class="empty-desc">Tente ajustar a pesquisa ou adicionar novas salas nas Definições.</p>
        </div>
      `;
    }

    return filteredSectors.map((sec) => {
      const isExpanded = q ? true : (this.expandedSectorId === sec.id);
      const isCrit = sec.secStat.critical > 0;
      const hasIssues = sec.secStat.total > 0;

      let statusBadgeHtml = '<span class="sec-status-badge ok">Operacional</span>';
      if (isCrit) {
        statusBadgeHtml = `<span class="sec-status-badge crit">${sec.secStat.critical} Crítica${sec.secStat.critical > 1 ? 's' : ''}</span>`;
      } else if (hasIssues) {
        statusBadgeHtml = `<span class="sec-status-badge warn">${sec.secStat.total} Intervenç${sec.secStat.total > 1 ? 'ões' : 'ão'}</span>`;
      }

      return `
        <div class="sector-card ${isExpanded ? 'expanded' : ''} ${isCrit ? 'has-critical' : ''}" data-sector-id="${sec.id}">
          <div class="sector-card-header" data-action="toggle-sector" data-sector-id="${sec.id}">
            <div class="sector-header-left">
              <div class="sector-icon-box ${sec.icon || 'exterior'}">
                ${this.getSectorSvg(sec.icon || 'exterior')}
              </div>
              <div class="sector-title-wrap">
                <h3 class="sector-name">${esc(sec.name)}</h3>
                <div class="sector-meta">
                  <span>${(sec.rooms || []).length} Salas / Divisões</span>
                </div>
              </div>
            </div>
            <div class="sector-header-right">
              ${statusBadgeHtml}
              <span class="accordion-chevron ${isExpanded ? 'open' : ''}">▼</span>
            </div>
          </div>

          <!-- Expanded Sub-Rooms List -->
          <div class="rooms-container" style="${isExpanded ? 'display:block;' : 'display:none;'}">
            <div class="rooms-list">
              ${(sec.displayRooms || []).length === 0 ? '<div style="padding:14px; font-size:0.8rem; color:var(--color-text-muted);">Sem salas configuradas neste setor.</div>' : (sec.displayRooms || []).map(room => this.renderRoomRow(sec, room, stats.rooms[room.id] || { total: 0, critical: 0 })).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderRoomRow(sec, room, roomStat) {
    const isCrit = roomStat.critical > 0;
    const hasIssues = roomStat.total > 0;

    let roomBadge = '';
    if (isCrit) {
      roomBadge = `<span class="room-issue-badge crit">${roomStat.critical}</span>`;
    } else if (hasIssues) {
      roomBadge = `<span class="room-issue-badge warn">${roomStat.total}</span>`;
    }

    return `
      <div class="room-row" data-room-id="${room.id}" data-room-name="${esc(room.name)}" data-sector-code="${sec.code || sec.id}">
        <div class="room-info">
          <div class="room-name-row">
            <strong class="room-name">${esc(room.name)}</strong>
            ${roomBadge}
          </div>
          ${room.description ? `<span class="room-desc">${esc(room.description)}</span>` : ''}
        </div>
        <div class="room-actions">
          ${hasIssues ? `
            <button type="button" class="btn-room-view" data-action="view-issues" data-room-id="${room.id}" data-room-name="${esc(room.name)}" title="Ver Intervenções">
              Ver (${roomStat.total})
            </button>
          ` : ''}
          <button type="button" class="btn-room-add-issue" data-action="add-issue" data-room-id="${room.id}" data-room-name="${esc(room.name)}" data-sector-code="${sec.code || sec.id}" title="Registar Intervenção">
            + Intervenção
          </button>
        </div>
      </div>
    `;
  }

  getSectorSvg(iconType) {
    switch (iconType) {
      case 'poente':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/></svg>`;
      case 'nascente':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
      case 'norte':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      case 'sul':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
      case 'relvado':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="12" y1="4" x2="12" y2="20"></line><circle cx="12" cy="12" r="4"></circle></svg>`;
      case 'tecnica':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
      case 'exterior':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;
      default:
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg>`;
    }
  }

  bindEvents(stats) {
    if (!this.container) return;

    // Search
    const searchInput = this.container.querySelector('#input-search-sectors');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.refreshList(stats);
      });
    }

    const clearSearch = this.container.querySelector('#btn-clear-sec-search');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        if (searchInput) searchInput.value = '';
        this.refreshList(stats);
      });
    }

    // Filter Chips
    this.container.querySelectorAll('.filter-chip[data-navfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.container.querySelectorAll('.filter-chip[data-navfilter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filterMode = chip.dataset.navfilter;
        this.refreshList(stats);
      });
    });

    this.bindAccordionClicks();
  }

  bindAccordionClicks() {
    if (!this.container) return;

    // Toggle Accordion Header
    this.container.querySelectorAll('.sector-card-header').forEach(header => {
      header.addEventListener('click', () => {
        const sectorId = header.dataset.sectorId;
        const card = header.closest('.sector-card');
        const container = card.querySelector('.rooms-container');
        const chevron = header.querySelector('.accordion-chevron');

        const isOpen = container.style.display !== 'none';
        if (isOpen) {
          container.style.display = 'none';
          card.classList.remove('expanded');
          chevron.classList.remove('open');
          if (this.expandedSectorId === sectorId) this.expandedSectorId = null;
        } else {
          container.style.display = 'block';
          card.classList.add('expanded');
          chevron.classList.add('open');
          this.expandedSectorId = sectorId;
        }
      });
    });

    // Quick Add Issue from Room Row
    this.container.querySelectorAll('.btn-room-add-issue').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.dataset.roomId;
        const roomName = btn.dataset.roomName;
        if (this.onNewReportForRoom) {
          this.onNewReportForRoom(roomId, roomName);
        }
      });
    });

    // View Issues for Room
    this.container.querySelectorAll('.btn-room-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomName = btn.dataset.roomName;
        if (this.onViewRoomReports) {
          this.onViewRoomReports(roomName);
        }
      });
    });
  }

  refreshList(stats) {
    const listEl = this.container.querySelector('#sectors-accordion-list');
    if (listEl) {
      listEl.innerHTML = this.renderSectorsList(stats);
      this.bindAccordionClicks();
    }
  }

}
