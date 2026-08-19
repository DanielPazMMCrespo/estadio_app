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
  }

  saudacao() {
    const h = new Date().getHours();
    if (h < 13) return 'Bom dia';
    if (h < 20) return 'Boa tarde';
    return 'Boa noite';
  }

  async render() {
    if (!this.container) return;

    let tasks = [];
    try {
      tasks = await tasksRepo.getToday();
    } catch (e) {
      console.error('[HomeView] Erro ao carregar tarefas:', e);
    }

    const pendingTasks = tasks.filter(t => !t.done);
    const hasTasks = pendingTasks.length > 0;

    this.container.innerHTML = `
      <section class="home-view animate-fade-in" style="padding: 16px 8px; display: flex; flex-direction: column; gap: 32px; min-height: 100%;">
        
        <!-- Cabeçalho Simples -->
        <div style="text-align: center; margin-top: 16px;">
          <h2 style="font-size: 2rem; font-weight: 800; color: var(--color-text); margin: 0;">${this.saudacao()}!</h2>
          <p style="color: var(--color-text-secondary); font-size: 1.3rem; margin: 8px 0 0 0;">O que vamos fazer?</p>
        </div>
        
        <!-- Acção Principal: Único destaque visual do ecrã -->
        <div>
          <button type="button" id="btn-main-report" class="touch-target" style="width: 100%; background: var(--color-brand-primary); color: #fff; font-size: 1.5rem; font-weight: 800; padding: 24px 16px; border-radius: 16px; border: none; box-shadow: 0 8px 24px rgba(15, 110, 92, 0.4); display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer;">
            <!-- Ícone de Adição/Registo -->
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            Registar Problema
          </button>
        </div>

        <!-- Acção Secundária: Tarefas com Empty State Positivo e cor não-ansiosa -->
        <div>
          <button type="button" id="btn-main-tasks" class="touch-target" style="width: 100%; background: ${hasTasks ? 'var(--color-surface)' : 'rgba(16, 185, 129, 0.1)'}; color: var(--color-text); font-size: 1.4rem; font-weight: 700; padding: 20px 16px; border-radius: 16px; border: 2px solid ${hasTasks ? 'var(--color-border)' : 'var(--color-stadium-green)'}; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${hasTasks ? 'var(--color-text-secondary)' : 'var(--color-stadium-green)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <span>${hasTasks ? 'As Minhas Tarefas' : 'Tudo feito por hoje!'}</span>
            </div>
            ${hasTasks ? `<span style="background: var(--color-info, #3b82f6); color: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">${pendingTasks.length}</span>` : ``}
          </button>
        </div>

        <!-- Indicador de Offline Reassegurador -->
        <div id="home-offline-indicator" style="display: none; text-align: center; color: var(--color-text-secondary); font-size: 1.15rem; margin-top: 16px; font-weight: 600;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
          Sem internet. Pode continuar a trabalhar!
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
    const btnReport = this.container.querySelector('#btn-main-report');
    if (btnReport) {
      btnReport.addEventListener('click', () => {
        haptics.success();
        if (this.onOpenFullReport) {
          this.onOpenFullReport({ description: '', locationId: '', locationName: '' });
        }
      });
    }

    const btnTasks = this.container.querySelector('#btn-main-tasks');
    if (btnTasks) {
      btnTasks.addEventListener('click', () => {
        haptics.selection();
        if (this.onViewAllTasks) {
          this.onViewAllTasks();
        }
      });
    }
  }

  async refresh() {
    await this.render();
  }
}
