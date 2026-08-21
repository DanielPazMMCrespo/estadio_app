import { reportsRepo } from '../db/reportsRepo.js';
import { tasksRepo } from '../db/tasksRepo.js';
import { esc } from '../utils/html.js';
import { haptics } from '../services/haptics.js';

export class HomeViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onOpenFullReport = options.onOpenFullReport || null;
    this.onViewAllTasks = options.onViewAllTasks || null;
    this.onOpenTask = options.onOpenTask || null;
    this.onOpenReport = options.onOpenReport || null;
    this.onViewAllReports = options.onViewAllReports || null;
  }

  saudacao() {
    const h = new Date().getHours();
    if (h < 13) return 'Bom dia';
    if (h < 20) return 'Boa tarde';
    return 'Boa noite';
  }

  formatTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  async render() {
    if (!this.container) return;

    let tasks = [];
    let todayReports = [];
    try {
      tasks = await tasksRepo.getToday();
      todayReports = await reportsRepo.getToday();
    } catch (e) {
      console.error('[HomeView] Erro ao carregar dados do turno:', e);
    }

    const pendingTasks = tasks.filter(t => !t.done);
    const recentTodayReports = todayReports.slice(0, 3);

    this.container.innerHTML = `
      <section class="home-view animate-fade-in" style="padding: 8px 4px 24px; display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Cabeçalho do Turno -->
        <div style="margin-top: 4px;">
          <h2 style="font-size: var(--fs-display); font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.2;">
            ${this.saudacao()}!
          </h2>
          <p style="color: var(--color-text-secondary); font-size: var(--fs-body); margin: 4px 0 0 0;">
            Estádio Municipal de Leiria • Turno de Manutenção
          </p>
        </div>
        
        <!-- Bloco 1: Ação Hero Principal (Registar Avaria) -->
        <div>
          <button type="button" id="btn-hero-report" class="touch-target" aria-label="Registar nova avaria" style="width: 100%; background: var(--color-brand-primary); color: var(--color-on-accent); padding: 20px 18px; border-radius: var(--radius-card); border: none; box-shadow: var(--shadow-md); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; cursor: pointer; transition: transform 120ms ease;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <span style="font-size: 1.4rem; font-weight: 800; letter-spacing: -0.01em;">Registar</span>
            </div>
            
            <!-- Pistas táteis: O que posso usar? -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 14px; font-size: var(--fs-label); color: rgba(255, 255, 255, 0.9); font-weight: 600;">
              <span>📷 Foto</span>
              <span>•</span>
              <span>🎙️ Voz</span>
              <span>•</span>
              <span>✍️ Texto</span>
            </div>
          </button>
        </div>

        <!-- Bloco 2: As Suas Tarefas de Hoje -->
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 18px 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" stroke-width="2.2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              <h3 style="font-size: var(--fs-title); font-weight: 800; color: var(--color-text); margin: 0;">
                Tarefas de Hoje
              </h3>
            </div>
            ${tasks.length > 0 ? `
              <button type="button" id="btn-view-tasks" style="background: transparent; border: none; color: var(--color-brand-primary); font-size: var(--fs-label); font-weight: 700; cursor: pointer; padding: 4px;">
                Ver todas (${tasks.length})
              </button>
            ` : ''}
          </div>

          ${pendingTasks.length === 0 ? `
            <div style="background: var(--tint-green); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
              <div style="color: var(--color-success); font-size: 24px; font-weight: 800;">✓</div>
              <div style="color: var(--color-success-text); font-size: var(--fs-body); font-weight: 700;">
                Tudo concluído! Não há tarefas pendentes para hoje.
              </div>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${pendingTasks.slice(0, 2).map(t => `
                <div class="home-task-item touch-target" data-id="${t.id}" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 14px; display: flex; align-items: center; gap: 14px; cursor: pointer;">
                  <button type="button" class="btn-check-task touch-target" data-id="${t.id}" title="Marcar como feita" style="background: var(--color-card); border: 2px solid var(--color-border); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
                  </button>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 800; font-size: var(--fs-body-lg); color: var(--color-text); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${esc(t.title)}
                    </div>
                    <div style="font-size: var(--fs-label); color: var(--color-text-secondary); display: flex; align-items: center; gap: 4px;">
                      <span>📍 ${esc(t.locationName || 'Estádio')}</span>
                      ${t.priority === 'critical' ? `<span style="background: var(--tint-red); color: var(--color-danger-text); font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 14px; margin-left: 6px;">URGENTE</span>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Bloco 3: Confirmação do Trabalho de Hoje (Paz de Espírito) -->
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 18px 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <h3 style="font-size: var(--fs-title); font-weight: 800; color: var(--color-text); margin: 0;">
                Registado Hoje por Si
              </h3>
            </div>
            ${todayReports.length > 0 ? `
              <button type="button" id="btn-view-history" style="background: transparent; border: none; color: var(--color-brand-primary); font-size: var(--fs-label); font-weight: 700; cursor: pointer; padding: 4px;">
                Histórico
              </button>
            ` : ''}
          </div>

          ${recentTodayReports.length === 0 ? `
            <div style="background: var(--color-surface); border-radius: var(--radius-sm); padding: 14px 16px; text-align: center; color: var(--color-text-secondary); font-size: var(--fs-body);">
              Ainda não fez nenhum registo hoje.<br>
              <span style="font-size: var(--fs-label); color: var(--color-text-muted);">Quando encontrar uma avaria, toque no botão verde acima.</span>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${recentTodayReports.map(r => `
                <div class="home-report-item touch-target" data-id="${r.id}" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: var(--fs-label); font-weight: 700; color: var(--color-text-secondary);">
                      🕒 ${this.formatTime(r.date || r.createdAt)}
                    </span>
                    <span style="background: var(--tint-green); color: var(--color-success-text); font-weight: 700; font-size: 14px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--color-border);">
                      ✓ Guardado
                    </span>
                  </div>
                  <div style="font-size: var(--fs-body); font-weight: 700; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${esc(r.description)}
                  </div>
                  <div style="font-size: var(--fs-label); color: var(--color-text-secondary);">
                    📍 ${esc(r.locationName || 'Estádio')}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Indicador de Ligação Offline Reassegurador -->
        <div id="home-offline-indicator" style="display: none; background: var(--tint-amber); border: 1px solid var(--color-gold); border-radius: var(--radius-sm); padding: 12px 16px; color: var(--color-warning-text); font-size: var(--fs-label); font-weight: 700; text-align: center;">
          ⚡ Sem ligação à internet. Pode continuar a trabalhar normalmente, os registos ficam gravados no telemóvel.
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
      if (indicator) indicator.style.display = navigator.onLine ? 'none' : 'block';
    };
    
    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);
    updateState();
  }

  bindEvents() {
    // 1. Botão Hero de Novo Registo
    const btnHero = this.container.querySelector('#btn-hero-report');
    if (btnHero) {
      btnHero.addEventListener('click', () => {
        haptics.success();
        if (this.onOpenFullReport) {
          this.onOpenFullReport({ description: '', locationId: '', locationName: '' });
        }
      });
    }

    // 2. Navegação para ver todas as tarefas
    const btnViewTasks = this.container.querySelector('#btn-view-tasks');
    if (btnViewTasks && this.onViewAllTasks) {
      btnViewTasks.addEventListener('click', () => {
        haptics.selection();
        this.onViewAllTasks();
      });
    }

    // 3. Concluir tarefa diretamente com 1 toque
    this.container.querySelectorAll('.btn-check-task').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        if (!taskId) return;

        try {
          haptics.success();
          await tasksRepo.toggleDone(taskId);
          if (window.toast) window.toast.success('Tarefa marcada como feita!');
          await this.refresh();
        } catch (err) {
          console.error('Erro ao concluir tarefa:', err);
        }
      });
    });

    // 4. Clicar no cartão de tarefa
    this.container.querySelectorAll('.home-task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.id;
        if (taskId && this.onOpenTask) {
          haptics.selection();
          this.onOpenTask(taskId);
        } else if (this.onViewAllTasks) {
          this.onViewAllTasks();
        }
      });
    });

    // 5. Navegação para histórico completo
    const btnViewHistory = this.container.querySelector('#btn-view-history');
    if (btnViewHistory && this.onViewAllReports) {
      btnViewHistory.addEventListener('click', () => {
        haptics.selection();
        this.onViewAllReports();
      });
    }

    // 6. Clicar num registo recente de hoje
    this.container.querySelectorAll('.home-report-item').forEach(item => {
      item.addEventListener('click', () => {
        const reportId = item.dataset.id;
        if (reportId && this.onOpenReport) {
          haptics.selection();
          this.onOpenReport(reportId);
        }
      });
    });
  }

  async refresh() {
    await this.render();
  }
}
