import { db } from './db/db.js';
import { locationsRepo } from './db/locationsRepo.js';
import { reportsRepo } from './db/reportsRepo.js';
import { materialsRepo } from './db/materialsRepo.js';
import { HeaderComponent } from './ui/header.js';
import { StadiumNavigatorComponent } from './ui/stadiumNavigator.js';
import { DashboardComponent } from './ui/dashboard.js';
import { HistoryComponent } from './ui/history.js';
import { ReportDetailComponent } from './ui/reportDetail.js';
import { BottomNavComponent } from './ui/bottomNav.js';
import { LocationModalComponent } from './ui/locationModal.js';
import { HomeViewComponent } from './ui/homeView.js';
import { MoreViewComponent } from './ui/moreView.js';
import { TasksViewComponent } from './ui/tasksView.js';
import { NotesViewComponent } from './ui/notesView.js';
import { ToolsViewComponent } from './ui/toolsView.js';
import { EquipmentViewComponent } from './ui/equipmentView.js';
import { QuickCaptureComponent } from './ui/quickCapture.js';
import { AudioService, audioService } from './services/audioService.js';
import { SpeechService, speechService } from './services/speechService.js';
import { photoEditor } from './services/photoEditor.js';
import { toast } from './ui/toast.js';

export class App {
  constructor() {
    this.header = null;
    this.bottomNav = null;
    this.home = null;
    this.more = null;
    this.tasks = null;
    this.notes = null;
    this.tools = null;
    this.equipment = null;
    this.quickCapture = null;
    this.stadiumNavigator = null;
    this.history = null;
    this.dashboard = null;
    this.reportDetail = null;
    this.locationModal = null;
    this.currentView = 'home'; // 'home' | 'history' | 'tasks' | 'more' | 'tools' | 'equipment' | 'sectors' | 'notes' | 'settings'
    this.editingReportId = null;

    // Temporary storage during new report creation
    this.tempPhotos = []; // array of { id, blobData, dataUrl, type, mimeType }
    this.tempAudio = null; // { blob, duration, dataUrl }
    this.isRecordingAudio = false;
  }

  async init() {
    try { await db.open(); } catch (err) { console.error('[App] DB error:', err); }
    try { await locationsRepo.seedDefaults(); } catch (err) { console.error('[App] Seed locations error:', err); }
    try { await materialsRepo.seedDefaults(); } catch (err) { console.error('[App] Seed materials error:', err); }

    // Remove splash screen smoothly
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('hidden');
      setTimeout(() => { if (splash.parentNode) splash.remove(); }, 400);
    }

    this.initShell();
    this.registerServiceWorker();
    this.setupConnectivity();
  }

  initShell() {
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      const savedName = localStorage.getItem('operator_name') || 'Técnico';
      this.header = new HeaderComponent(headerContainer, {
        userName: savedName,
        isOnline: navigator.onLine
      });
      this.header.render();
    }

    this.locationModal = new LocationModalComponent(document.body, {
      locationsRepo,
      onSelect: (loc) => {
        const input = document.getElementById('search-location-input');
        if (input) {
          input.value = loc.name;
          input.dataset.selectedId = loc.id;
          input.dataset.selectedName = loc.name;
        }
      }
    });

    this.reportDetail = new ReportDetailComponent({
      onEdit: (id) => this.openEditReport(id),
      onDelete: () => this.refreshCurrentView(),
      onStatusChanged: () => this.refreshCurrentView()
    });

    this.quickCapture = new QuickCaptureComponent({
      onSave: () => this.refreshCurrentView()
    });

    const appContainer = document.getElementById('app');
    if (appContainer) {
      this.bottomNav = new BottomNavComponent(appContainer, {
        activeTab: this.currentView,
        onNavigate: (tabId) => this.navigateTo(tabId),
        onQuickNew: () => this.openNewReport()
      });
      this.bottomNav.render();
    }

    this.ensureReportFormDOM();
    this.bindReportFormEvents();

    // Render initial view
    this.navigateTo('home');
  }

  navigateTo(viewId) {
    this.currentView = viewId;
    const main = document.getElementById('main-content');
    if (!main) return;

    main.classList.remove('page-enter');
    void main.offsetWidth;
    main.classList.add('page-enter');

    if (this.bottomNav) {
      this.bottomNav.setActive(viewId);
    }

    switch (viewId) {
      case 'home':
        this.renderHome();
        break;
      case 'history':
        this.renderHistory();
        break;
      case 'tasks':
        this.renderTasks();
        break;
      case 'more':
        this.renderMore();
        break;
      case 'tools':
        this.renderTools();
        break;
      case 'equipment':
        this.renderEquipment();
        break;
      case 'notes':
        this.renderNotes();
        break;
      case 'sectors':
        this.renderMap(); // fallback or actual sectors list
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'metrics':
        this.renderMetrics();
        break;
    }
  }

  async renderHome() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.home = new HomeViewComponent(feed, {
      onNewReport: () => this.openNewReport(),
      onOpenFullReport: (prefill) => this.openFullNewReport(prefill),
      onNewTask: () => {
        // Simple fallback to tasks view for now
        this.navigateTo('tasks');
      },
      onViewAllReports: () => this.navigateTo('history'),
      onViewAllTasks: () => this.navigateTo('tasks'),
      onOpenReport: (id) => this.reportDetail.open(id),
      onOpenTask: (id) => this.navigateTo('tasks')
    });
    await this.home.render();
  }

  async renderMore() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.more = new MoreViewComponent(feed, {
      onNavigate: (viewId) => this.navigateTo(viewId)
    });
    await this.more.render();
  }

  async renderTasks() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.tasks = new TasksViewComponent(feed, {
      onNewTaskForLocation: () => {},
      onOpenReport: (id) => this.reportDetail.open(id)
    });
    await this.tasks.render();
  }

  async renderNotes() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.notes = new NotesViewComponent(feed, {
      onConvertToReport: (txt) => this.openNewReport({ description: txt }),
      onConvertToTask: () => {}
    });
    await this.notes.render();
  }

  async renderTools() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.tools = new ToolsViewComponent(feed, {
      onNewReportForTool: () => this.openNewReport()
    });
    await this.tools.render();
  }

  async renderEquipment() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.equipment = new EquipmentViewComponent(feed, {
      onNewReportForEquipment: (eqId, name, locId, locName) => {
        this.openNewReport({ locationId: locId, locationName: locName });
      },
      onViewEquipmentReports: () => this.navigateTo('history')
    });
    await this.equipment.render();
  }

  async renderMap() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.stadiumNavigator = new StadiumNavigatorComponent(feed, {
      onNewReportForRoom: (roomId, roomName) => {
        this.openNewReport({ locationId: roomId, locationName: roomName });
      },
      onViewRoomReports: (roomName) => {
        this.currentView = 'history';
        if (this.bottomNav) this.bottomNav.setActive('history');
        this.renderHistory(roomName);
      }
    });
    await this.stadiumNavigator.render();
  }

  async renderHistory(initialSector = null) {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.history = new HistoryComponent(feed, {
      initialSector,
      onReportClick: (id) => this.reportDetail.open(id),
      onEdit: (id) => this.openEditReport(id),
      onDelete: () => this.refreshCurrentView()
    });
    await this.history.render();
  }

  async renderMetrics() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;
    this.dashboard = new DashboardComponent(feed);
    await this.dashboard.render();
  }

  async renderSettings() {
    const feed = document.getElementById('dashboard-feed');
    if (!feed) return;

    let groupedSectors = [];
    let materials = [];
    let flatRooms = [];
    try {
      groupedSectors = await locationsRepo.getGroupedBySector();
      materials = await materialsRepo.getAll();
      flatRooms = await locationsRepo.getAll();
    } catch (e) {
      console.error('[Settings] Erro ao carregar dados:', e);
    }

    const totalRooms = flatRooms.length;

    feed.innerHTML = `
      <section class="settings-view animate-fade-in">
        <div class="section-header">
          <div>
            <h2 class="section-title">Definições & Gestão</h2>
            <p class="section-subtitle">Gestão de Setores, Salas Técnicas e Materiais</p>
          </div>
        </div>

        <!-- Sectors & Rooms Database Management -->
        <div class="analytics-card">
          <div class="analytics-card-header" style="margin-bottom: 12px;">
            <div>
              <h3 class="analytics-card-title">Divisões do Estádio (${totalRooms})</h3>
              <span style="font-size:0.72rem; color:var(--color-text-muted);">Base de dados de 1000+ chaves</span>
            </div>
            <button type="button" id="btn-add-room-settings" class="btn-primary-cta" style="padding:6px 14px; font-size:0.78rem;">
              + Nova Divisão
            </button>
          </div>

          <div style="margin-bottom: 14px; position: relative;">
            <input type="text" id="settings-room-search" class="form-input" inputmode="search" placeholder="Pesquisar nome da sala, piso ou chave..." autocomplete="off" style="width: 100%; padding: 12px 14px 12px 40px !important;" />
            <svg style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted);" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>

          <div id="settings-sectors-container" style="display:flex; flex-direction:column; gap:8px;">
            <!-- Renderizado via JS -->
          </div>
        </div>

        <!-- Materials Management -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">Materiais & Ferramentas (${materials.length})</h3>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:10px;">
            <input type="text" id="input-new-material" class="form-input" placeholder="Novo material ou ferramenta..." style="flex:1;" />
            <button type="button" id="btn-add-material" class="btn-primary-cta" style="padding:0 16px;">+</button>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:180px; overflow-y:auto;">
            ${materials.map(m => `
              <span style="display:inline-flex; align-items:center; gap:6px; background:var(--color-surface); border:1px solid var(--color-border); padding:4px 10px; border-radius:var(--radius-xs); font-size:0.8rem;">
                ${this.esc(m.name)}
                <button type="button" class="btn-del-mat" data-id="${m.id}" style="background:transparent; border:none; color:var(--color-danger); cursor:pointer; font-size:0.9rem;">&times;</button>
              </span>
            `).join('')}
          </div>
        </div>
      </section>
    `;

    const container = feed.querySelector('#settings-sectors-container');

    const bindRoomButtons = () => {
      container.querySelectorAll('.btn-edit-room').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const loc = await locationsRepo.getById(id);
          if (!loc) return;
          this.openRoomModal({
            loc, groupedSectors,
            onSave: async (data) => {
              await locationsRepo.update(id, { name: data.name, sectorName: data.sectorName, description: data.description });
              toast.success('Sala atualizada!');
              this.renderSettings();
            }
          });
        });
      });
      container.querySelectorAll('.btn-del-room').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Tem a certeza que deseja eliminar esta divisão?')) {
            await locationsRepo.remove(btn.dataset.id);
            toast.success('Divisão eliminada');
            this.renderSettings();
          }
        });
      });
    };

    const renderFlatRooms = (rooms) => {
      if (rooms.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--color-text-muted); font-size:0.9rem;">Nenhuma sala encontrada.</div>';
        return;
      }
      container.innerHTML = rooms.map(room => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--color-card); border:1px solid var(--color-border); border-radius:var(--radius-sm); margin-bottom:4px;">
          <div>
            <div style="font-size:0.9rem; font-weight:700; color:var(--color-text);">${this.esc(room.name)}</div>
            <div style="font-size:0.7rem; color:var(--color-text-muted); margin-top:2px;">${this.esc(room.sectorName)} ${room.description ? '— ' + this.esc(room.description) : ''}</div>
          </div>
          <div style="display:flex; gap:12px;">
            <button type="button" class="btn-edit-room touch-target" data-id="${room.id}" style="background:transparent; border:none; color:var(--color-text-secondary); cursor:pointer; font-size:1.1rem;" title="Editar">✎</button>
            <button type="button" class="btn-del-room touch-target" data-id="${room.id}" style="background:transparent; border:none; color:var(--color-danger); cursor:pointer; font-size:1.3rem;" title="Eliminar">&times;</button>
          </div>
        </div>
      `).join('');
      bindRoomButtons();
    };

    const renderSectors = () => {
      container.innerHTML = groupedSectors.map(sec => `
        <div class="settings-sector-block" style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-sm); overflow:hidden;">
          <div class="settings-sector-header touch-target" style="display:flex; justify-content:space-between; align-items:center; padding:14px; border-bottom:1px solid transparent; cursor:pointer;">
            <strong style="color:var(--color-text); font-size:0.95rem;">${this.esc(sec.name)}</strong>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:0.75rem; color:var(--color-brand-primary); font-weight:600; background:rgba(2,132,199,0.1); padding:2px 8px; border-radius:12px;">${(sec.rooms || []).length} div</span>
            </div>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.settings-sector-header').forEach((header, idx) => {
        header.addEventListener('click', () => {
          const sec = groupedSectors[idx];
          // Instead of accordion, act like a quick filter drill-down:
          const searchInput = feed.querySelector('#settings-room-search');
          if (searchInput) {
            searchInput.value = sec.name;
            searchInput.dispatchEvent(new Event('input'));
          }
        });
      });
    };

    // Initial render
    renderSectors();

    // Search Logic
    const searchInput = feed.querySelector('#settings-room-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length === 0) {
          renderSectors();
        } else {
          const filtered = flatRooms.filter(r => 
            (r.name && r.name.toLowerCase().includes(query)) || 
            (r.sectorName && r.sectorName.toLowerCase().includes(query)) ||
            (r.description && r.description.toLowerCase().includes(query))
          );
          // Limit to 150 results to prevent DOM lag on massive typing
          renderFlatRooms(filtered.slice(0, 150));
        }
      });
    }

    // Add New Room
    feed.querySelector('#btn-add-room-settings')?.addEventListener('click', () => {
      this.openRoomModal({
        groupedSectors,
        onSave: async (data) => {
          const matchedSec = groupedSectors.find(s => s.name.toLowerCase() === data.sectorName.toLowerCase());
          const sectorId = matchedSec ? matchedSec.id : 'SEC_CUSTOM';
          await locationsRepo.create({ name: data.name, sectorId, sectorName: data.sectorName, description: data.description, isCustom: true });
          toast.success('Sala adicionada!');
          this.renderSettings();
        }
      });
    });

    // Add/Delete Material logic remains the same
    const addMatInput = feed.querySelector('#input-new-material');
    const addMatBtn = feed.querySelector('#btn-add-material');
    const addMat = async () => {
      const name = addMatInput?.value?.trim();
      if (!name) return;
      await materialsRepo.create({ name });
      if (addMatInput) addMatInput.value = '';
      toast.success('Material adicionado');
      this.renderSettings();
    };
    addMatBtn?.addEventListener('click', addMat);
    addMatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addMat(); });
    feed.querySelectorAll('.btn-del-mat').forEach(btn => {
      btn.addEventListener('click', async () => {
        await materialsRepo.remove(btn.dataset.id);
        toast.success('Material removido');
        this.renderSettings();
      });
    });
  }

  openRoomModal(options = {}) {
    const { loc = null, groupedSectors = [], onSave = null } = options;
    const isEdit = !!loc;

    let modal = document.getElementById('modal-room-editor');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modal-room-editor';
    modal.className = 'bottom-sheet-overlay animate-fade-in';
    modal.style.display = 'flex';

    const sectorOptionsHtml = groupedSectors.map(s => `
      <option value="${this.esc(s.name)}" ${loc && loc.sectorName === s.name ? 'selected' : ''}>${this.esc(s.name)}</option>
    `).join('');

    modal.innerHTML = `
      <div class="bottom-sheet-content">
        <div class="sheet-drag-handle"><div class="drag-bar"></div></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--color-border); padding-bottom:10px;">
          <div>
            <span style="font-size:0.7rem; font-weight:700; color:var(--color-text-secondary); text-transform:uppercase;">Gestão de Infraestrutura</span>
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--color-text);">${isEdit ? 'Editar Sala / Divisão' : 'Nova Sala / Divisão'}</h3>
          </div>
          <button type="button" class="btn-close-detail" id="btn-close-room-modal">&times;</button>
        </div>

        <form id="form-room-editor" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label" for="input-room-name">Nome da Sala / Equipamento *</label>
            <input type="text" id="input-room-name" class="form-input" placeholder="Ex: Sala de Bombas #2" value="${isEdit ? this.esc(loc.name || '') : ''}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="select-room-sector">Setor de Localização *</label>
            <select id="select-room-sector" class="form-input" style="background:var(--color-card); color:var(--color-text);">
              ${sectorOptionsHtml}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="input-room-desc">Descrição / Notas (Opcional)</label>
            <input type="text" id="input-room-desc" class="form-input" placeholder="Ex: Piso -1, junto à caldeira" value="${isEdit ? this.esc(loc.description || '') : ''}" />
          </div>

          <button type="button" id="btn-save-room-modal" class="btn-primary-cta" style="width:100%; margin-top:12px;">
            ${isEdit ? 'Atualizar Sala' : 'Guardar Sala'}
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => { if (modal) modal.remove(); };
    const closeBtn = modal.querySelector('#btn-close-room-modal');
    if (closeBtn) closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    const saveBtn = modal.querySelector('#btn-save-room-modal');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const name = modal.querySelector('#input-room-name')?.value?.trim();
        const sectorName = modal.querySelector('#select-room-sector')?.value?.trim();
        const description = modal.querySelector('#input-room-desc')?.value?.trim() || '';

        if (!name) {
          toast.error('Preencha o nome da sala');
          return;
        }

        close();
        if (onSave) {
          onSave({ name, sectorName, description });
        }
      };
    }
  }

  /* ===== NEW / EDIT REPORT MODAL ===== */

  ensureReportFormDOM() {
    if (document.getElementById('modal-report-form')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-report-form';
    modal.className = 'bottom-sheet-overlay';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="bottom-sheet-content">
        <div class="sheet-drag-handle"><div class="drag-bar"></div></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--color-border); padding-bottom:10px;">
          <div>
            <span style="font-size:0.7rem; font-weight:700; color:var(--color-stadium-glow); text-transform:uppercase;">Registo Técnico de Campo</span>
            <h3 id="report-form-title" style="margin:0; font-size:1.15rem; font-weight:800; color:var(--color-text);">Nova Ocorrência</h3>
          </div>
          <button type="button" id="btn-cancel-report" class="btn-close-detail">&times;</button>
        </div>

        <form id="form-report" onsubmit="return false;">
          <!-- 1. Location / Sector -->
          <div class="form-group">
            <label class="form-label">Setor / Localização *</label>
            <div style="display:flex; gap:8px;">
              <div class="searchable-select" id="location-searchable" style="flex:1;">
                <input type="text" id="search-location-input" class="searchable-select-input" placeholder="Pesquisar setor..." autocomplete="off" data-selected-id="" data-selected-name="" />
                <span class="searchable-select-arrow">▼</span>
                <div class="searchable-select-dropdown" id="location-dropdown"></div>
              </div>
              <button type="button" id="btn-new-location-inline" class="btn-secondary" style="white-space:nowrap; padding:0 12px; font-size:0.8rem;">+ Local</button>
            </div>
          </div>

          <!-- 2. Priority Selector -->
          <div class="form-group">
            <label class="form-label">Nível de Prioridade *</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;" id="priority-options-group">
              <button type="button" class="btn-secondary priority-select-btn" data-priority="low">
                🟢 Baixa
              </button>
              <button type="button" class="btn-secondary priority-select-btn active" data-priority="medium" style="border-color:var(--color-gold); color:var(--color-gold);">
                🟡 Média
              </button>
              <button type="button" class="btn-secondary priority-select-btn" data-priority="critical">
                🔴 Crítica
              </button>
            </div>
            <input type="hidden" id="input-priority" value="medium" />
          </div>

          <!-- 3. Status Selector -->
          <div class="form-group">
            <label class="form-label">Estado Inicial</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;" id="status-options-group">
              <button type="button" class="btn-secondary status-select-btn active" data-status="pending" style="border-color:var(--color-gold); color:var(--color-gold);">
                ⏳ Pendente
              </button>
              <button type="button" class="btn-secondary status-select-btn" data-status="in_progress">
                ⚙️ Em Curso
              </button>
              <button type="button" class="btn-secondary status-select-btn" data-status="resolved">
                ✅ Resolvido
              </button>
            </div>
            <input type="hidden" id="input-status" value="pending" />
          </div>

          <!-- 4. Description -->
          <div class="form-group">
            <label class="form-label" for="input-description">Descrição do Trabalho / Avaria *</label>
            <textarea id="input-description" class="form-textarea" placeholder="Descreva detalhadamente o problema ou trabalho..." required></textarea>
          </div>

          <!-- 5. Voice Note Recorder -->
          <div class="form-group">
            <label class="form-label">Nota de Voz Rápida (Áudio)</label>
            <div class="audio-record-box" id="audio-record-box">
              <button type="button" class="btn-mic-record" id="btn-toggle-mic" title="Gravar Nota de Voz">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              </button>
              <div class="audio-record-status" id="audio-record-status">
                Toque no microfone para ditar ou gravar uma nota de áudio.
              </div>
              <button type="button" id="btn-delete-audio" style="display:none; background:transparent; border:none; color:var(--color-danger); cursor:pointer; font-size:1.1rem;" title="Eliminar áudio">&times;</button>
            </div>
          </div>

          <!-- 6. Date & Time & Time Spent -->
          <div class="detail-grid-two">
            <div class="form-group">
              <label class="form-label" for="input-date">Data e Hora *</label>
              <input type="datetime-local" id="input-date" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="input-time-spent">Tempo Gasto (min) *</label>
              <input type="number" id="input-time-spent" class="form-input" min="1" placeholder="Ex: 30" required />
            </div>
          </div>

          <!-- 7. Materials & Tools -->
          <div class="form-group">
            <label class="form-label">Materiais e Ferramentas</label>
            <div id="materials-select-container"></div>
          </div>

          <!-- 8. Photos with Annotation Markup Tool -->
          <div class="form-group">
            <label class="form-label">Fotografias & Evidências</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
              <div>
                <label style="font-size:0.75rem; color:var(--color-text-secondary); margin-bottom:3px; display:block;">Foto Antes</label>
                <input type="file" id="input-photo-before" accept="image/*" capture="environment" class="form-input" style="padding:6px; font-size:0.75rem;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:var(--color-text-secondary); margin-bottom:3px; display:block;">Foto Depois</label>
                <input type="file" id="input-photo-after" accept="image/*" capture="environment" class="form-input" style="padding:6px; font-size:0.75rem;" />
              </div>
            </div>
            <div id="photo-preview-container" class="detail-photos-scroll" style="margin-top:8px;"></div>
          </div>

          <button type="button" id="btn-save-report" class="btn-primary-cta" style="width:100%; margin-top:8px;">
            Guardar Registo
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
  }

  bindReportFormEvents() {
    const modal = document.getElementById('modal-report-form');
    const btnCancel = document.getElementById('btn-cancel-report');
    const btnSave = document.getElementById('btn-save-report');

    if (btnCancel && modal) {
      btnCancel.onclick = () => {
        modal.style.display = 'none';
        this.editingReportId = null;
        this.cleanupFormTempData();
      };
    }

    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
          this.editingReportId = null;
          this.cleanupFormTempData();
        }
      };
    }

    if (btnSave) {
      btnSave.onclick = () => this.saveReport();
    }

    // Priority selector buttons
    const priorityGroup = document.getElementById('priority-options-group');
    const priorityInput = document.getElementById('input-priority');
    if (priorityGroup && priorityInput) {
      priorityGroup.querySelectorAll('.priority-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          priorityGroup.querySelectorAll('.priority-select-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.color = '';
          });
          btn.classList.add('active');
          const p = btn.dataset.priority;
          priorityInput.value = p;
          if (p === 'critical') { btn.style.borderColor = 'var(--color-danger)'; btn.style.color = 'var(--color-danger)'; }
          else if (p === 'medium') { btn.style.borderColor = 'var(--color-gold)'; btn.style.color = 'var(--color-gold)'; }
          else { btn.style.borderColor = 'var(--color-stadium-green)'; btn.style.color = 'var(--color-stadium-green)'; }
        });
      });
    }

    // Status selector buttons
    const statusGroup = document.getElementById('status-options-group');
    const statusInput = document.getElementById('input-status');
    if (statusGroup && statusInput) {
      statusGroup.querySelectorAll('.status-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          statusGroup.querySelectorAll('.status-select-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.color = '';
          });
          btn.classList.add('active');
          const s = btn.dataset.status;
          statusInput.value = s;
          if (s === 'resolved') { btn.style.borderColor = 'var(--color-stadium-glow)'; btn.style.color = 'var(--color-stadium-glow)'; }
          else if (s === 'in_progress') { btn.style.borderColor = 'var(--color-info)'; btn.style.color = 'var(--color-info)'; }
          else { btn.style.borderColor = 'var(--color-gold)'; btn.style.color = 'var(--color-gold)'; }
        });
      });
    }

    // Voice Dictation & Audio Note Recording (100% Offline & Reliable)
    const micBtn = document.getElementById('btn-toggle-mic');
    const audioStatus = document.getElementById('audio-record-status');
    const deleteAudioBtn = document.getElementById('btn-delete-audio');
    const descInput = document.getElementById('input-description');

    if (micBtn && audioStatus) {
      micBtn.addEventListener('click', async () => {
        if (!this.isRecordingAudio) {
          try {
            this.isRecordingAudio = true;
            micBtn.classList.add('recording');
            audioStatus.textContent = '🔴 A gravar nota de voz... (0s)';

            // Start reliable local MediaRecorder
            await audioService.startRecording((elapsed) => {
              if (audioStatus) audioStatus.textContent = `🔴 A gravar nota de voz... (${elapsed}s) — toque para parar.`;
            });

            // Try speech-to-text in parallel if supported
            if (SpeechService.isSupported() && descInput) {
              const prevText = (descInput.value || '').trim();
              speechService.startListening({
                lang: 'pt-PT',
                onResult: (transcript) => {
                  if (descInput) {
                    descInput.value = prevText ? `${prevText} ${transcript}` : transcript;
                    descInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                },
                onError: () => {
                  // Silently ignore speech cloud error, local audio recorder is still active!
                }
              }).catch(() => {});
            }
          } catch (err) {
            console.error('[Audio] error:', err);
            this.isRecordingAudio = false;
            micBtn.classList.remove('recording');
            audioStatus.textContent = 'Erro ao aceder ao microfone. Verifique as permissões.';
            toast.error('Não foi possível aceder ao microfone');
          }
        } else {
          // Stop recording
          try {
            speechService.stopListening();
            const result = await audioService.stopRecording();
            this.isRecordingAudio = false;
            micBtn.classList.remove('recording');
            this.tempAudio = result;
            audioStatus.innerHTML = `
              <div style="color:var(--color-stadium-glow); font-weight:700; margin-bottom: 4px;">✅ Áudio Gravado (${result.duration}s)</div>
              <audio controls src="${result.dataUrl}" style="width:100%; height:36px;"></audio>
            `;
            if (deleteAudioBtn) deleteAudioBtn.style.display = 'block';
            toast.success('Nota de voz guardada!');
          } catch (err) {
            console.error('[Audio] stop error:', err);
            this.isRecordingAudio = false;
            micBtn.classList.remove('recording');
            audioStatus.textContent = 'Erro ao terminar gravação.';
          }
        }
      });
    }

    if (deleteAudioBtn && audioStatus) {
      deleteAudioBtn.addEventListener('click', () => {
        this.tempAudio = null;
        audioStatus.textContent = 'Toque no microfone para gravar uma nota de voz ou ditar.';
        deleteAudioBtn.style.display = 'none';
      });
    }

    // Photo Inputs & Markup Editor Integration
    ['input-photo-before', 'input-photo-after'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.onchange = (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const type = id === 'input-photo-before' ? 'before' : 'after';
            this.handlePhotoAdded(file, type);
          }
        };
      }
    });

    // Inline new location modal
    const btnNewLoc = document.getElementById('btn-new-location-inline');
    if (btnNewLoc) {
      btnNewLoc.onclick = () => this.locationModal.open({ expandForm: true });
    }

    // Connect location input to open the Location Modal
    const locInput = document.getElementById('search-location-input');
    if (locInput) {
      locInput.readOnly = true;
      locInput.style.cursor = 'pointer';
      locInput.onclick = () => this.locationModal.open();
    }
  }

  async handlePhotoAdded(file, type) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const photoItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + type,
        blobData: file,
        dataUrl,
        type,
        mimeType: file.type || 'image/jpeg',
        createdAt: new Date().toISOString()
      };

      // Add to temp photos list
      this.tempPhotos.push(photoItem);
      this.renderPhotoPreviews();

      // Offer immediate markup annotation
      toast.success('Foto carregada! Toque na foto para desenhar setas ou anotações.');
    };
    reader.readAsDataURL(file);
  }

  renderPhotoPreviews() {
    const container = document.getElementById('photo-preview-container');
    if (!container) return;
    container.innerHTML = '';

    this.tempPhotos.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = 'detail-photo-card';
      card.dataset.index = idx;
      card.innerHTML = `
        <img src="${photo.dataUrl}" alt="Foto" class="detail-photo-img" />
        <span class="detail-photo-tag">${photo.type === 'before' ? 'Antes' : 'Depois'} ✎ Anotar</span>
        <button type="button" class="btn-remove-photo" style="position:absolute; top:2px; right:2px; background:var(--color-danger); color:#FFFFFF; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px;">&times;</button>
      `;

      // Click card -> Open Canvas Photo Editor
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-remove-photo')) {
          e.stopPropagation();
          this.tempPhotos.splice(idx, 1);
          this.renderPhotoPreviews();
          return;
        }

        const edited = await photoEditor.open(photo.dataUrl);
        if (edited) {
          photo.blobData = edited.blob;
          photo.dataUrl = edited.dataUrl;
          this.renderPhotoPreviews();
          toast.success('Anotação guardada na foto!');
        }
      });

      container.appendChild(card);
    });
  }

  cleanupFormTempData() {
    this.tempPhotos = [];
    this.tempAudio = null;
    this.isRecordingAudio = false;
    const audioStatus = document.getElementById('audio-record-status');
    if (audioStatus) audioStatus.textContent = 'Toque no microfone para ditar ou gravar uma nota de áudio.';
    const deleteAudioBtn = document.getElementById('btn-delete-audio');
    if (deleteAudioBtn) deleteAudioBtn.style.display = 'none';
    const previewContainer = document.getElementById('photo-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
  }

  openNewReport(prefill = {}) {
    this.quickCapture.open(prefill);
  }

  openFullNewReport(prefill = {}) {
    this.editingReportId = null;
    this.cleanupFormTempData();
    this.ensureReportFormDOM();

    const modal = document.getElementById('modal-report-form');
    const titleEl = document.getElementById('report-form-title');
    if (titleEl) titleEl.textContent = 'Nova Ocorrência Completa';

    const form = document.getElementById('form-report');
    if (form) form.reset();

    const locInput = document.getElementById('search-location-input');
    if (locInput) {
      locInput.dataset.selectedId = prefill.locationId || '';
      locInput.dataset.selectedName = prefill.locationName || '';
      locInput.value = prefill.locationName || '';
    }

    const descInput = document.getElementById('input-description');
    if (descInput) descInput.value = prefill.description || '';

    const priorityGroup = document.getElementById('priority-options-group');
    if (priorityGroup) {
      const btn = priorityGroup.querySelector(`[data-priority="${prefill.priority || 'medium'}"]`);
      if (btn) btn.click();
    }

    const statusGroup = document.getElementById('status-options-group');
    if (statusGroup) {
      const btn = statusGroup.querySelector(`[data-status="${prefill.status || 'pending'}"]`);
      if (btn) btn.click();
    }

    const dateInput = document.getElementById('input-date');
    if (dateInput) {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      dateInput.value = d.toISOString().slice(0, 16);
    }

    const timeSpentInput = document.getElementById('input-time-spent');
    if (timeSpentInput) timeSpentInput.value = '30';

    this.renderMaterialsForSelect([]);

    if (modal) {
      modal.style.display = 'flex';
      modal.style.zIndex = '1000';
    }
  }

  async openEditReport(id) {
    try {
      const report = await reportsRepo.getById(id);
      if (!report) return;
      
      this.editingReportId = id;
      this.cleanupFormTempData();
      
      const modal = document.getElementById('modal-report-form');
      const titleEl = document.getElementById('report-form-title');
      if (titleEl) titleEl.textContent = 'Editar Ocorrência';
      
      const form = document.getElementById('form-report');
      if (form) form.reset();
      
      const locInput = document.getElementById('search-location-input');
      if (locInput) {
        locInput.dataset.selectedId = report.locationId || '';
        locInput.dataset.selectedName = report.locationName || '';
        locInput.value = report.locationName || '';
      }
      
      const priorityGroup = document.getElementById('priority-options-group');
      if (priorityGroup) {
        const btn = priorityGroup.querySelector(`[data-priority="${report.priority}"]`);
        if (btn) btn.click();
      }
      
      const statusGroup = document.getElementById('status-options-group');
      if (statusGroup) {
        const btn = statusGroup.querySelector(`[data-status="${report.status}"]`);
        if (btn) btn.click();
      }
      
      const descInput = document.getElementById('input-description');
      if (descInput) descInput.value = report.description || '';
      
      const dateInput = document.getElementById('input-date');
      if (dateInput && report.date) {
        const d = new Date(report.date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        dateInput.value = d.toISOString().slice(0, 16);
      }
      
      const timeSpentInput = document.getElementById('input-time-spent');
      if (timeSpentInput) timeSpentInput.value = report.timeSpent || '';
      
      // Load materials (simple comma separated string parse)
      const selectedMaterials = report.materials ? report.materials.split(',').map(m => m.trim()) : [];
      await this.renderMaterialsForSelect(selectedMaterials);
      
      // Load photos
      if (report.photos && report.photos.length > 0) {
        // Hydrate photo URLs
        this.tempPhotos = report.photos.map(p => ({
          id: p.id,
          type: p.type,
          dataUrl: p.dataUrl || (p.blob ? URL.createObjectURL(p.blob) : ''),
          blobData: p.blob
        }));
        this.renderPhotoPreviews();
      }
      
      // Load audio
      if (report.audioBlob) {
        this.tempAudio = {
          blob: report.audioBlob,
          dataUrl: URL.createObjectURL(report.audioBlob),
          duration: report.audioDuration || 0
        };
        const audioStatus = document.getElementById('audio-record-status');
        const deleteAudioBtn = document.getElementById('btn-delete-audio');
        if (audioStatus) {
          audioStatus.innerHTML = `
            <div style="color:var(--color-stadium-glow); font-weight:700;">Áudio Gravado (${this.tempAudio.duration}s)</div>
            <audio controls src="${this.tempAudio.dataUrl}" style="width:100%; height:32px; margin-top:4px;"></audio>
          `;
        }
        if (deleteAudioBtn) deleteAudioBtn.style.display = 'block';
      }
      
      if (modal) {
        modal.style.display = 'flex';
      }
    } catch (e) {
      console.error(e);
      if (window.toast) toast.error('Erro ao abrir ocorrência.');
    }
  }

  async saveReport() {
    const locInput = document.getElementById('search-location-input');
    let locationId = locInput?.dataset?.selectedId;
    let locationName = locInput?.dataset?.selectedName || locInput?.value;
    
    if (!locationId || !locationId.trim()) {
      locationId = 'LOC_UNKNOWN';
      locationName = locationName || 'Estádio — local não indicado';
    }
    
    const descInput = document.getElementById('input-description');
    const description = descInput?.value?.trim();
    if (!description) {
      if (window.toast) toast.error('A descrição é obrigatória.');
      if (descInput) descInput.focus();
      return;
    }
    
    const priorityInput = document.getElementById('input-priority');
    const statusInput = document.getElementById('input-status');
    const dateInput = document.getElementById('input-date');
    const timeSpentInput = document.getElementById('input-time-spent');
    
    // Parse safe date
    let isoDate = new Date().toISOString();
    if (dateInput?.value) {
      try {
        const parsed = new Date(dateInput.value);
        if (!Number.isNaN(parsed.getTime())) {
          isoDate = parsed.toISOString();
        }
      } catch (e) {}
    }

    // Gather materials
    const materialsCheckboxes = document.querySelectorAll('.mat-checkbox:checked');
    const materialsList = Array.from(materialsCheckboxes).map(cb => cb.value).join(', ');
    
    // Format photos for repo
    let photosToSave = [];
    if (Array.isArray(this.tempPhotos)) {
      photosToSave = this.tempPhotos.map(p => ({
        id: p.id,
        type: p.type || 'before',
        blob: p.blobData || p.blob || null,
        mimeType: p.mimeType || 'image/jpeg'
      }));
    }
    
    const reportData = {
      locationId: String(locationId).trim(),
      locationName: String(locationName || '').trim(),
      description: String(description).trim(),
      priority: priorityInput?.value || 'medium',
      status: statusInput?.value || 'pending',
      date: isoDate,
      timeSpent: timeSpentInput?.value ? (Number(timeSpentInput.value) || 0) : 0,
      materials: materialsList,
      photos: photosToSave,
      audioBlob: this.tempAudio ? this.tempAudio.blob : null,
      audioDuration: this.tempAudio ? (Number(this.tempAudio.duration) || 0) : 0
    };
    
    try {
      if (this.editingReportId) {
        await reportsRepo.update(this.editingReportId, reportData);
        if (window.toast) toast.success('Ocorrência atualizada com sucesso!');
      } else {
        await reportsRepo.create(reportData);
        if (window.toast) toast.success('Nova ocorrência registada!');
      }
      
      const modal = document.getElementById('modal-report-form');
      if (modal) modal.style.display = 'none';
      this.editingReportId = null;
      this.cleanupFormTempData();
      
      await this.refreshCurrentView();
    } catch (e) {
      console.error('[saveReport] Error:', e);
      if (window.toast) toast.error('Erro ao guardar ocorrência.');
    }
  }

  async renderMaterialsForSelect(selectedNames = []) {
    const container = document.getElementById('materials-select-container');
    if (!container) return;
    
    try {
      const materials = await materialsRepo.getAll();
      if (materials.length === 0) {
        container.innerHTML = '<span style="font-size:0.8rem; color:var(--color-text-muted);">Nenhum material configurado. Adicione nas Definições.</span>';
        return;
      }
      
      container.innerHTML = `
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${materials.map(m => {
            const isSelected = selectedNames.includes(m.name);
            return `
              <label style="display:inline-flex; align-items:center; gap:6px; background:var(--color-surface); padding:6px 12px; border-radius:16px; border:1px solid var(--color-border); cursor:pointer; font-size:0.85rem;">
                <input type="checkbox" class="mat-checkbox" value="${this.esc(m.name)}" ${isSelected ? 'checked' : ''} style="margin:0;" />
                ${this.esc(m.name)}
              </label>
            `;
          }).join('')}
        </div>
      `;
    } catch (e) {
      console.error(e);
      container.innerHTML = 'Erro ao carregar materiais.';
    }
  }

  refreshCurrentView() {
    this.navigateTo(this.currentView);
  }

  setupConnectivity() {
    window.addEventListener('online', () => {
      if (window.toast) toast.success('Ligação restabelecida. Sincronização em curso...');
      if (this.header) this.header.updateStatus(true);
    });
    window.addEventListener('offline', () => {
      if (window.toast) toast.error('Modo Offline. A gravar dados localmente.');
      if (this.header) this.header.updateStatus(false);
    });
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('SW registration failed: ', err);
        });
      });
    }
  }

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

const app = new App();
window.app = app; // Expose globally for dev/debugging
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
