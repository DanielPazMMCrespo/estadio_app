/**
 * Bottom Navigation Bar Component
 * Modern Dark Pro design with clean SVG icons, 4 primary tabs: Hoje, Avarias, Tarefas, Mais.
 */
export class BottomNavComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.activeTab = options.activeTab || 'home';
    this.onNavigate = options.onNavigate || null;
    this.navEl = null;
  }

  render() {
    if (!this.container) return;

    const existing = this.container.querySelector('.bottom-nav-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'bottom-nav-wrapper';

    wrapper.innerHTML = `
      <nav class="bottom-nav" role="navigation" aria-label="Navegação principal">
        <!-- 1. HOJE (Home) -->
        <button type="button" 
                class="nav-tab ${this.activeTab === 'home' ? 'active' : ''}" 
                data-tab="home"
                aria-label="Ecrã Hoje"
                aria-current="${this.activeTab === 'home' ? 'page' : 'false'}">
          <span class="nav-icon-svg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </span>
          <span class="nav-label">Hoje</span>
        </button>

        <!-- 2. INTERVENÇÕES / OCORRÊNCIAS -->
        <button type="button" 
                class="nav-tab ${this.activeTab === 'history' ? 'active' : ''}" 
                data-tab="history"
                aria-label="Intervenções e Ocorrências"
                aria-current="${this.activeTab === 'history' ? 'page' : 'false'}">
          <span class="nav-icon-svg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </span>
          <span class="nav-label">Intervenções</span>
        </button>

        <!-- 3. TAREFAS -->
        <button type="button" 
                class="nav-tab ${this.activeTab === 'tasks' ? 'active' : ''}" 
                data-tab="tasks"
                aria-label="Tarefas e Manutenção Preventiva"
                aria-current="${this.activeTab === 'tasks' ? 'page' : 'false'}">
          <span class="nav-icon-svg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </span>
          <span class="nav-label">Tarefas</span>
        </button>

        <!-- 4. MAIS (More) -->
        <button type="button" 
                class="nav-tab ${this.activeTab === 'more' ? 'active' : ''}" 
                data-tab="more"
                aria-label="Mais opções e ferramentas"
                aria-current="${this.activeTab === 'more' ? 'page' : 'false'}">
          <span class="nav-icon-svg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </span>
          <span class="nav-label">Mais</span>
        </button>
      </nav>
    `;

    this.container.appendChild(wrapper);
    this.navEl = wrapper.querySelector('.bottom-nav');
    this.bindEvents();
  }

  bindEvents() {
    if (!this.navEl) return;

    this.navEl.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.setActive(tabId);
        if (typeof this.onNavigate === 'function') {
          this.onNavigate(tabId);
        }
      });
    });
  }

  setActive(tabId) {
    // If we're inside a view that belongs to 'more', keep 'more' active
    const effectiveTab = ['tools', 'equipment', 'notes', 'settings', 'sectors'].includes(tabId) ? 'more' : tabId;
    this.activeTab = effectiveTab;
    
    if (!this.navEl) return;

    this.navEl.querySelectorAll('.nav-tab').forEach(btn => {
      const id = btn.getAttribute('data-tab');
      const isActive = id === effectiveTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }
}
