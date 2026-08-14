import { reportsRepo } from '../db/reportsRepo.js';
import { locationsRepo } from '../db/locationsRepo.js';

/**
 * Interactive 2D Vector SVG Stadium Map Component
 * Schematic overview of Estádio Municipal de Leiria with interactive sectors,
 * active issue counters, glowing pulse indicators for critical alerts, and instant filtering.
 */
export class StadiumMapComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onSelectSector = options.onSelectSector || null;
    this.onNewReportForSector = options.onNewReportForSector || null;
    this.onViewSectorReports = options.onViewSectorReports || null;
    this.selectedSectorId = null;
    this.reports = [];
    this.locations = [];
  }

  async render() {
    if (!this.container) return;

    try {
      this.reports = await reportsRepo.getAll();
      this.locations = await locationsRepo.getAll();
    } catch (e) {
      console.error('[StadiumMap] Erro ao carregar dados:', e);
    }

    // Active issues stats
    const activeReports = this.reports.filter(r => r.status !== 'resolved');
    const criticalReports = activeReports.filter(r => r.priority === 'critical');
    const inProgressReports = activeReports.filter(r => r.status === 'in_progress');

    // Counts by sector
    const sectorStats = this.getSectorStats(activeReports);

    this.container.innerHTML = `
      <section class="stadium-map-view animate-fade-in">
        <!-- Top Status Indicators -->
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

        <!-- Stadium Blueprint SVG Container -->
        <div class="stadium-canvas-card">
          <div class="stadium-card-header">
            <div class="stadium-title-group">
              <span class="stadium-badge-tag">Planta 2D Interativa</span>
              <h2 class="stadium-title">Estádio Municipal de Leiria</h2>
            </div>
            <span class="stadium-hint">Toque num setor</span>
          </div>

          <div class="svg-map-wrapper">
            <svg viewBox="0 0 800 620" class="stadium-svg" id="stadium-vector-map" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#064E3B" />
                  <stop offset="50%" stop-color="#047857" />
                  <stop offset="100%" stop-color="#065F46" />
                </linearGradient>
                <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#7C2D12" />
                  <stop offset="100%" stop-color="#9A3412" />
                </linearGradient>
                <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <!-- Outer Stadium Oval Shell -->
              <path class="stadium-outer-contour" d="M 180,40 L 620,40 C 730,40 780,120 780,310 C 780,500 730,580 620,580 L 180,580 C 70,580 20,500 20,310 C 20,120 70,40 180,40 Z" fill="#111827" stroke="#1F2937" stroke-width="4" />

              <!-- TOPO NORTE (North Stand) -->
              <g class="sector-group" data-sector-id="LOC_NORTH_STAND" data-sector-name="Bancada Norte / Topo Norte">
                <path class="sector-polygon" d="M 220,50 L 580,50 C 640,50 670,90 680,140 L 120,140 C 130,90 160,50 220,50 Z" />
                <text x="400" y="100" class="sector-label">TOPO NORTE</text>
                ${this.renderSectorBadge(400, 125, sectorStats['LOC_NORTH_STAND'])}
              </g>

              <!-- TOPO SUL (South Stand) -->
              <g class="sector-group" data-sector-id="LOC_SOUTH_STAND" data-sector-name="Bancada Sul / Topo Sul">
                <path class="sector-polygon" d="M 120,480 L 680,480 C 670,530 640,570 580,570 L 220,570 C 160,570 130,530 120,480 Z" />
                <text x="400" y="525" class="sector-label">TOPO SUL</text>
                ${this.renderSectorBadge(400, 550, sectorStats['LOC_SOUTH_STAND'])}
              </g>

              <!-- BANCADA POENTE (West Main Stand & VIP) -->
              <g class="sector-group" data-sector-id="LOC_WEST_STAND" data-sector-name="Bancada Poente (Principal & VIP)">
                <path class="sector-polygon" d="M 30,310 C 30,170 70,120 110,150 L 170,180 L 170,440 L 110,470 C 70,500 30,450 30,310 Z" />
                <text x="100" y="305" class="sector-label vertical-label" transform="rotate(-90 100 305)">BANCADA POENTE</text>
                ${this.renderSectorBadge(100, 345, sectorStats['LOC_WEST_STAND'])}
              </g>

              <!-- BANCADA NASCENTE (East Stand) -->
              <g class="sector-group" data-sector-id="LOC_EAST_STAND" data-sector-name="Bancada Nascente">
                <path class="sector-polygon" d="M 770,310 C 770,450 730,500 690,470 L 630,440 L 630,180 L 690,150 C 730,120 770,170 770,310 Z" />
                <text x="700" y="305" class="sector-label vertical-label" transform="rotate(90 700 305)">BANCADA NASCENTE</text>
                ${this.renderSectorBadge(700, 345, sectorStats['LOC_EAST_STAND'])}
              </g>

              <!-- ATHLETICS RUNNING TRACK -->
              <rect x="180" y="150" width="440" height="320" rx="90" fill="url(#trackGrad)" stroke="#B45309" stroke-width="3" opacity="0.85" />
              <!-- Running Track Lane Lines -->
              <rect x="195" y="165" width="410" height="290" rx="75" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="6,4" />

              <!-- RELVADO PRINCIPAL (The Pitch) -->
              <g class="sector-group" data-sector-id="LOC_PITCH" data-sector-name="Relvado Principal">
                <rect class="pitch-rect" x="225" y="195" width="350" height="230" rx="6" fill="url(#pitchGrad)" stroke="#10B981" stroke-width="3" />
                
                <!-- Football Pitch Markings -->
                <line x1="400" y1="195" x2="400" y2="425" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
                <circle cx="400" cy="310" r="38" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
                <circle cx="400" cy="310" r="3" fill="#FFFFFF" />
                
                <!-- North Penalty Box -->
                <rect x="330" y="195" width="140" height="48" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
                <!-- South Penalty Box -->
                <rect x="330" y="377" width="140" height="48" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />

                <text x="400" y="300" class="pitch-label">RELVADO PRINCIPAL</text>
                ${this.renderSectorBadge(400, 335, sectorStats['LOC_PITCH'])}
              </g>

              <!-- BALNEÁRIOS & ZONA TÉCNICA (Changing rooms & Tunnel) -->
              <g class="sector-group sub-zone" data-sector-id="LOC_CHANGING" data-sector-name="Balneários & Zona Técnica">
                <rect class="sub-zone-rect" x="185" y="270" width="35" height="80" rx="4" fill="#1E293B" stroke="#38BDF8" stroke-width="2" />
                <text x="202" y="315" class="sub-zone-label" transform="rotate(-90 202 315)">BALNEÁRIOS</text>
                ${this.renderSectorBadge(202, 340, sectorStats['LOC_CHANGING'], true)}
              </g>

              <!-- TRIBUNA VIP / CAMAROTES -->
              <g class="sector-group sub-zone" data-sector-id="LOC_VIP" data-sector-name="Tribuna VIP & Camarotes">
                <rect class="sub-zone-rect" x="115" y="275" width="48" height="70" rx="4" fill="#312E81" stroke="#F59E0B" stroke-width="2" />
                <text x="139" y="315" class="sub-zone-label" transform="rotate(-90 139 315)">VIP</text>
                ${this.renderSectorBadge(139, 335, sectorStats['LOC_VIP'], true)}
              </g>
            </svg>
          </div>
        </div>

        <!-- Sector Information Drawer (Appears on click) -->
        <div class="sector-detail-drawer" id="sector-detail-drawer" style="display:none;">
          <div class="drawer-header">
            <div>
              <div class="drawer-sector-code" id="drawer-sector-code">LOC_WEST_STAND</div>
              <h3 class="drawer-sector-name" id="drawer-sector-name">Bancada Poente</h3>
            </div>
            <button type="button" class="btn-close-drawer" id="btn-close-drawer">&times;</button>
          </div>

          <div class="drawer-content" id="drawer-content">
            <!-- Active issues list in this sector -->
          </div>

          <div class="drawer-actions">
            <button type="button" class="btn-secondary" id="btn-view-sector-reports">
              Ver Intervenções no Feed
            </button>
            <button type="button" class="btn-primary-cta" id="btn-quick-new-report">
              + Registar Aqui
            </button>
          </div>
        </div>
      </section>
    `;

    this.bindEvents();
  }

  getSectorStats(activeReports) {
    const stats = {};
    const sectors = ['LOC_NORTH_STAND', 'LOC_SOUTH_STAND', 'LOC_WEST_STAND', 'LOC_EAST_STAND', 'LOC_PITCH', 'LOC_CHANGING', 'LOC_VIP'];
    sectors.forEach(s => { stats[s] = { total: 0, critical: 0, inProgress: 0, reports: [] }; });

    activeReports.forEach(r => {
      let code = r.sectorCode || r.locationId;
      if (!stats[code]) {
        // Fallback matching by name
        if ((r.locationName || '').includes('Norte')) code = 'LOC_NORTH_STAND';
        else if ((r.locationName || '').includes('Sul')) code = 'LOC_SOUTH_STAND';
        else if ((r.locationName || '').includes('Poente')) code = 'LOC_WEST_STAND';
        else if ((r.locationName || '').includes('Nascente')) code = 'LOC_EAST_STAND';
        else if ((r.locationName || '').includes('Balneário')) code = 'LOC_CHANGING';
        else if ((r.locationName || '').includes('Relvado')) code = 'LOC_PITCH';
        else if ((r.locationName || '').includes('VIP')) code = 'LOC_VIP';
        else code = 'LOC_PITCH';
      }

      if (stats[code]) {
        stats[code].total++;
        if (r.priority === 'critical') stats[code].critical++;
        if (r.status === 'in_progress') stats[code].inProgress++;
        stats[code].reports.push(r);
      }
    });

    return stats;
  }

  renderSectorBadge(cx, cy, statObj, isSmall = false) {
    if (!statObj || statObj.total === 0) {
      return `<circle cx="${cx}" cy="${cy}" r="${isSmall ? 8 : 10}" class="map-badge-empty" />
              <text x="${cx}" y="${cy + 3}" class="map-badge-text-empty">0</text>`;
    }

    const isCrit = statObj.critical > 0;
    const badgeClass = isCrit ? 'map-badge-critical' : 'map-badge-active';
    const r = isSmall ? 10 : 13;

    return `
      <g class="map-badge-group">
        ${isCrit ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" class="pulse-ring" />` : ''}
        <circle cx="${cx}" cy="${cy}" r="${r}" class="${badgeClass}" />
        <text x="${cx}" y="${cy + 4}" class="map-badge-text">${statObj.total}</text>
      </g>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    const sectorGroups = this.container.querySelectorAll('.sector-group');
    const drawer = this.container.querySelector('#sector-detail-drawer');
    const drawerCode = this.container.querySelector('#drawer-sector-code');
    const drawerName = this.container.querySelector('#drawer-sector-name');
    const drawerContent = this.container.querySelector('#drawer-content');
    const closeBtn = this.container.querySelector('#btn-close-drawer');
    const btnView = this.container.querySelector('#btn-view-sector-reports');
    const btnQuickNew = this.container.querySelector('#btn-quick-new-report');

    const activeReports = this.reports.filter(r => r.status !== 'resolved');
    const sectorStats = this.getSectorStats(activeReports);

    sectorGroups.forEach(group => {
      group.addEventListener('click', (e) => {
        e.stopPropagation();
        sectorGroups.forEach(g => g.classList.remove('selected'));
        group.classList.add('selected');

        const sectorId = group.dataset.sectorId;
        const sectorName = group.dataset.sectorName;
        this.selectedSectorId = sectorId;

        const stat = sectorStats[sectorId] || { total: 0, critical: 0, reports: [] };

        drawerCode.textContent = sectorId;
        drawerName.textContent = sectorName;

        if (stat.reports.length === 0) {
          drawerContent.innerHTML = `
            <div class="drawer-empty-state">
              <span class="check-icon">✓</span>
              <p>Sem intervenções ativas neste setor. Tudo operacional!</p>
            </div>
          `;
        } else {
          drawerContent.innerHTML = `
            <div class="drawer-reports-list">
              ${stat.reports.map(r => `
                <div class="drawer-report-card priority-${r.priority || 'medium'}">
                  <div class="drawer-report-header">
                    <span class="priority-badge ${r.priority || 'medium'}">${(r.priority || 'média').toUpperCase()}</span>
                    <span class="status-badge-mini ${r.status || 'pending'}">${r.status === 'in_progress' ? 'Em Curso' : 'Pendente'}</span>
                  </div>
                  <div class="drawer-report-desc">${this.esc(r.description || 'Sem descrição')}</div>
                </div>
              `).join('')}
            </div>
          `;
        }

        drawer.style.display = 'block';
        drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (this.onSelectSector) this.onSelectSector(sectorId, sectorName);
      });
    });

    closeBtn?.addEventListener('click', () => {
      drawer.style.display = 'none';
      sectorGroups.forEach(g => g.classList.remove('selected'));
      this.selectedSectorId = null;
    });

    btnView?.addEventListener('click', () => {
      if (this.selectedSectorId && this.onViewSectorReports) {
        this.onViewSectorReports(this.selectedSectorId);
      }
    });

    btnQuickNew?.addEventListener('click', () => {
      if (this.selectedSectorId && this.onNewReportForSector) {
        const sectorGroup = this.container.querySelector(`.sector-group[data-sector-id="${this.selectedSectorId}"]`);
        const name = sectorGroup?.dataset.sectorName || 'Setor';
        this.onNewReportForSector(this.selectedSectorId, name);
      }
    });
  }

  esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
