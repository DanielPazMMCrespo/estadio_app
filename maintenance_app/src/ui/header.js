/**
 * Header UI Component
 * Top navy blue header with greeting ("Olá, [Nome]") and dynamic online/offline/sync status badge.
 */
export class HeaderComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.userName = options.userName || 'Operador';
    if (options.status) {
      this.status = options.status;
    } else if (options.isOnline !== undefined) {
      this.status = options.isOnline ? 'online' : 'offline';
    } else {
      this.status = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';
    }
    this.isOnline = this.status !== 'offline';
  }

  render() {
    if (!this.container) return;

    let badgeClass = 'online';
    let badgeText = 'Online';

    if (this.status === 'offline') {
      badgeClass = 'offline';
      badgeText = 'Offline';
    } else if (this.status === 'syncing') {
      badgeClass = 'syncing';
      badgeText = 'A sincronizar...';
    } else if (this.status === 'synced') {
      badgeClass = 'online';
      badgeText = 'Sincronizado';
    }

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
          <div id="connectivity-badge" class="status-badge ${badgeClass}" style="cursor: pointer;" title="Toque para sincronizar">
            <span class="status-dot"></span>
            <span class="status-text">${badgeText}</span>
          </div>
        </div>
      </div>
    `;

    // Adicionar clique no badge para disparar sync manual
    const badge = this.container.querySelector('#connectivity-badge');
    if (badge) {
      badge.addEventListener('click', () => {
        if (window.syncEngine) {
          window.syncEngine.sync({ showToast: true });
        }
      });
    }
  }

  updateStatus(isOnline) {
    this.updateSyncState(isOnline ? 'online' : 'offline');
  }

  updateSyncState(state) {
    this.status = state;
    this.isOnline = state !== 'offline';
    const badge = this.container ? this.container.querySelector('#connectivity-badge') : null;
    if (badge) {
      let badgeClass = 'online';
      let badgeText = 'Online';

      if (state === 'offline') {
        badgeClass = 'offline';
        badgeText = 'Offline';
      } else if (state === 'syncing') {
        badgeClass = 'syncing';
        badgeText = 'A sincronizar...';
      } else if (state === 'synced') {
        badgeClass = 'online';
        badgeText = 'Sincronizado';
      }

      badge.className = `status-badge ${badgeClass}`;
      const text = badge.querySelector('.status-text');
      if (text) text.textContent = badgeText;
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
