import { esc, attr } from '../utils/html.js';
import { haptics } from '../services/haptics.js';

/**
 * Página principal em quadrados (Opção B do mockup design-2026/MainQuadrados).
 * Um quadrado por destino, nada de listas. O técnico de luvas acerta num
 * quadrado de 148px sem falhar; uma linha de lista de 14px não.
 *
 * Sem contadores nos quadrados. Um número no canto obriga a parar e a
 * interpretar; o técnico só quer saber onde toca para chegar à página. O
 * detalhe fica dentro de cada página.
 */
const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;

const TILE_ICONS = {
  reports: `<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`,
  tasks: `<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>`,
  stadium: `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`,
  tools: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>`,
  equipment: `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>`,
  more: `<line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line>`
};

export class HomeViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onOpenFullReport = options.onOpenFullReport || null;
    this.onViewAllTasks = options.onViewAllTasks || null;
    this.onOpenTask = options.onOpenTask || null;
    this.onOpenReport = options.onOpenReport || null;
    this.onViewAllReports = options.onViewAllReports || null;
    this.onNavigate = options.onNavigate || null;
  }

  saudacao() {
    const h = new Date().getHours();
    if (h < 13) return 'Bom dia';
    if (h < 20) return 'Boa tarde';
    return 'Boa noite';
  }

  tile({ target, iconKey, iconClass, label }) {
    return `
          <button type="button" class="ht-tile touch-target" data-target="${attr(target)}" aria-label="${attr(label)}">
            <span class="ht-icon ${iconClass}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TILE_ICONS[iconKey]}</svg>
            </span>
            <span class="ht-name">${esc(label)}</span>
          </button>`;
  }

  async render() {
    if (!this.container) return;

    const quadrados = [
      this.tile({
        target: 'history',
        iconKey: 'reports',
        iconClass: 'ht-icon-reports',
        label: 'Intervenções'
      }),
      this.tile({
        target: 'tasks',
        iconKey: 'tasks',
        iconClass: 'ht-icon-tasks',
        label: 'Tarefas'
      }),
      this.tile({
        target: 'sectors',
        iconKey: 'stadium',
        iconClass: 'ht-icon-stadium',
        label: 'Estádio'
      }),
      this.tile({
        target: 'tools',
        iconKey: 'tools',
        iconClass: 'ht-icon-tools',
        label: 'Ferramentas'
      }),
      this.tile({
        target: 'equipment',
        iconKey: 'equipment',
        iconClass: 'ht-icon-equipment',
        label: 'Equipamento'
      }),
      this.tile({
        target: 'more',
        iconKey: 'more',
        iconClass: 'ht-icon-more',
        label: 'Mais'
      })
    ].join('');

    this.container.innerHTML = `
      <section class="home-tiles animate-fade-in">
        <div class="ht-header">
          <h2 class="ht-greeting">${this.saudacao()}!</h2>
          <p class="ht-place">Estádio Municipal de Leiria</p>
        </div>

        <div class="ht-grid">
          <button type="button" id="btn-hero-report" class="ht-tile ht-tile-wide ht-tile-primary touch-target" aria-label="Registar nova avaria">
            <span class="ht-primary-row">
              ${PLUS_ICON}
              <span class="ht-primary-label">Registar avaria</span>
            </span>
            <span class="ht-primary-hint">Foto, voz ou texto</span>
          </button>
${quadrados}
        </div>

        <div id="home-offline-indicator" class="ht-offline">
          Sem ligação. Pode continuar a trabalhar: fica tudo gravado no telemóvel.
        </div>
      </section>
    `;

    this.bindEvents();
    this.checkOfflineState();
  }

  checkOfflineState() {
    const indicator = this.container.querySelector('#home-offline-indicator');
    if (!indicator) return;

    const updateState = () => {
      if (!indicator) return;
      indicator.classList.toggle('is-visible', !navigator.onLine);
    };

    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);
    updateState();
  }

  bindEvents() {
    // 1. Quadrado verde: registar avaria
    const btnHero = this.container.querySelector('#btn-hero-report');
    if (btnHero) {
      btnHero.addEventListener('click', () => {
        haptics.success();
        if (this.onOpenFullReport) {
          this.onOpenFullReport({ description: '', locationId: '', locationName: '' });
        }
      });
    }

    // 2. Os restantes quadrados são só navegação
    this.container.querySelectorAll('.ht-tile[data-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (!target) return;
        haptics.tap();

        // Os callbacks antigos continuam a valer; o onNavigate é o caminho novo.
        if (target === 'history' && this.onViewAllReports) return this.onViewAllReports();
        if (target === 'tasks' && this.onViewAllTasks) return this.onViewAllTasks();
        if (this.onNavigate) this.onNavigate(target);
      });
    });
  }

  async refresh() {
    await this.render();
  }
}
