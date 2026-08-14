/**
 * Header UI Component
 * Top navy blue header with greeting ("Olá, [Nome]") and dynamic online/offline status badge.
 */
export class HeaderComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.userName = options.userName || 'Operador';
    this.isOnline = options.isOnline !== undefined ? options.isOnline : (typeof navigator !== 'undefined' ? navigator.onLine : true);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="header-content" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="/icons/logo-mmcrespo.png" alt="mmcrespo" style="height: 48px; width: auto; max-width: 140px; object-fit: contain; display: block;" />
          <div class="header-brand" style="border-left: 1px solid var(--color-border); padding-left: 12px;">
            <h1 class="greeting" style="font-size: 0.95rem; margin: 0; font-weight: 600;">Olá, <span class="user-name" style="color: var(--color-brand-primary);">${this.escapeHtml(this.userName)}</span></h1>
            <p class="subtitle" style="font-size: 0.65rem; margin-top: 2px;">Estádio Municipal de Leiria</p>
          </div>
        </div>
        <div class="header-status">
          <div id="connectivity-badge" class="status-badge ${this.isOnline ? 'online' : 'offline'}">
            <span class="status-dot"></span>
            <span class="status-text">${this.isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
    `;
  }

  updateStatus(isOnline) {
    this.isOnline = isOnline;
    const badge = this.container ? this.container.querySelector('#connectivity-badge') : null;
    if (badge) {
      badge.className = `status-badge ${isOnline ? 'online' : 'offline'}`;
      const text = badge.querySelector('.status-text');
      if (text) text.textContent = isOnline ? 'Online' : 'Offline';
    } else {
      this.render();
    }
  }

  setUserName(name) {
    this.userName = name;
    const nameEl = this.container ? this.container.querySelector('.user-name') : null;
    if (nameEl) {
      nameEl.textContent = name;
    } else {
      this.render();
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
