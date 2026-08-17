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

    // Uma só linha compacta: logótipo e estado. Nada mais.
    //
    // A saudação ("Olá, Técnico") e o nome do estádio saíram daqui de propósito.
    // Estavam em duas linhas no topo de TODOS os ecrãs e comiam cerca de 120px
    // dos 844px do telemóvel — e não dizem nada que ele não saiba: é o telemóvel
    // dele e é o estádio onde trabalha. Esse espaço passou para o trabalho.
    // O estado de ligação fica, porque é informação a sério: diz-lhe se o que
    // ele gravou já saiu do telemóvel.
    //
    // Sem estilos inline: tudo vive em .app-header no CSS, para se poder
    // corrigir tamanhos a partir da folha de estilos.
    this.container.innerHTML = `
      <div class="header-content">
        <!-- Duas versões do logótipo, uma por tema. O CSS mostra a certa: o
             logótipo normal é escuro e desaparecia no tema escuro. Sem
             JavaScript pelo meio — só o CSS decide. -->
        <img class="header-logo header-logo--light" src="/icons/logo-mmcrespo.png" alt="mmcrespo" />
        <img class="header-logo header-logo--dark" src="/icons/mmcrespo_white.png" alt="" aria-hidden="true" />
        <div class="header-status">
          <button type="button" id="connectivity-badge" class="status-badge ${badgeClass}" title="Toque para sincronizar">
            <span class="status-dot"></span>
            <span class="status-text">${badgeText}</span>
          </button>
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

  /**
   * Guarda o nome do operador. O cabeçalho já não o desenha — quem o usa são
   * as fichas em PDF e as definições — por isso aqui só se guarda o valor.
   * Não há nada para voltar a desenhar.
   */
  setUserName(name) {
    this.userName = name;
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
