import { reportsRepo } from '../db/reportsRepo.js';
import { tasksRepo } from '../db/tasksRepo.js';
import { speechService } from '../services/speechService.js';

import { esc } from '../utils/html.js';
import { haptics } from '../services/haptics.js';

/**
 * Ouvinte de cliques na página, guardado A NÍVEL DO MÓDULO e não da instância.
 *
 * Porquê: o main.js cria um HomeViewComponent NOVO a cada navegação para o ecrã
 * Hoje (renderHome()). Uma referência guardada em `this` nascia sempre vazia, e
 * por isso o ouvinte antigo nunca era removido — acumulavam-se ao longo do
 * turno. Medido: 4 navegações deixavam 4 ouvintes. Aqui só existe um, sempre.
 */
let activeOutsideClickHandler = null;

export class HomeViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onNewReport = options.onNewReport || null;
    this.onOpenFullReport = options.onOpenFullReport || null;
    this.onNewTask = options.onNewTask || null;
    this.onOpenReport = options.onOpenReport || null;
    this.onOpenTask = options.onOpenTask || null;
    this.onViewAllReports = options.onViewAllReports || null;
    this.onViewAllTasks = options.onViewAllTasks || null;
    this.dictationCleanup = null;
    // Referência ao ouvinte de cliques na página, para o poder remover.
    // Sem isto, cada redesenho do ecrã deixava um ouvinte para trás.
    this.outsideClickHandler = null;
  }


  /**
   * "Bom dia" / "Boa tarde" / "Boa noite" conforme a hora local.
   * @returns {string}
   */
  saudacao() {
    const h = new Date().getHours();
    if (h < 13) return 'Bom dia!';
    if (h < 20) return 'Boa tarde!';
    return 'Boa noite!';
  }

  async render() {
    if (!this.container) return;

    // Fetch data
    let reports = [];
    let tasks = [];
    try {
      reports = await reportsRepo.getAll();
      tasks = await tasksRepo.getToday();
    } catch (e) {
      console.error('[HomeView] Erro ao carregar dados:', e);
    }

    const openReports = reports.filter(r => r.status !== 'resolved');
    const criticalReports = openReports.filter(r => r.priority === 'critical');
    const inProgressReports = openReports.filter(r => r.status === 'in_progress');
    
    // Recent open reports (top 5)
    const recentReports = openReports.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)).slice(0, 5);
    
    // Today's tasks (top 3)
    const pendingTasks = tasks.filter(t => !t.done).slice(0, 3);
    const tasksDoneToday = tasks.filter(t => t.done).length;

    this.container.innerHTML = `
      <!-- Sem height:100% nem overflow-y próprios: o .main-content já rola e já
           reserva espaço para a barra inferior. Ter os dois criava um scroll
           dentro de outro, e os 90px de folga contra uma barra de 84px deixavam
           o último botão a tocar-lhe. -->
      <section class="home-view animate-fade-in" style="padding: 4px 0 8px;">
        <!-- A saudação segue a hora do telemóvel. Estava fixa em "Bom dia!" e
             às 18h dizia a coisa errada a quem está a fechar o turno. -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--color-text); margin: 0 0 8px 0;">${this.saudacao()}</h2>
          <p style="color: var(--color-text-secondary); font-size: 1.15rem; margin: 0;">O que precisa de registar?</p>
        </div>
        
        <!-- Quick Capture (Directly on Home) -->
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div class="form-group" style="margin-bottom: 16px;">
            <div class="form-label-row">
              <!-- "Descrição" e não "Descreva a intervenção": ao lado do botão de
                   voz, o rótulo longo partia-se em três linhas e o asterisco caía
                   sozinho numa linha só para ele. -->
              <label class="form-label" for="qc-description">Descrição *</label>
              <button type="button" id="btn-qc-mic" class="btn-secondary btn-dictate" title="Escrita por voz">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <span>Escrita por voz</span>
              </button>
            </div>
            <textarea id="qc-description" class="form-textarea" placeholder="Ex: Substituição do projetor da torre norte... (pode escrever ou usar escrita por voz)" style="height: 100px; font-size: 1.2rem; padding: 12px;"></textarea>
          </div>

          <!-- z-index nesta caixa (não só no dropdown): sem ele, a lista de locais
               ficava a tapar o botão "Gravar" e o técnico não conseguia gravar
               depois de escrever um local que não está na lista. -->
          <div class="form-group" style="margin-bottom: 16px; position: relative; z-index: 20;">
            <label class="form-label" style="font-size: 1.15rem;">Local (opcional)</label>
            <div style="position: relative;">
              <input type="text" id="qc-loc-search" class="form-input touch-target" autocomplete="off" placeholder="Pesquisar local..." style="padding-right: 40px; font-size: 1.15rem; min-height: 48px;" />
              <div id="qc-loc-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; right: 0; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-sm); max-height: 250px; overflow-y: auto; box-shadow: var(--shadow-lg);"></div>
            </div>
          </div>

          <button type="button" id="btn-save-capture" class="btn-primary-cta touch-target" style="width: 100%; font-size: 1.2rem; font-weight: 800; padding: 16px; border-radius: var(--radius-md); min-height: 48px;">
            Gravar Intervenção Rápida
          </button>

          <!-- Ação secundária discreta, não um segundo botão grande a competir com
               o primeiro. Rótulo curto: "+ Adicionar Fotos ou Materiais
               (Formulário Completo)" tinha 46 caracteres e partia-se em duas
               linhas, e ninguém lê isso ao sol. -->
          <button type="button" id="btn-open-full-form" class="touch-target" style="width: 100%; font-size: 1.15rem; font-weight: 700; padding: 12px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; min-height: 48px; background: transparent; border: none; color: var(--color-brand-text); cursor: pointer;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            Fotos e materiais
          </button>
        </div>

        <!-- Estatísticas do Dia -->
        ${criticalReports.length > 0 ? `
          <div style="background: rgba(220, 38, 38, 0.1); border: 1px solid var(--color-danger); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
            <div style="color: var(--color-danger); flex-shrink: 0;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <div>
              <div style="font-weight: 700; color: var(--color-danger); font-size: 1.15rem;">${criticalReports.length} intervenção(ões) crítica(s)</div>
              <div style="font-size: 1.15rem; color: var(--color-text-secondary);">Requer atenção imediata.</div>
            </div>
          </div>
        ` : ''}

        <!-- Contadores (Dashboard Grid) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
          <div id="btn-kpi-abertas" class="touch-target" style="cursor:pointer; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 80px;">
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-text); line-height: 1;">${openReports.length}</div>
            <div style="font-size: 1.15rem; color: var(--color-text-secondary); margin-top: 4px;">Abertas</div>
          </div>
          <div id="btn-kpi-criticas" class="touch-target" style="cursor:pointer; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 80px;">
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-danger); line-height: 1;">${criticalReports.length}</div>
            <div style="font-size: 1.15rem; color: var(--color-text-secondary); margin-top: 4px;">Críticas</div>
          </div>
          <div id="btn-kpi-emcurso" class="touch-target" style="cursor:pointer; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 80px;">
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-gold); line-height: 1;">${inProgressReports.length}</div>
            <div style="font-size: 1.15rem; color: var(--color-text-secondary); margin-top: 4px;">Em Curso</div>
          </div>
          <div id="btn-kpi-feitas" class="touch-target" style="cursor:pointer; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 80px;">
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-stadium-green); line-height: 1;">${tasksDoneToday}</div>
            <div style="font-size: 1.15rem; color: var(--color-text-secondary); margin-top: 4px;">Feitas Hoje</div>
          </div>
        </div>
        
        <!-- Tarefas Pendentes de Hoje -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
            <h2 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text);">Tarefas de Hoje</h2>
            ${tasks.length > 3 ? `<button type="button" id="btn-view-all-tasks" style="background: transparent; border: none; color: var(--color-brand-primary); font-weight: 600; padding: 4px 8px; font-size: 1.15rem;">Ver todas</button>` : ''}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${pendingTasks.length === 0 ? `
              <div style="padding: 16px; text-align: center; color: var(--color-text-muted); background: var(--color-surface); border-radius: var(--radius-sm);">
                Nenhuma tarefa pendente para hoje.
              </div>
            ` : pendingTasks.map(t => `
              <div class="task-card touch-target" data-id="${t.id}" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer; min-height: 64px;">
                <div style="width: 24px; height: 24px; border: 2px solid var(--color-border); border-radius: 50%; flex-shrink: 0;"></div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 1.15rem; color: var(--color-text); margin-bottom: 2px;">${esc(t.title)}</div>
                  <div style="font-size: 1.15rem; color: var(--color-text-secondary);">${esc(t.locationName || 'Sem local')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Intervenções Recentes -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
            <h2 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text);">Intervenções Abertas</h2>
            ${openReports.length > 5 ? `<button type="button" id="btn-view-all-reports" style="background: transparent; border: none; color: var(--color-brand-primary); font-weight: 600; padding: 4px 8px; font-size: 1.15rem;">Ver todas</button>` : ''}
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${recentReports.length === 0 ? `
              <div style="padding: 16px; text-align: center; color: var(--color-text-muted); background: var(--color-surface); border-radius: var(--radius-sm);">
                Nenhuma intervenção aberta.
              </div>
            ` : recentReports.map(r => {
              const isCrit = r.priority === 'critical';
              const isLow = r.priority === 'low';
              const prioColor = isCrit ? 'var(--color-danger)' : (isLow ? 'var(--color-stadium-green)' : 'var(--color-gold)');
              const prioBg = isCrit ? 'rgba(220,38,38,0.15)' : (isLow ? 'rgba(16,185,129,0.15)' : 'rgba(217,119,6,0.15)');
              const prioLabel = isCrit ? 'CRÍTICA' : (isLow ? 'BAIXA' : 'MÉDIA');
              return `
              <article class="report-card touch-target" data-id="${r.id}" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 1.15rem; color: var(--color-text-muted); font-family: monospace; font-weight: 700;">#${r.id.toString().slice(0,6)}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.15rem; font-weight: 800; padding: 4px 10px; border-radius: 4px; background: ${prioBg}; color: ${prioColor};">${prioLabel}</span>
                    <div style="color: var(--color-text-muted);">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </div>
                </div>
                <div class="report-card-body">
                  <p style="font-size: 1.15rem; font-weight: 700; color: var(--color-text); margin: 0; line-height: 1.3;">
                    ${esc(r.description)}
                  </p>
                </div>
                <div style="font-size: 1.15rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span style="font-size: 1.15rem;">${esc(r.locationName || 'Estádio — local não indicado')}</span>
                </div>
              </article>
            `}).join('')}
          </div>
        </div>
      </section>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const saveBtn = this.container.querySelector('#btn-save-capture');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const descInput = this.container.querySelector('#qc-description');
        const desc = descInput.value.trim();
        if (!desc) {
          if (window.toast) window.toast.error('Tem de escrever a descrição.');
          return;
        }

        const locInput = this.container.querySelector('#qc-loc-search');
        const locName = locInput.value.trim() || 'Estádio — local não indicado';
        let locId = locInput.dataset.selectedId || null;

        if (!locId) {
          locId = 'LOC_UNKNOWN'; // Fallback to prevent crash
        }

        try {
          await reportsRepo.create({
            locationId: locId,
            locationName: locName,
            priority: 'medium',
            status: 'pending',
            description: desc,
            date: new Date().toISOString(),
            timeSpent: 0,
            materials: '',
            photos: [],
            audioBlob: null,
            audioDuration: 0
          });
          
          // Vibra ANTES do refresh: é este o botão que o técnico usa a sério
          // (o do ecrã Hoje), e era o único que não vibrava.
          haptics.success();
          if (window.toast) window.toast.success('Intervenção registada!');
          descInput.value = '';
          locInput.value = '';
          locInput.dataset.selectedId = '';
          this.refresh();
        } catch (e) {
          console.error(e);
          if (window.toast) window.toast.error('Erro ao guardar intervenção.');
        }
      });
    }

    const micBtn = this.container.querySelector('#btn-qc-mic');
    const descInput = this.container.querySelector('#qc-description');

    if (micBtn && descInput) {
      if (this.dictationCleanup) {
        this.dictationCleanup();
      }
      this.dictationCleanup = speechService.attachDictation(micBtn, descInput, {
        activeHtml: `
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--color-danger); animation:pulse 1s infinite;"></span>
          <span style="color:var(--color-danger);">A ouvir... (Parar)</span>
        `
      });
    }

    const btnFull = this.container.querySelector('#btn-open-full-form');
    if (btnFull) {
      btnFull.addEventListener('click', () => {
        const descInput = this.container.querySelector('#qc-description');
        const locInput = this.container.querySelector('#qc-loc-search');
        if (typeof this.onOpenFullReport === 'function') {
          this.onOpenFullReport({
            description: descInput?.value || '',
            locationId: locInput?.dataset.selectedId || '',
            locationName: locInput?.value || ''
          });
        }
      });
    }

    const locInput = this.container.querySelector('#qc-loc-search');
    const locDropdown = this.container.querySelector('#qc-loc-dropdown');
    
    if (locInput && locDropdown) {
      // Lazy load locations if not loaded yet
      import('../db/locationsRepo.js').then(({ locationsRepo }) => {
        locationsRepo.getAll().then(locations => {
          const renderDropdown = (query) => {
            const q = query.toLowerCase().trim();
            let matches = locations;
            if (q) {
              matches = locations.filter(l => 
                (l.name && l.name.toLowerCase().includes(q)) || 
                (l.sectorName && l.sectorName.toLowerCase().includes(q))
              );
            }

            if (matches.length === 0) {
              // Sem resultados a lista FECHA. Uma caixa que só diz "não encontrei"
              // não ajuda em nada e estava a tapar o botão "Gravar" — o técnico
              // escrevia um local que não existe e ficava sem conseguir gravar.
              // Escrever texto livre é um caminho válido: o local vai como escrito.
              locDropdown.innerHTML = '';
              locDropdown.style.display = 'none';
            } else {
              locDropdown.style.display = 'block';
              locDropdown.innerHTML = matches.slice(0, 8).map(l => `
                <div class="qc-loc-item touch-target" data-id="${l.id}" data-name="${esc(l.name)}" style="padding: 14px 16px; border-bottom: 1px solid var(--color-border); cursor: pointer; min-height: 56px; display: flex; flex-direction: column; justify-content: center;">
                  <div style="font-weight: 700; color: var(--color-text); font-size: 1.15rem;">${esc(l.name)}</div>
                  <div style="font-size: 1.05rem; color: var(--color-text-secondary);">${esc(l.sectorName || '')}</div>
                </div>
              `).join('');

              locDropdown.querySelectorAll('.qc-loc-item').forEach(item => {
                item.addEventListener('click', () => {
                  locInput.value = item.dataset.name;
                  locInput.dataset.selectedId = item.dataset.id;
                  locDropdown.style.display = 'none';
                });
              });
            }
          };

          // Quem decide se a lista aparece é o renderDropdown, em função de haver
          // ou não resultados. Antes abria-se aqui às cegas e ficava aberta vazia.
          locInput.addEventListener('focus', () => {
            renderDropdown(locInput.value);
          });

          locInput.addEventListener('input', (e) => {
            locInput.dataset.selectedId = ''; // Reset ID if typed custom
            renderDropdown(e.target.value);
          });

          // Fechar ao tocar fora. O ouvinte anterior é removido primeiro, usando a
          // referência de módulo — a de instância não servia, porque cada
          // navegação para o ecrã Hoje cria um componente novo.
          if (activeOutsideClickHandler) {
            document.removeEventListener('click', activeOutsideClickHandler);
          }
          activeOutsideClickHandler = (e) => {
            if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
              locDropdown.style.display = 'none';
            }
          };
          this.outsideClickHandler = activeOutsideClickHandler;
          document.addEventListener('click', activeOutsideClickHandler);
        });
      });
    }

    // Navigation links
    const btnAllReports = this.container.querySelector('#btn-view-all-reports');
    if (btnAllReports && this.onViewAllReports) {
      btnAllReports.addEventListener('click', () => this.onViewAllReports());
    }

    const btnAllTasks = this.container.querySelector('#btn-view-all-tasks');
    if (btnAllTasks && this.onViewAllTasks) {
      btnAllTasks.addEventListener('click', () => this.onViewAllTasks());
    }

    // KPI card clicks
    const kpiAbertas = this.container.querySelector('#btn-kpi-abertas');
    if (kpiAbertas && this.onViewAllReports) {
      kpiAbertas.addEventListener('click', () => this.onViewAllReports('pending'));
    }

    const kpiCriticas = this.container.querySelector('#btn-kpi-criticas');
    if (kpiCriticas && this.onViewAllReports) {
      kpiCriticas.addEventListener('click', () => this.onViewAllReports('critical'));
    }

    const kpiEmCurso = this.container.querySelector('#btn-kpi-emcurso');
    if (kpiEmCurso && this.onViewAllReports) {
      kpiEmCurso.addEventListener('click', () => this.onViewAllReports('in_progress'));
    }

    const kpiFeitas = this.container.querySelector('#btn-kpi-feitas');
    if (kpiFeitas && this.onViewAllTasks) {
      kpiFeitas.addEventListener('click', () => this.onViewAllTasks());
    }

    // Report cards click
    this.container.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (id && this.onOpenReport) {
          this.onOpenReport(id);
        }
      });
    });

    // Task cards click
    this.container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (id && this.onOpenTask) {
          this.onOpenTask(id);
        }
      });
    });
  }

  async refresh() {
    await this.render();
  }
}
