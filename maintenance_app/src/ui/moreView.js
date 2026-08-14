export class MoreViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNavigate = options.onNavigate || null;
  }

  async render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="more-view animate-fade-in" style="padding: 16px; padding-bottom: 90px; overflow-y: auto; height: 100%;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--color-text); margin: 0 0 8px 0;">Mais Opções</h2>
          <p style="color: var(--color-text-secondary); font-size: 0.95rem; margin: 0;">Ferramentas e configuração</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Ferramentas -->
          <button type="button" class="more-menu-item touch-target" data-target="tools" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 16px; display: flex; align-items: center; justify-content: space-between; text-align: left; width: 100%;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="color: var(--color-brand-primary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--color-text);">Ferramentas e Stock</div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary);">Inventário e consumíveis</div>
              </div>
            </div>
            <div style="color: var(--color-text-muted);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </button>

          <!-- Equipamento -->
          <button type="button" class="more-menu-item touch-target" data-target="equipment" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 16px; display: flex; align-items: center; justify-content: space-between; text-align: left; width: 100%;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="color: var(--color-brand-primary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--color-text);">Equipamento Instalado</div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary);">Histórico e garantias</div>
              </div>
            </div>
            <div style="color: var(--color-text-muted);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </button>

          <!-- Setores -->
          <button type="button" class="more-menu-item touch-target" data-target="sectors" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 16px; display: flex; align-items: center; justify-content: space-between; text-align: left; width: 100%;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="color: var(--color-brand-primary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--color-text);">Áreas do Estádio</div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary);">Explorar salas e pisos</div>
              </div>
            </div>
            <div style="color: var(--color-text-muted);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </button>

          <!-- Notas -->
          <button type="button" class="more-menu-item touch-target" data-target="notes" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 16px; display: flex; align-items: center; justify-content: space-between; text-align: left; width: 100%;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="color: var(--color-brand-primary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--color-text);">Notas Soltas</div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary);">Rascunhos e áudios rápidos</div>
              </div>
            </div>
            <div style="color: var(--color-text-muted);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </button>

          <!-- Definições -->
          <button type="button" class="more-menu-item touch-target" data-target="settings" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 16px; display: flex; align-items: center; justify-content: space-between; text-align: left; width: 100%;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="color: var(--color-brand-primary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--color-text);">Definições</div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary);">Sistema e utilizador</div>
              </div>
            </div>
            <div style="color: var(--color-text-muted);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </button>
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
    // Nothing dynamic to refresh yet
  }
}
