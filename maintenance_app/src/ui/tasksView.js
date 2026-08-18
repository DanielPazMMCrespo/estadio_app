import { tasksRepo, todayISO, tomorrowISO } from '../db/tasksRepo.js';
import { speechService } from '../services/speechService.js';
import { toast } from './toast.js';
import { haptics } from '../services/haptics.js';

import { esc } from '../utils/html.js';
/**
 * Ecrã TAREFAS — hoje e amanhã, para um técnico de luvas com uma mão livre.
 *
 * Contrato (outro agente instancia isto):
 *   new TasksViewComponent(container, {
 *     onNewTaskForLocation,  // (apply) => void — ver abaixo
 *     onOpenReport           // (reportId) => void
 *   })
 *   await view.render()
 *   await view.refresh()
 *
 * onNewTaskForLocation(apply): chamado quando o técnico toca em "Escolher local
 * do estádio" dentro de "Mais detalhes" na folha de nova tarefa. Recebe uma
 * função `apply({ locationId, locationName })` que o seletor de locais deve
 * chamar para preencher o campo. Se a opção não for passada, o campo de local
 * fica só como texto livre (continua a funcionar).
 *
 * onOpenReport(reportId): chamado quando uma tarefa que traz `reportId`
 * (tarefas nascidas de uma avaria) é tocada, ou pelo botão "Ver avaria".
 */

const SVG_CHECK = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const SVG_REPEAT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';
const SVG_PIN_LOC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
const SVG_ALERT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 9v5"></path><path d="M12 17.5h.01"></path><path d="M10.3 3.9 1.8 18.4A2 2 0 0 0 3.5 21.4h17A2 2 0 0 0 22.2 18.4L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg>';

const RECUR_LABELS = {
  daily: 'Repete todos os dias',
  weekly: 'Repete todas as semanas',
  monthly: 'Repete todos os meses'
};

export class TasksViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNewTaskForLocation = options.onNewTaskForLocation || null;
    this.onOpenReport = options.onOpenReport || null;

    this.overdue = [];
    this.today = [];
    this.tomorrow = [];
    this.doneToday = [];
    this.doneOpen = false;
    this.sheetLocation = { locationId: '', locationName: '' };
    this.dictationCleanup = null;
  }

  /* ===================== dados ===================== */

  async load() {
    try {
      const [overdue, today, tomorrow] = await Promise.all([
        tasksRepo.getOverdue(),
        tasksRepo.getToday(),
        tasksRepo.getTomorrow()
      ]);
      this.overdue = overdue;
      this.today = today.filter(t => !t.done);
      this.doneToday = today.filter(t => !!t.done);
      this.tomorrow = tomorrow.filter(t => !t.done);
    } catch (err) {
      console.error('[Tarefas] Erro ao carregar:', err);
      this.overdue = [];
      this.today = [];
      this.tomorrow = [];
      this.doneToday = [];
    }
  }

  /* ===================== render ===================== */

  async render() {
    if (!this.container) return;
    await this.load();

    this.container.innerHTML = `
      <section class="tv-view animate-fade-in">
        <button type="button" class="tv-primary-action" id="tv-btn-new">+ Nova tarefa</button>

        <div id="tv-body">${this.renderBody()}</div>
      </section>
    `;

    this.bindEvents();
  }

  async refresh() {
    if (!this.container) return;
    if (!this.container.querySelector('#tv-body')) {
      await this.render();
      return;
    }
    await this.load();
    const body = this.container.querySelector('#tv-body');
    body.innerHTML = this.renderBody();
    this.bindBodyEvents();
  }

  renderBody() {
    const nothing = !this.overdue.length && !this.today.length && !this.tomorrow.length && !this.doneToday.length;
    if (nothing) return this.renderEmpty();

    return `
      ${this.renderOverdue()}

      <section class="tv-block">
        <header class="tv-block-head">
          <h2 class="tv-block-title">Hoje</h2>
          <p class="tv-block-date">${esc(formatDayLong(todayISO()))}</p>
        </header>
        ${this.today.length
          ? this.today.map(t => this.renderTask(t, 'today')).join('')
          : '<p class="tv-block-empty">Nada marcado para hoje.</p>'}
      </section>

      <section class="tv-block">
        <header class="tv-block-head">
          <h2 class="tv-block-title">Amanhã</h2>
          <p class="tv-block-date">${esc(formatDayLong(tomorrowISO()))}</p>
        </header>
        ${this.tomorrow.length
          ? this.tomorrow.map(t => this.renderTask(t, 'tomorrow')).join('')
          : '<p class="tv-block-empty">Nada marcado para amanhã.</p>'}
      </section>

      ${this.renderDoneToday()}
    `;
  }

  renderEmpty() {
    return `
      <div class="tv-empty">
        <h2 class="tv-empty-title">Sem tarefas</h2>
        <p class="tv-empty-text">Toque no botão azul aqui em cima para marcar a primeira.</p>
      </div>
    `;
  }

  renderOverdue() {
    if (!this.overdue.length) return '';
    return `
      <section class="tv-block tv-overdue">
        <header class="tv-overdue-head">
          <span class="tv-overdue-icon">${SVG_ALERT}</span>
          <h2 class="tv-overdue-title">Em atraso (${this.overdue.length})</h2>
        </header>
        ${this.overdue.map(t => this.renderTask(t, 'overdue')).join('')}
      </section>
    `;
  }

  renderDoneToday() {
    if (!this.doneToday.length) return '';
    return `
      <section class="tv-block tv-done-block">
        <button type="button" class="tv-done-toggle" id="tv-done-toggle" aria-expanded="${this.doneOpen ? 'true' : 'false'}">
          <span>Feitas hoje (${this.doneToday.length})</span>
          <span class="tv-done-caret">${this.doneOpen ? '&#9650;' : '&#9660;'}</span>
        </button>
        <div class="tv-done-list" ${this.doneOpen ? '' : 'hidden'}>
          ${this.doneToday.map(t => `
            <div class="tv-task tv-task--done" data-task-id="${esc(t.id)}">
              <div class="tv-task-main">
                <p class="tv-task-title">${esc(t.title)}</p>
                ${t.locationName ? `<p class="tv-task-loc">${SVG_PIN_LOC}<span>${esc(t.locationName)}</span></p>` : ''}
              </div>
              <button type="button" class="tv-undo" data-action="undo" data-id="${esc(t.id)}">Desfazer</button>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderTask(task, group) {
    const recur = RECUR_LABELS[task.recurring] || '';
    const showDefer = group === 'today';
    const showPull = group === 'overdue' || group === 'tomorrow';
    const overdueDate = group === 'overdue' ? formatDayShort(task.dueDate) : '';

    return `
      <article class="tv-task${task.priority === 'critical' ? ' tv-task--crit' : ''}" data-task-id="${esc(task.id)}">
        <button type="button" class="tv-check" data-action="done" data-id="${esc(task.id)}"
                aria-label="Marcar como feito: ${esc(task.title)}">
          <span class="tv-check-glyph">${SVG_CHECK}</span>
        </button>

        <div class="tv-task-main" data-action="open-detail" data-id="${esc(task.id)}">
          <div class="tv-task-titlerow">
            <p class="tv-task-title">${esc(task.title)}</p>
            ${task.priority === 'critical' ? '<span class="tv-prio-chip tv-prio-chip--crit">Crítica</span>' : ''}
            ${task.priority === 'medium' ? '<span class="tv-prio-chip tv-prio-chip--med">Média</span>' : ''}
            ${task.priority === 'low' ? '<span class="tv-prio-chip tv-prio-chip--low">Baixa</span>' : ''}
          </div>
          ${task.locationName ? `<p class="tv-task-loc">${SVG_PIN_LOC}<span>${esc(task.locationName)}</span></p>` : ''}
          ${task.notes ? `<p class="tv-task-notes"><span>${esc(task.notes)}</span></p>` : ''}
          ${overdueDate ? `<p class="tv-task-late">Era para ${esc(overdueDate)}</p>` : ''}
          ${recur ? `<p class="tv-task-recur">${SVG_REPEAT}<span>${recur}</span></p>` : ''}
        </div>

        <div class="tv-task-side">
          ${showDefer ? `<button type="button" class="tv-defer" data-action="defer" data-id="${esc(task.id)}">Amanhã</button>` : ''}
          ${showPull ? `<button type="button" class="tv-defer" data-action="pull" data-id="${esc(task.id)}">Hoje</button>` : ''}
          ${task.reportId && this.onOpenReport ? `<button type="button" class="tv-defer tv-link" data-action="report" data-id="${esc(task.reportId)}">Intervenção</button>` : ''}
          <div class="tv-task-chevron" data-action="open-detail" data-id="${esc(task.id)}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </article>
    `;
  }

  /* ===================== eventos ===================== */

  bindEvents() {
    const btnNew = this.container.querySelector('#tv-btn-new');
    if (btnNew) btnNew.addEventListener('click', () => this.openNewTaskSheet());
    this.bindBodyEvents();
  }

  bindBodyEvents() {
    const body = this.container.querySelector('#tv-body');
    if (!body) return;

    const toggle = body.querySelector('#tv-done-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        this.doneOpen = !this.doneOpen;
        const list = body.querySelector('.tv-done-list');
        if (list) list.hidden = !this.doneOpen;
        toggle.setAttribute('aria-expanded', this.doneOpen ? 'true' : 'false');
        const caret = toggle.querySelector('.tv-done-caret');
        if (caret) caret.innerHTML = this.doneOpen ? '&#9650;' : '&#9660;';
      });
    }

    body.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'done') return this.markDone(id, btn);
        if (action === 'undo') return this.undoDone(id);
        if (action === 'defer') return this.defer(id);
        if (action === 'pull') return this.pullToToday(id);
        if (action === 'report' && this.onOpenReport) return this.onOpenReport(id);
        if (action === 'open-detail') return this.openTaskDetailSheet(id);
      });
    });

    body.querySelectorAll('.tv-task').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        const id = card.dataset.taskId;
        if (id) this.openTaskDetailSheet(id);
      });
    });
  }

  async markDone(id, btn) {
    const row = btn ? btn.closest('.tv-task') : null;
    if (row) row.classList.add('tv-task--leaving');
    try {
      const { nextTask } = await tasksRepo.toggleDone(id);
      haptics.success();
      if (nextTask) {
        toast.success(`Feito. A próxima fica para ${formatDayLong(nextTask.dueDate)}.`);
      } else {
        toast.success('Feito.');
      }
    } catch (err) {
      console.error('[Tarefas] toggleDone:', err);
      if (row) row.classList.remove('tv-task--leaving');
      toast.error('Não foi possível marcar como feito.');
      return;
    }
    setTimeout(() => { this.refresh(); }, 260);
  }

  async undoDone(id) {
    try {
      await tasksRepo.toggleDone(id);
      toast.info('Tarefa reaberta.');
    } catch (err) {
      console.error('[Tarefas] undo:', err);
      toast.error('Não foi possível reabrir a tarefa.');
      return;
    }
    await this.refresh();
  }

  async defer(id) {
    try {
      await tasksRepo.moveToTomorrow(id);
      toast.success('Passou para amanhã.');
    } catch (err) {
      console.error('[Tarefas] moveToTomorrow:', err);
      toast.error('Não foi possível passar a tarefa.');
      return;
    }
    await this.refresh();
  }

  async pullToToday(id) {
    try {
      await tasksRepo.update(id, { dueDate: todayISO() });
      toast.success('Passou para hoje.');
    } catch (err) {
      console.error('[Tarefas] pullToToday:', err);
      toast.error('Não foi possível passar a tarefa.');
      return;
    }
    await this.refresh();
  }

  /* ===================== folha de nova tarefa ===================== */

  openNewTaskSheet() {
    this.closeNewTaskSheet();
    this.sheetLocation = { locationId: '', locationName: '' };

    const overlay = document.createElement('div');
    overlay.id = 'tv-sheet-new-task';
    overlay.className = 'bottom-sheet-overlay animate-fade-in';
    overlay.innerHTML = `
      <div class="bottom-sheet-content tv-sheet" style="max-height: 95vh; display: flex; flex-direction: column;">
        <div class="sheet-drag-handle"><div class="drag-bar"></div></div>

        <div class="tv-sheet-head">
          <h2 class="tv-sheet-title">Nova tarefa</h2>
          <button type="button" class="btn-close-detail" id="tv-sheet-close" aria-label="Fechar">&times;</button>
        </div>

        <div style="flex: 1; overflow-y: auto;">
          <div class="form-group" style="margin-bottom: 12px;">
            <div class="form-label-row">
              <label class="form-label" for="tv-new-title">O que há a fazer? *</label>
              <button type="button" id="tv-mic-new" class="btn-secondary btn-dictate" title="Escrita por voz">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <span>Escrita por voz</span>
              </button>
            </div>
            <textarea id="tv-new-title" class="form-textarea tv-new-title" rows="2"
                      placeholder="Ex: Trocar lâmpada na bancada norte... (pode usar escrita por voz)"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label">Prioridade</label>
            <div class="tv-priority-group" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;" id="tv-new-priority-group">
              <button type="button" class="btn-secondary tv-prio-btn" data-priority="low" style="padding: 10px 4px; font-size: 0.95rem;">Baixa</button>
              <button type="button" class="btn-secondary tv-prio-btn active" data-priority="medium" style="padding: 10px 4px; font-size: 0.95rem; border-color: var(--color-gold); color: var(--color-gold);">Média</button>
              <button type="button" class="btn-secondary tv-prio-btn" data-priority="critical" style="padding: 10px 4px; font-size: 0.95rem;">Crítica</button>
            </div>
          </div>

          <button type="button" class="tv-more-toggle" id="tv-more-toggle" aria-expanded="false">
            Mais detalhes (opcional)
          </button>

          <div class="tv-more" id="tv-more" hidden>
            <label class="form-label" for="tv-new-loc">Local</label>
            <input type="text" id="tv-new-loc" class="form-input" placeholder="Ex: Bancada norte" />
            ${this.onNewTaskForLocation ? '<button type="button" class="tv-pick-loc" id="tv-pick-loc">Escolher local do estádio</button>' : ''}

            <label class="form-label" for="tv-new-notes">Notas</label>
            <textarea id="tv-new-notes" class="form-textarea" rows="2" placeholder="O que for útil lembrar"></textarea>
          </div>
        </div>

        <div style="padding-top: 12px; background: var(--color-bg); border-top: 1px solid var(--color-border);">
          <p class="tv-sheet-hint">Escolha o dia. Fica gravado logo.</p>
          <div class="tv-sheet-days">
            <button type="button" class="tv-day-btn tv-day-btn--today" id="tv-save-today">Hoje</button>
            <button type="button" class="tv-day-btn" id="tv-save-tomorrow">Amanhã</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const micBtn = overlay.querySelector('#tv-mic-new');
    const titleField = overlay.querySelector('#tv-new-title');
    if (micBtn && titleField) {
      this.dictationCleanup = speechService.attachDictation(micBtn, titleField, {
        activeHtml: `
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--color-danger); animation:pulse 1s infinite;"></span>
          <span style="color:var(--color-danger);">A ouvir...</span>
        `
      });
    }

    let selectedPriority = 'medium';
    const prioGroup = overlay.querySelector('#tv-new-priority-group');
    if (prioGroup) {
      prioGroup.querySelectorAll('.tv-prio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          prioGroup.querySelectorAll('.tv-prio-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.color = '';
          });
          btn.classList.add('active');
          selectedPriority = btn.dataset.priority;
          if (selectedPriority === 'critical') {
            btn.style.borderColor = 'var(--color-danger)';
            btn.style.color = 'var(--color-danger)';
          } else if (selectedPriority === 'medium') {
            btn.style.borderColor = 'var(--color-gold)';
            btn.style.color = 'var(--color-gold)';
          } else {
            btn.style.borderColor = 'var(--color-stadium-green)';
            btn.style.color = 'var(--color-stadium-green)';
          }
        });
      });
    }

    const close = () => {
      if (this.dictationCleanup) {
        this.dictationCleanup();
        this.dictationCleanup = null;
      }
      this.closeNewTaskSheet();
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#tv-sheet-close').addEventListener('click', close);

    const more = overlay.querySelector('#tv-more');
    const moreToggle = overlay.querySelector('#tv-more-toggle');
    moreToggle.addEventListener('click', () => {
      const open = more.hidden;
      more.hidden = !open;
      moreToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    const pick = overlay.querySelector('#tv-pick-loc');
    if (pick && this.onNewTaskForLocation) {
      pick.addEventListener('click', () => {
        this.onNewTaskForLocation((loc = {}) => {
          this.sheetLocation = {
            locationId: loc.locationId || loc.id || '',
            locationName: loc.locationName || loc.name || ''
          };
          const field = document.getElementById('tv-new-loc');
          if (field) field.value = this.sheetLocation.locationName;
        });
      });
    }

    overlay.querySelector('#tv-save-today').addEventListener('click', () => this.saveNewTask(todayISO(), selectedPriority));
    overlay.querySelector('#tv-save-tomorrow').addEventListener('click', () => this.saveNewTask(tomorrowISO(), selectedPriority));

    if (titleField) setTimeout(() => { try { titleField.focus(); } catch (e) {} }, 60);
  }

  closeNewTaskSheet() {
    const existing = document.getElementById('tv-sheet-new-task');
    if (existing) existing.remove();
  }

  /* ===================== folha de detalhe / edição da tarefa ===================== */

  async openTaskDetailSheet(taskId) {
    this.closeTaskDetailSheet();
    let task = await tasksRepo.getById(taskId);
    if (!task) {
      toast.error('Tarefa não encontrada.');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'tv-sheet-detail-task';
    overlay.className = 'bottom-sheet-overlay animate-fade-in';
    overlay.style.zIndex = '9999';

    const isToday = task.dueDate === todayISO();
    const isTomorrow = task.dueDate === tomorrowISO();
    const isDone = !!task.done;
    let selectedPriority = task.priority || 'medium';

    overlay.innerHTML = `
      <div class="bottom-sheet-content tv-sheet">
        <div class="sheet-drag-handle"><div class="drag-bar"></div></div>

        <div class="tv-sheet-head">
          <div>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-brand-primary); text-transform: uppercase;">
              ${isDone ? 'Tarefa Concluída' : 'Tarefa Pendente'}
            </span>
            <h2 class="tv-sheet-title" style="margin-top: 2px;">Editar Tarefa</h2>
          </div>
          <button type="button" class="btn-close-detail" id="tv-detail-close" aria-label="Fechar">&times;</button>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <div class="form-label-row">
            <label class="form-label" for="tv-edit-title">Título da tarefa *</label>
            <button type="button" id="tv-mic-edit" class="btn-secondary btn-dictate" title="Escrita por voz">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              <span>Escrita por voz</span>
            </button>
          </div>
          <input type="text" id="tv-edit-title" class="form-input" value="${esc(task.title)}" placeholder="Ex: Trocar lâmpada" />
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label">Agendada para</label>
          <div class="tv-sheet-days" style="margin: 6px 0 0 0;">
            <button type="button" class="tv-day-btn${isToday ? ' tv-day-btn--today' : ''}" id="tv-edit-today">Hoje</button>
            <button type="button" class="tv-day-btn${isTomorrow ? ' tv-day-btn--today' : ''}" id="tv-edit-tomorrow">Amanhã</button>
          </div>
          <input type="date" id="tv-edit-custom-date" class="form-input" value="${task.dueDate || todayISO()}" style="margin-top: 8px;" />
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label">Nível de Prioridade</label>
          <div class="tv-priority-group" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;" id="tv-edit-priority-group">
            <button type="button" class="btn-secondary tv-prio-btn${selectedPriority === 'low' ? ' active' : ''}" data-priority="low" style="padding: 10px 4px; font-size: 0.95rem;${selectedPriority === 'low' ? ' border-color: var(--color-stadium-green); color: var(--color-stadium-green);' : ''}">Baixa</button>
            <button type="button" class="btn-secondary tv-prio-btn${selectedPriority === 'medium' ? ' active' : ''}" data-priority="medium" style="padding: 10px 4px; font-size: 0.95rem;${selectedPriority === 'medium' ? ' border-color: var(--color-gold); color: var(--color-gold);' : ''}">Média</button>
            <button type="button" class="btn-secondary tv-prio-btn${selectedPriority === 'critical' ? ' active' : ''}" data-priority="critical" style="padding: 10px 4px; font-size: 0.95rem;${selectedPriority === 'critical' ? ' border-color: var(--color-danger); color: var(--color-danger);' : ''}">Crítica</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" for="tv-edit-loc">Local do Estádio</label>
          <input type="text" id="tv-edit-loc" class="form-input" value="${esc(task.locationName || '')}" placeholder="Ex: Bancada Nascente, Piso 0" />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="tv-edit-notes">Notas e Instruções</label>
          <textarea id="tv-edit-notes" class="form-textarea" rows="3" placeholder="Detalhes adicionais, material necessário...">${esc(task.notes || '')}</textarea>
        </div>

        ${task.reportId && this.onOpenReport ? `
          <button type="button" class="btn-secondary" id="tv-detail-open-report" style="width: 100%; margin-bottom: 12px;">
            Ver Intervenção Associada
          </button>
        ` : ''}

        <button type="button" class="d-btn-primary-wide" id="tv-edit-save">Guardar Alterações</button>
        
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button type="button" class="btn-secondary" id="tv-edit-toggle-done" style="flex: 1;">
            ${isDone ? '↩ Reabrir Tarefa' : '✓ Marcar como Feita'}
          </button>
          <button type="button" class="btn-secondary" id="tv-edit-delete" style="color: var(--color-danger); border-color: var(--color-danger); flex: 1;">
            Apagar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const editMicBtn = overlay.querySelector('#tv-mic-edit');
    const editTitleField = overlay.querySelector('#tv-edit-title');
    if (editMicBtn && editTitleField) {
      this.dictationCleanup = speechService.attachDictation(editMicBtn, editTitleField, {
        activeHtml: `
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--color-danger); animation:pulse 1s infinite;"></span>
          <span style="color:var(--color-danger);">A ouvir...</span>
        `
      });
    }

    const prioGroup = overlay.querySelector('#tv-edit-priority-group');
    if (prioGroup) {
      prioGroup.querySelectorAll('.tv-prio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          prioGroup.querySelectorAll('.tv-prio-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.color = '';
          });
          btn.classList.add('active');
          selectedPriority = btn.dataset.priority;
          if (selectedPriority === 'critical') {
            btn.style.borderColor = 'var(--color-danger)';
            btn.style.color = 'var(--color-danger)';
          } else if (selectedPriority === 'medium') {
            btn.style.borderColor = 'var(--color-gold)';
            btn.style.color = 'var(--color-gold)';
          } else {
            btn.style.borderColor = 'var(--color-stadium-green)';
            btn.style.color = 'var(--color-stadium-green)';
          }
        });
      });
    }

    const close = () => {
      if (this.dictationCleanup) {
        this.dictationCleanup();
        this.dictationCleanup = null;
      }
      this.closeTaskDetailSheet();
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#tv-detail-close').addEventListener('click', close);

    let selectedDueDate = task.dueDate || todayISO();
    const customDateInput = overlay.querySelector('#tv-edit-custom-date');
    const btnToday = overlay.querySelector('#tv-edit-today');
    const btnTomorrow = overlay.querySelector('#tv-edit-tomorrow');

    btnToday.addEventListener('click', () => {
      selectedDueDate = todayISO();
      customDateInput.value = selectedDueDate;
      btnToday.classList.add('tv-day-btn--today');
      btnTomorrow.classList.remove('tv-day-btn--today');
    });

    btnTomorrow.addEventListener('click', () => {
      selectedDueDate = tomorrowISO();
      customDateInput.value = selectedDueDate;
      btnTomorrow.classList.add('tv-day-btn--today');
      btnToday.classList.remove('tv-day-btn--today');
    });

    customDateInput.addEventListener('change', (e) => {
      selectedDueDate = e.target.value;
      btnToday.classList.toggle('tv-day-btn--today', selectedDueDate === todayISO());
      btnTomorrow.classList.toggle('tv-day-btn--today', selectedDueDate === tomorrowISO());
    });

    const reportBtn = overlay.querySelector('#tv-detail-open-report');
    if (reportBtn && task.reportId && this.onOpenReport) {
      reportBtn.addEventListener('click', () => {
        close();
        this.onOpenReport(task.reportId);
      });
    }

    overlay.querySelector('#tv-edit-save').addEventListener('click', async () => {
      const title = (overlay.querySelector('#tv-edit-title')?.value || '').trim();
      if (!title) {
        toast.warning('O título é obrigatório.');
        return;
      }
      const locationName = (overlay.querySelector('#tv-edit-loc')?.value || '').trim();
      const notes = (overlay.querySelector('#tv-edit-notes')?.value || '').trim();

      try {
        await tasksRepo.update(task.id, {
          title,
          dueDate: selectedDueDate,
          priority: selectedPriority,
          locationName,
          notes
        });
        close();
        toast.success('Tarefa atualizada.');
        await this.refresh();
      } catch (err) {
        console.error('[Tarefas] update:', err);
        toast.error('Erro ao atualizar tarefa.');
      }
    });

    overlay.querySelector('#tv-edit-toggle-done').addEventListener('click', async () => {
      try {
        close();
        await this.markDone(task.id, null);
      } catch (err) {
        console.error('[Tarefas] toggle:', err);
      }
    });

    overlay.querySelector('#tv-edit-delete').addEventListener('click', async () => {
      const ok = window.confirm('Tem a certeza que deseja apagar esta tarefa?');
      if (!ok) return;
      try {
        await tasksRepo.remove(task.id);
        close();
        toast.success('Tarefa apagada.');
        await this.refresh();
      } catch (err) {
        console.error('[Tarefas] delete:', err);
        toast.error('Erro ao apagar tarefa.');
      }
    });
  }

  closeTaskDetailSheet() {
    const existing = document.getElementById('tv-sheet-detail-task');
    if (existing) existing.remove();
  }

  async saveNewTask(dueDate, priority = 'medium') {
    const overlay = document.getElementById('tv-sheet-new-task');
    if (!overlay) return;
    const title = (overlay.querySelector('#tv-new-title')?.value || '').trim();
    if (!title) {
      toast.warning('Escreva o que há a fazer.');
      const field = overlay.querySelector('#tv-new-title');
      if (field) try { field.focus(); } catch (e) {}
      return;
    }
    const typedLoc = (overlay.querySelector('#tv-new-loc')?.value || '').trim();
    const notes = (overlay.querySelector('#tv-new-notes')?.value || '').trim();

    try {
      await tasksRepo.create({
        title,
        dueDate,
        priority,
        notes,
        locationId: this.sheetLocation.locationId || '',
        locationName: typedLoc || this.sheetLocation.locationName || ''
      });
      this.closeNewTaskSheet();
      toast.success(dueDate === todayISO() ? 'Tarefa guardada para hoje.' : 'Tarefa guardada para amanhã.');
      await this.refresh();
    } catch (err) {
      console.error('[Tarefas] create:', err);
      toast.error('Não foi possível guardar a tarefa.');
    }
  }

  /* ===================== utilitários ===================== */

}

/** 'YYYY-MM-DD' -> Date local (sem apanhar UTC pelo caminho). */
function isoToLocalDate(iso) {
  const parts = String(iso || '').slice(0, 10).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
  return new Date(y, m, d);
}

/** "quinta, 14 de agosto" */
export function formatDayLong(iso) {
  const txt = isoToLocalDate(iso).toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  return txt.replace('-feira', '');
}

/** "14 de agosto" */
export function formatDayShort(iso) {
  return isoToLocalDate(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}
