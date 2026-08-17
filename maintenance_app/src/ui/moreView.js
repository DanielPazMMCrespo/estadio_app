const CHEVRON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

/**
 * Cinco linhas grandes e nada mais. Sem subtítulos: "Inventário e consumíveis"
 * debaixo de "Ferramentas e Stock" não diz nada que o título já não diga, e a
 * 13.6px era ilegível de luvas e ao sol. Menos texto, maior.
 */
const MENU_ITEMS = [
  {
    target: 'reports',
    label: 'Relatórios',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="10.5" y2="15"></line><line x1="12.5" y1="12" x2="15" y2="15"></line><line x1="9" y1="18" x2="15" y2="18"></line>`
  },
  {
    target: 'tools',
    label: 'Ferramentas e Stock',
    icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>`
  },
  {
    target: 'equipment',
    label: 'Equipamento Instalado',
    icon: `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>`
  },
  {
    target: 'sectors',
    label: 'Áreas do Estádio',
    icon: `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`
  },
  {
    target: 'notes',
    label: 'Notas Soltas',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>`
  },
  {
    target: 'settings',
    label: 'Definições',
    icon: `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`
  }
];

export class MoreViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNavigate = options.onNavigate || null;
  }

  async render() {
    if (!this.container) return;

    const rows = MENU_ITEMS.map(item => `
          <button type="button" class="more-menu-item mv-item touch-target" data-target="${item.target}">
            <span class="mv-item-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${item.icon}</svg>
            </span>
            <span class="mv-item-label">${item.label}</span>
            <span class="mv-item-chevron">${CHEVRON}</span>
          </button>`).join('');

    this.container.innerHTML = `
      <section class="more-view animate-fade-in">
        <div class="mv-header">
          <h2 class="mv-title">Mais Opções</h2>
          <p class="mv-subtitle">Ferramentas e configuração</p>
        </div>

        <div class="mv-list">${rows}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.more-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (typeof this.onNavigate === 'function') {
          this.onNavigate(target);
        }
      });
    });
  }

  async refresh() {
    // Nada de dinâmico para refrescar
  }
}
