import { reportsRepo } from '../db/reportsRepo.js';
import { locationsRepo, locationLabel } from '../db/locationsRepo.js';
import { esc, attr } from '../utils/html.js';
import { haptics } from '../services/haptics.js';

/**
 * Página Estádio em quadrados (mockup design-2026/EstadioQuadrados).
 *
 * Dois níveis e nada mais:
 *   1. sete quadrados, um por setor;
 *   2. dentro do setor, as salas em caixas deitadas.
 *
 * As salas ficam deitadas de propósito. "Sala de Bombas e Caldeiras" num
 * quadrado de meia largura parte em três linhas; e o nome da sala é
 * precisamente o que o técnico tem de ler bem, por isso não se corta.
 *
 * O que saiu daqui: a barra de números no topo e os três filtros
 * ("Com Intervenções", "Críticas"). Eram quatro coisas a ler antes de
 * chegar às salas. O número de avarias abertas continua à vista, no canto
 * do quadrado do setor e da sala.
 *
 * A pesquisa fica. Com 33 salas, escrever "caldeira" poupa dois toques, e
 * com pesquisa escrita saltam-se os setores: aparecem logo as salas.
 */

/**
 * Nome curto de cada setor. O nome da base de dados é longo de propósito
 * ("Bancada Poente (Principal & VIP)") porque também vai nos PDF; num
 * quadrado de meia largura parte em três linhas e desalinha a grelha.
 *
 * "Poente" e "Nascente" sem "Bancada" à frente é como o técnico lhes chama
 * no terreno, e o glifo da bancada já está no quadrado.
 * Os IDs são os de PREDEFINED_LOCATION_IDS.
 */
const SECTOR_SHORT_NAMES = {
  SEC_POENTE: 'Poente',
  SEC_NASCENTE: 'Nascente',
  SEC_NORTH: 'Topo Norte',
  SEC_SOUTH: 'Topo Sul',
  SEC_PITCH: 'Relvado',
  SEC_TECH: 'Técnicas',
  SEC_EXTERIOR: 'Exterior'
};

const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

const ROOM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path><path d="M9 21v-8h6v8"></path></svg>`;

export class StadiumNavigatorComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onSelectRoom = options.onSelectRoom || null;
    this.onNewReportForRoom = options.onNewReportForRoom || null;
    this.onViewRoomReports = options.onViewRoomReports || null;
    // Qual o setor aberto. null = está no primeiro nível, a ver os setores.
    this.openSectorId = null;
    this.searchQuery = '';
    this.reports = [];
    this.sectors = [];
  }

  sectorShortName(sec) {
    if (SECTOR_SHORT_NAMES[sec.id]) return SECTOR_SHORT_NAMES[sec.id];
    // Setor criado pelo técnico: corta o que estiver entre parênteses.
    return String(sec.name || '').replace(/\s*\(.*\)\s*$/, '').trim() || 'Setor';
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
    this.stats = this.aggregateIssues(activeReports);

    this.container.innerHTML = `
      <section class="stadium-nav-view animate-fade-in">
        ${this.renderBody()}
      </section>
    `;

    this.bindEvents();
  }

  renderBody() {
    const q = this.searchQuery.toLowerCase().trim();
    const sector = this.openSectorId
      ? this.sectors.find(s => s.id === this.openSectorId)
      : null;

    // Com pesquisa escrita, os setores saem da frente: mostram-se as salas
    // que dão com o que ele escreveu, de todo o estádio.
    if (q) return this.renderSearchResults(q);
    if (sector) return this.renderRoomsLevel(sector);
    return this.renderSectorsLevel();
  }

  searchBar() {
    return `
        <div class="search-bar">
          <span class="search-icon-svg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="input-search-sectors" class="form-input search-input" placeholder="Pesquisar sala: caldeira, bomba, balneário..." value="${attr(this.searchQuery)}" />
          ${this.searchQuery ? '<button type="button" id="btn-clear-sec-search" class="btn-clear-search" aria-label="Limpar pesquisa">&times;</button>' : ''}
        </div>`;
  }

  /** Nível 1 — os sete quadrados de setor. */
  renderSectorsLevel() {
    // O último quadrado fica deitado: sete não dá grelha de dois.
    const ultimo = this.sectors.length - 1;

    const quadrados = this.sectors.map((sec, i) => {
      const stat = this.stats.sectors[sec.id] || { total: 0, critical: 0 };
      const nSalas = (sec.rooms || []).length;
      const deitado = i === ultimo && this.sectors.length % 2 === 1;

      return `
          <button type="button" class="ht-tile ev-sector touch-target${deitado ? ' ht-tile-wide ht-tile-lay' : ''}" data-sector-id="${attr(sec.id)}" aria-label="${attr(this.sectorShortName(sec))}, ${nSalas} salas">
            ${this.flag(stat)}
            <span class="ht-icon ev-ico-${attr(sec.icon || 'exterior')}">
              ${this.getSectorSvg(sec.icon || 'exterior')}
            </span>
            <span class="ht-name">${esc(this.sectorShortName(sec))}</span>
            <span class="ht-meta">${nSalas} sala${nSalas === 1 ? '' : 's'}</span>
          </button>`;
    }).join('');

    return `
        <div class="ev-header">
          <h2 class="ev-title">Estádio</h2>
          <p class="ev-subtitle">Toque num setor</p>
        </div>
        ${this.searchBar()}
        <div class="ht-grid">${quadrados}
        </div>`;
  }

  /** Nível 2 — as salas de um setor, deitadas. */
  renderRoomsLevel(sector) {
    const rooms = sector.rooms || [];

    return `
        <button type="button" class="ev-back touch-target" id="btn-back-sectors">
          <span class="ev-back-icon">${BACK_ICON}</span>
          <span class="ev-back-label">Todos os setores</span>
        </button>
        <div class="ev-header">
          <h2 class="ev-title">${esc(this.sectorShortName(sector))}</h2>
          <p class="ev-subtitle">${rooms.length} sala${rooms.length === 1 ? '' : 's'}</p>
        </div>
        ${this.searchBar()}
        <div class="ht-grid">
          ${rooms.length === 0 ? this.emptyState('Sem salas neste setor', 'Pode criar salas novas nas Definições.') : rooms.map(room => this.roomTile(sector, room)).join('')}
        </div>`;
  }

  /** Resultado da pesquisa — salas de todo o estádio, deitadas. */
  renderSearchResults(q) {
    const encontradas = [];
    this.sectors.forEach(sec => {
      (sec.rooms || []).forEach(room => {
        const alvo = [
          room.name,
          room.number,
          room.description,
          sec.name
        ].map(v => String(v || '').toLowerCase()).join(' ');
        if (alvo.includes(q)) encontradas.push({ sec, room });
      });
    });

    return `
        <div class="ev-header">
          <h2 class="ev-title">Estádio</h2>
          <p class="ev-subtitle">${encontradas.length} sala${encontradas.length === 1 ? '' : 's'} encontrada${encontradas.length === 1 ? '' : 's'}</p>
        </div>
        ${this.searchBar()}
        <div class="ht-grid">
          ${encontradas.length === 0 ? this.emptyState('Nenhuma sala encontrada', 'Tente outra palavra, ou limpe a pesquisa.') : encontradas.map(({ sec, room }) => this.roomTile(sec, room, true)).join('')}
        </div>`;
  }

  /**
   * Caixa de sala, deitada e com a largura toda. Não é um <button>: leva
   * botões dentro, e um botão dentro de outro botão não é HTML válido.
   */
  roomTile(sec, room, mostrarSetor = false) {
    const stat = this.stats.rooms[room.id] || { total: 0, critical: 0 };
    const nome = locationLabel(room);

    return `
          <div class="ht-tile ht-tile-wide ht-tile-lay ev-room" data-room-id="${attr(room.id)}" data-room-name="${attr(nome)}" role="button" tabindex="0" aria-label="${attr(nome)}, registar avaria">
            <span class="ht-icon ev-ico-room">${ROOM_ICON}</span>
            <span class="ev-room-text">
              <span class="ht-name">${esc(nome)}</span>
              ${mostrarSetor ? `<span class="ht-meta">${esc(this.sectorShortName(sec))}</span>` : ''}
            </span>
            ${this.flag(stat)}
            ${stat.total > 0 ? `
            <button type="button" class="ev-room-view touch-target" data-action="view-issues" data-room-name="${attr(room.name)}" aria-label="Ver as ${stat.total} intervenções desta sala">
              Ver
            </button>` : ''}
          </div>`;
  }

  /** O número no canto. Só aparece quando há avarias abertas ali. */
  flag(stat) {
    if (!stat || !stat.total) return '';
    const critico = stat.critical > 0;
    return `<span class="ht-flag${critico ? ' ht-flag-crit' : ''}" aria-hidden="true">${esc(String(stat.total))}</span>`;
  }

  emptyState(titulo, texto) {
    return `
          <div class="ev-empty">
            <h3 class="ev-empty-title">${esc(titulo)}</h3>
            <p class="ev-empty-desc">${esc(texto)}</p>
          </div>`;
  }

  /**
   * Descobre a que sala e a que setor pertence uma avaria.
   *
   * A ordem importa e é do mais seguro para o menos seguro:
   *   1. `locationId` igual ao id da sala   — é o caso normal, é exato;
   *   2. `locationId` igual ao code do setor — avaria posta no setor, sem sala;
   *   3. nome da sala igual ao nome guardado — para registos antigos que só
   *      gravaram o nome;
   *   4. nome do setor igual ao nome guardado.
   *
   * Se nada bater, devolve nada. NÃO se atira a avaria para o primeiro setor:
   * um número errado no quadrado errado é pior que número nenhum, porque o
   * técnico vai àquele setor e não encontra avaria alguma.
   */
  matchReportLocation(report) {
    const locId = report.locationId || '';
    const locName = String(report.locationName || '').trim().toLowerCase();

    // 1 e 2 — por id, exato
    for (const sec of this.sectors) {
      for (const room of (sec.rooms || [])) {
        if (locId && locId === room.id) return { roomId: room.id, sectorId: sec.id };
      }
      if (locId && locId === sec.code) return { roomId: null, sectorId: sec.id };
    }

    if (!locName) return { roomId: null, sectorId: null };

    // 3 — por nome de sala, igualdade e não "contém"
    for (const sec of this.sectors) {
      for (const room of (sec.rooms || [])) {
        if (String(room.name || '').trim().toLowerCase() === locName) {
          return { roomId: room.id, sectorId: sec.id };
        }
      }
    }

    // 4 — por nome de setor
    for (const sec of this.sectors) {
      if (String(sec.name || '').trim().toLowerCase() === locName) {
        return { roomId: null, sectorId: sec.id };
      }
    }

    return { roomId: null, sectorId: null };
  }

  aggregateIssues(activeReports) {
    // `unmatched` guarda o que não se conseguiu atribuir. Não se perde nada:
    // continua a aparecer na lista de Intervenções, só não inventa um número
    // num quadrado ao acaso.
    const stats = { sectors: {}, rooms: {}, unmatched: [] };

    this.sectors.forEach(sec => {
      stats.sectors[sec.id] = { total: 0, critical: 0, inProgress: 0, reports: [] };
      sec.rooms.forEach(room => {
        stats.rooms[room.id] = { total: 0, critical: 0, inProgress: 0, reports: [] };
      });
    });

    const contar = (alvo, r) => {
      alvo.total++;
      if (r.priority === 'critical') alvo.critical++;
      if (r.status === 'in_progress') alvo.inProgress++;
      alvo.reports.push(r);
    };

    activeReports.forEach(r => {
      const { roomId, sectorId } = this.matchReportLocation(r);

      if (!sectorId) {
        stats.unmatched.push(r);
        return;
      }

      if (stats.sectors[sectorId]) contar(stats.sectors[sectorId], r);
      if (roomId && stats.rooms[roomId]) contar(stats.rooms[roomId], r);
    });

    return stats;
  }

  getSectorSvg(iconType) {
    switch (iconType) {
      case 'poente':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/></svg>`;
      case 'nascente':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
      case 'norte':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      case 'sul':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
      case 'relvado':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="12" y1="4" x2="12" y2="20"></line><circle cx="12" cy="12" r="4"></circle></svg>`;
      case 'tecnica':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
      case 'exterior':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg>`;
    }
  }

  bindEvents() {
    if (!this.container) return;

    // Pesquisa. O foco e o cursor voltam ao fim do texto: sem isto, cada
    // letra escrita mandava o cursor para o início do campo.
    const searchInput = this.container.querySelector('#input-search-sectors');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.refreshBody({ focoNaPesquisa: true });
      });
    }

    const clearSearch = this.container.querySelector('#btn-clear-sec-search');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        this.refreshBody();
      });
    }

    // Quadrado de setor: abre as salas
    this.container.querySelectorAll('.ev-sector').forEach(btn => {
      btn.addEventListener('click', () => {
        haptics.tap();
        this.openSectorId = btn.dataset.sectorId;
        this.refreshBody();
      });
    });

    // Voltar aos setores
    const btnBack = this.container.querySelector('#btn-back-sectors');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        haptics.tap();
        this.openSectorId = null;
        this.refreshBody();
      });
    }

    // Caixa de sala: registar avaria naquela sala
    this.container.querySelectorAll('.ev-room').forEach(tile => {
      const abrirRegisto = () => {
        haptics.tap();
        if (this.onNewReportForRoom) {
          this.onNewReportForRoom(tile.dataset.roomId, tile.dataset.roomName);
        }
      };

      tile.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        abrirRegisto();
      });

      tile.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        abrirRegisto();
      });
    });

    // Ver as intervenções de uma sala
    this.container.querySelectorAll('[data-action="view-issues"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        haptics.tap();
        if (this.onViewRoomReports) {
          this.onViewRoomReports(btn.dataset.roomName);
        }
      });
    });
  }

  refreshBody({ focoNaPesquisa = false } = {}) {
    const section = this.container.querySelector('.stadium-nav-view');
    if (!section) return;

    section.innerHTML = this.renderBody();
    this.bindEvents();

    if (focoNaPesquisa) {
      const input = this.container.querySelector('#input-search-sectors');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }
}
