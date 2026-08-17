import { reportsRepo } from '../db/reportsRepo.js';
import { locationsRepo } from '../db/locationsRepo.js';

import { esc } from '../utils/html.js';
/**
 * Field Metrics & Performance Dashboard Component
 * Clean, modern SVG analytics charts, KPI cards and field technician productivity indicators.
 */
export class DashboardComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onViewReports = options.onViewReports || null;
  }

  async render() {
    if (!this.container) return;

    let reports = [];
    let locations = [];
    try {
      reports = await reportsRepo.getAll();
      locations = await locationsRepo.getAll();
    } catch (err) {
      console.error('[Dashboard] Erro ao carregar métricas:', err);
    }

    const total = reports.length;
    const resolved = reports.filter(r => r.status === 'resolved');
    const pending = reports.filter(r => r.status === 'pending');
    const inProgress = reports.filter(r => r.status === 'in_progress');
    const critical = reports.filter(r => r.priority === 'critical' && r.status !== 'resolved');

    const resolutionRate = total > 0 ? Math.round((resolved.length / total) * 100) : 100;
    const totalMinutes = reports.reduce((acc, r) => acc + (Number(r.timeSpent) || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // Grouping by sector
    const sectorCounts = {};
    reports.forEach(r => {
      const loc = r.locationName || 'Outro';
      sectorCounts[loc] = (sectorCounts[loc] || 0) + 1;
    });
    const sortedSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    this.container.innerHTML = `
      <section class="metrics-dashboard animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Métricas de Campo</h2>
            <p class="section-subtitle">Produtividade & Estado Operacional do Estádio</p>
          </div>
          <span class="section-badge">${total} Registos</span>
        </div>

        <!-- 4 Grid KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon-svg" style="color:var(--color-stadium-green);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </span>
              <span class="kpi-label">Taxa Resolução</span>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-value">${resolutionRate}%</span>
              <span class="kpi-subtext">${resolved.length}/${total}</span>
            </div>
            <div class="kpi-progress-bar">
              <div class="kpi-progress-fill" style="width: ${resolutionRate}%; background: var(--color-stadium-green);"></div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon-svg" style="color:var(--color-danger);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </span>
              <span class="kpi-label">Críticas Ativas</span>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-value" style="color: ${critical.length > 0 ? 'var(--color-danger)' : 'var(--color-text)'};">${critical.length}</span>
              <span class="kpi-subtext">${critical.length > 0 ? 'Requer atenção' : 'Tudo calmo'}</span>
            </div>
            <div class="kpi-progress-bar">
              <div class="kpi-progress-fill" style="width: ${Math.min(100, critical.length * 25)}%; background: var(--color-danger);"></div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon-svg" style="color:var(--color-gold);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </span>
              <span class="kpi-label">Tempo Investido</span>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-value">${totalHours}h</span>
              <span class="kpi-subtext">${totalMinutes} min totais</span>
            </div>
            <div class="kpi-progress-bar">
              <div class="kpi-progress-fill" style="width: 75%; background: var(--color-gold);"></div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon-svg" style="color:var(--color-info);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              </span>
              <span class="kpi-label">Em Curso / Pend.</span>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-value">${inProgress.length + pending.length}</span>
              <span class="kpi-subtext">${inProgress.length} em curso · ${pending.length} pend.</span>
            </div>
            <div class="kpi-progress-bar">
              <div class="kpi-progress-fill" style="width: ${Math.min(100, (inProgress.length + pending.length) * 20)}%; background: var(--color-info);"></div>
            </div>
          </div>
        </div>

        <!-- Breakdown by Sector Bar Chart -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">Distribuição por Setor do Estádio</h3>
            <span class="analytics-card-tag">Top 5 Locais</span>
          </div>
          <div class="sector-bars-list">
            ${sortedSectors.length === 0 ? '<div class="empty-stats">Sem dados registados.</div>' : sortedSectors.map(([name, count]) => {
              const pct = Math.round((count / (total || 1)) * 100);
              return `
                <div class="sector-bar-row">
                  <div class="sector-bar-info">
                    <span class="sector-bar-name">${esc(name)}</span>
                    <span class="sector-bar-count">${count} (${pct}%)</span>
                  </div>
                  <div class="sector-bar-track">
                    <div class="sector-bar-fill" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Priority Breakdown Pills -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">Divisão por Nível de Severidade</h3>
          </div>
          <div class="priority-breakdown-grid">
            <div class="priority-stat-box crit">
              <div class="priority-stat-title">Crítica / Urgente</div>
              <div class="priority-stat-num">${reports.filter(r => r.priority === 'critical').length}</div>
            </div>
            <div class="priority-stat-box med">
              <div class="priority-stat-title">Média / Normal</div>
              <div class="priority-stat-num">${reports.filter(r => !r.priority || r.priority === 'medium').length}</div>
            </div>
            <div class="priority-stat-box low">
              <div class="priority-stat-title">Baixa / Preventiva</div>
              <div class="priority-stat-num">${reports.filter(r => r.priority === 'low').length}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async refresh() { await this.render(); }

}
