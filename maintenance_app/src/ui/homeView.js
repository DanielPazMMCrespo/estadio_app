import { reportsRepo } from '../db/reportsRepo.js';
import { tasksRepo } from '../db/tasksRepo.js';
import { toolsRepo } from '../db/toolsRepo.js';
import { esc, attr } from '../utils/html.js';
import { haptics } from '../services/haptics.js';

/**
 * Página principal em quadrados — "quadrados vivos".
 *
 * A grelha grande fica: um quadrado de 126px acerta-se de luvas, uma linha de
 * lista de 14px não. Mas o quadrado passa a dizer o seu número.
 *
 * Porque mudou: com 7 avarias abertas e 3 críticas na base de dados, a versão
 * anterior desta página mostrava zero dados. Só rótulos. Medido: 52% do
 * primeiro ecrã gasto em botões que não abriam nenhum destino novo — três
 * repetiam a barra de baixo e três estavam a dois toques no menu Mais.
 * Ver REVISAO-DESIGN-2026.md na raiz.
 *
 * O que ficou:
 *   - o botão verde de registar, intocado: é a ação mais usada;
 *   - quatro quadrados vivos, com o número em grande;
 *   - um quadrado deitado "Mais" no lugar dos três que se repetiam.
 *
 * Regra das cores: o quadrado só grita quando há razão. Num dia sem avarias
 * fica branco. Vermelho é crítico, âmbar é atenção. Nada de vermelho
 * decorativo — perde o significado.
 */
const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;

const TILE_ICONS = {
  reports: `<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`,
  tasks: `<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>`,
  stadium: `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`,
  tools: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>`,
  more: `<line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line>`
};

/** Números todos a zero — o que se mostra se a base de dados não abrir. */
const NUMEROS_VAZIOS = {
  abertas: 0,
  criticas: 0,
  emCurso: 0,
  tarefasHoje: 0,
  tarefasCriticas: 0,
  tarefasAtrasadas: 0,
  locaisComAvaria: 0,
  stockBaixo: 0
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
    // Ouvinte de rede guardado para o poder retirar depois (ver destroy()).
    this.onNetworkChange = null;
    this.numeros = { ...NUMEROS_VAZIOS };
  }

  saudacao() {
    const h = new Date().getHours();
    if (h < 13) return 'Bom dia';
    if (h < 20) return 'Boa tarde';
    return 'Boa noite';
  }

  /**
   * Lê da base de dados só o que os quadrados precisam de dizer.
   *
   * Nunca lança: sem rede e sem base de dados é o caso NORMAL desta app, e um
   * quadrado a zero é melhor que um ecrã em branco. Os erros ficam na consola.
   */
  async carregarNumeros() {
    const n = { ...NUMEROS_VAZIOS };

    try {
      const [reports, hoje, atrasadas, baixas] = await Promise.all([
        reportsRepo.getAll(),
        tasksRepo.getToday(),
        tasksRepo.getOverdue(),
        toolsRepo.getLowStock()
      ]);

      const abertas = reports.filter(r => r.status !== 'resolved');
      n.abertas = abertas.length;
      n.criticas = abertas.filter(r => r.priority === 'critical').length;
      n.emCurso = abertas.filter(r => r.status === 'in_progress').length;

      // Locais distintos com avaria aberta. Conta-se pelo locationId, que é
      // exato; não se compara nomes. Um registo sem local não conta.
      n.locaisComAvaria = new Set(abertas.map(r => r.locationId).filter(Boolean)).size;

      const porFazer = hoje.filter(t => !t.done);
      n.tarefasHoje = porFazer.length;
      n.tarefasCriticas = porFazer.filter(t => t.priority === 'critical').length;
      n.tarefasAtrasadas = atrasadas.length;

      n.stockBaixo = baixas.length;
    } catch (e) {
      console.error('[HomeView] Erro ao ler os números:', e);
    }

    return n;
  }

  /** Quadrado vivo: glifo e número em cima, nome e detalhe em baixo. */
  quadradoVivo({ target, iconKey, iconClass, nome, numero, detalhe, estado }) {
    const classeEstado = estado ? ` ht-tile-${estado}` : '';
    const voz = `${nome}: ${numero}${detalhe ? ', ' + detalhe : ''}`;

    return `
          <button type="button" class="ht-tile ht-tile-live${classeEstado} touch-target" data-target="${attr(target)}" aria-label="${attr(voz)}">
            <span class="ht-live-top">
              <span class="ht-icon ${iconClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TILE_ICONS[iconKey]}</svg>
              </span>
              <span class="ht-num">${esc(String(numero))}</span>
            </span>
            <span class="ht-live-foot">
              <span class="ht-name">${esc(nome)}</span>
              <span class="ht-meta">${esc(detalhe)}</span>
            </span>
          </button>`;
  }

  /** As quatro caixas, já com o estado de cor decidido. */
  quadrados() {
    const n = this.numeros;

    const avarias = this.quadradoVivo({
      target: 'history',
      iconKey: 'reports',
      iconClass: 'ht-icon-reports',
      nome: 'Avarias',
      numero: n.abertas,
      detalhe: n.criticas > 0
        ? `${n.criticas} crítica${n.criticas === 1 ? '' : 's'}`
        : (n.emCurso > 0 ? `${n.emCurso} em curso` : 'nada aberto'),
      estado: n.criticas > 0 ? 'alert' : (n.abertas > 0 ? 'warn' : 'calm')
    });

    const tarefas = this.quadradoVivo({
      target: 'tasks',
      iconKey: 'tasks',
      iconClass: 'ht-icon-tasks',
      nome: 'Tarefas',
      numero: n.tarefasHoje,
      detalhe: n.tarefasAtrasadas > 0
        ? `${n.tarefasAtrasadas} em atraso`
        : (n.tarefasCriticas > 0 ? `hoje · ${n.tarefasCriticas} crítica${n.tarefasCriticas === 1 ? '' : 's'}` : 'para hoje'),
      estado: n.tarefasAtrasadas > 0 ? 'alert' : (n.tarefasHoje > 0 ? 'warn' : 'calm')
    });

    const estadio = this.quadradoVivo({
      target: 'sectors',
      iconKey: 'stadium',
      iconClass: 'ht-icon-stadium',
      nome: 'Estádio',
      numero: n.locaisComAvaria,
      // "locais com avaria" parte em duas linhas num quadrado de meia largura
      // e desalinha a grelha. O nome do quadrado já diz "Estádio".
      detalhe: 'com avaria',
      estado: 'calm'
    });

    const ferramentas = this.quadradoVivo({
      target: 'tools',
      iconKey: 'tools',
      iconClass: 'ht-icon-tools',
      nome: 'Ferramentas',
      numero: n.stockBaixo,
      detalhe: n.stockBaixo > 0 ? 'abaixo do mínimo' : 'stock em ordem',
      estado: n.stockBaixo > 0 ? 'warn' : 'calm'
    });

    return avarias + tarefas + estadio + ferramentas;
  }

  /**
   * O quadrado deitado do fim. Substitui os três quadrados que repetiam a
   * barra de baixo (Intervenções, Tarefas, Mais) e o Equipamento, que estava
   * a dois toques de qualquer maneira.
   */
  quadradoMais() {
    return `
          <button type="button" class="ht-tile ht-tile-wide ht-tile-lay touch-target" data-target="more" aria-label="Mais: equipamento, métricas, notas, definições">
            <span class="ht-icon ht-icon-more">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TILE_ICONS.more}</svg>
            </span>
            <span class="ht-live-foot">
              <span class="ht-name">Mais</span>
              <span class="ht-meta">Equipamento · Métricas · Notas · Definições</span>
            </span>
          </button>`;
  }

  async render() {
    if (!this.container) return;

    this.numeros = await this.carregarNumeros();

    this.container.innerHTML = `
      <section class="home-tiles animate-fade-in">
        <div class="v-header">
          <h2 class="v-title">${this.saudacao()}!</h2>
          <p class="v-subtitle">Estádio Municipal de Leiria</p>
        </div>

        <div class="ht-grid">
          <button type="button" id="btn-hero-report" class="ht-tile ht-tile-wide ht-tile-primary touch-target" aria-label="Registar nova avaria">
            <span class="ht-primary-row">
              ${PLUS_ICON}
              <span class="ht-primary-label">Registar avaria</span>
            </span>
            <span class="ht-primary-hint">Foto, voz ou texto</span>
          </button>
${this.quadrados()}
${this.quadradoMais()}
        </div>

        <div id="home-offline-indicator" class="ht-offline">
          Sem ligação. Pode continuar a trabalhar: fica tudo gravado no telemóvel.
        </div>
      </section>
    `;

    this.bindEvents();
    this.checkOfflineState();
  }

  /**
   * O aviso de "sem ligação" ouve a rede na window, não no container. Como a
   * window sobrevive à vista, os ouvintes têm de ser retirados à mão: sem isto
   * cada visita à página principal deixava dois ouvintes atrás de si.
   */
  checkOfflineState() {
    const indicator = this.container.querySelector('#home-offline-indicator');
    if (!indicator) return;

    // Uma nova renderização substitui o indicador anterior: larga o ouvinte
    // antigo antes de pôr o novo, senão ficam os dois a apontar para um nó
    // que já não está no ecrã.
    this.removeNetworkListeners();

    this.onNetworkChange = () => {
      indicator.classList.toggle('is-visible', !navigator.onLine);
    };

    window.addEventListener('online', this.onNetworkChange);
    window.addEventListener('offline', this.onNetworkChange);
    this.onNetworkChange();
  }

  removeNetworkListeners() {
    if (!this.onNetworkChange) return;
    window.removeEventListener('online', this.onNetworkChange);
    window.removeEventListener('offline', this.onNetworkChange);
    this.onNetworkChange = null;
  }

  /** Chamar antes de trocar de vista ou de criar outra HomeViewComponent. */
  destroy() {
    this.removeNetworkListeners();
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

    // 2. Os quadrados vivos navegam para a página respetiva
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
