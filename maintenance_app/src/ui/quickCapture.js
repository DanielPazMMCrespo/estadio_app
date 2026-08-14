import { reportsRepo } from '../db/reportsRepo.js';
import { locationsRepo } from '../db/locationsRepo.js';
import { toast } from './toast.js';

export class QuickCaptureComponent {
  constructor(options = {}) {
    this.onSave = options.onSave || null;
    this.modal = null;
    this.locations = [];
    this.selectedLocId = null;
    this.selectedLocName = null;
    this.priority = 'medium';
  }

  async open(prefill = {}) {
    if (this.modal) this.close();
    
    // Load locations
    try {
      this.locations = await locationsRepo.getAll();
    } catch(e) {}

    // Default location (last used or fallback)
    const lastUsedLocId = localStorage.getItem('last_used_loc_id');
    const lastUsedLocName = localStorage.getItem('last_used_loc_name');
    
    this.selectedLocId = prefill.locationId || lastUsedLocId || null;
    this.selectedLocName = prefill.locationName || lastUsedLocName || 'Estádio — local não indicado';
    this.priority = 'medium';

    this.modal = document.createElement('div');
    this.modal.id = 'modal-quick-capture';
    this.modal.className = 'bottom-sheet-overlay';
    this.modal.style.display = 'flex';
    this.modal.style.zIndex = '3000'; // above everything

    this.modal.innerHTML = `
      <div class="bottom-sheet-content" style="max-height: 95vh; display: flex; flex-direction: column;">
        <div class="sheet-drag-handle"><div class="drag-bar"></div></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--color-border); padding-bottom:8px;">
          <div>
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--color-text);">Nova Avaria</h3>
          </div>
          <button type="button" class="btn-close-detail" id="btn-cancel-capture" style="width: 48px; height: 48px; font-size: 1.5rem;">&times;</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding-bottom: 24px;">
          <!-- DESCRIÇÃO (OBRIGATÓRIO) -->
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" style="font-size: 1rem; color: var(--color-text); font-weight: 700;">O que aconteceu? *</label>
            <textarea id="qc-description" class="form-textarea" placeholder="Ex: O projetor da torre norte está fundido..." style="height: 120px; font-size: 1.1rem; padding: 12px;"></textarea>
          </div>

          <!-- LOCALIZAÇÃO -->
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" style="font-size: 0.9rem;">Onde?</label>
            <div style="position: relative;">
              <input type="text" id="qc-loc-search" class="form-input touch-target" value="${this.selectedLocName}" autocomplete="off" placeholder="Pesquisar local..." style="padding-right: 40px;" />
              <svg style="position: absolute; right: 12px; top: 18px; color: var(--color-text-muted);" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <div id="qc-loc-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--color-surface); border: 1px solid var(--color-border); max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
            </div>
          </div>

          <!-- PRIORIDADE -->
          <div class="form-group" style="margin-bottom: 24px;">
            <label class="form-label" style="font-size: 0.9rem;">Prioridade</label>
            <div style="display:flex; gap:8px;" id="qc-priority-group">
              <button type="button" class="btn-secondary touch-target priority-btn" data-priority="low" style="flex:1;">Baixa</button>
              <button type="button" class="btn-secondary touch-target priority-btn active" data-priority="medium" style="flex:1; border-color:var(--color-gold); color:var(--color-gold);">Média</button>
              <button type="button" class="btn-secondary touch-target priority-btn" data-priority="critical" style="flex:1;">Crítica</button>
            </div>
          </div>

          <!-- Opcionais escondidos/simplificados -->
          <div style="display: flex; gap: 12px; justify-content: space-around; margin-top: 24px;">
            <button type="button" id="qc-btn-photo" class="touch-target" style="display: flex; flex-direction: column; align-items: center; gap: 4px; background: transparent; border: none; color: var(--color-brand-primary);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <span style="font-size: 0.8rem; font-weight: 600;">Adicionar Foto</span>
            </button>
            <button type="button" id="qc-btn-mic" class="touch-target" style="display: flex; flex-direction: column; align-items: center; gap: 4px; background: transparent; border: none; color: var(--color-brand-primary);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              <span style="font-size: 0.8rem; font-weight: 600;">Nota de Voz</span>
            </button>
          </div>
          
          <input type="file" id="qc-photo-input" accept="image/*" capture="environment" style="display: none;" />
          <div id="qc-photo-preview" style="display: flex; gap: 8px; margin-top: 12px; overflow-x: auto;"></div>
        </div>

        <!-- GRAVAR (SEMPRE VISÍVEL NO FUNDO, ENORME) -->
        <div style="padding-top: 12px; background: var(--color-bg); border-top: 1px solid var(--color-border);">
          <button type="button" id="btn-save-capture" class="btn-primary-cta touch-target" style="width: 100%; height: 64px; font-size: 1.2rem; font-weight: 800; border-radius: var(--radius-md);">
            Gravar Avaria
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();

    // Auto-focus no campo de descrição para abrir teclado
    setTimeout(() => {
      const descEl = document.getElementById('qc-description');
      if (descEl) descEl.focus();
    }, 100);
  }

  bindEvents() {
    const cancelBtn = this.modal.querySelector('#btn-cancel-capture');
    if (cancelBtn) cancelBtn.onclick = () => this.close();
    
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.close();
    };

    // Priority
    const priorityGroup = this.modal.querySelector('#qc-priority-group');
    if (priorityGroup) {
      priorityGroup.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          priorityGroup.querySelectorAll('.priority-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.color = '';
          });
          btn.classList.add('active');
          this.priority = btn.dataset.priority;
          if (this.priority === 'critical') { btn.style.borderColor = 'var(--color-danger)'; btn.style.color = 'var(--color-danger)'; }
          else if (this.priority === 'medium') { btn.style.borderColor = 'var(--color-gold)'; btn.style.color = 'var(--color-gold)'; }
          else { btn.style.borderColor = 'var(--color-stadium-green)'; btn.style.color = 'var(--color-stadium-green)'; }
        });
      });
    }

    // Location search
    const locInput = this.modal.querySelector('#qc-loc-search');
    const locDropdown = this.modal.querySelector('#qc-loc-dropdown');
    
    if (locInput && locDropdown) {
      const renderLocs = (query) => {
        const q = query.toLowerCase().trim();
        let matches = this.locations;
        if (q) {
          matches = this.locations.filter(l => 
            (l.name && l.name.toLowerCase().includes(q)) || 
            (l.sectorName && l.sectorName.toLowerCase().includes(q))
          );
        }
        
        if (matches.length === 0) {
          locDropdown.innerHTML = '<div style="padding: 16px; color: var(--color-text-muted);">Nenhum local encontrado</div>';
        } else {
          // Opções grandes (>= 56px) para homem de luvas
          locDropdown.innerHTML = matches.map(l => `
            <div class="loc-option touch-target" data-id="${l.id}" data-name="${this.esc(l.name)}" style="padding: 16px; border-bottom: 1px solid var(--color-border); cursor: pointer; display: flex; flex-direction: column; justify-content: center; min-height: 56px;">
              <div style="font-weight: 700; color: var(--color-text); font-size: 1.05rem;">${this.esc(l.name)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-secondary);">${this.esc(l.sectorName)}</div>
            </div>
          `).join('');
          
          locDropdown.querySelectorAll('.loc-option').forEach(opt => {
            opt.addEventListener('click', () => {
              this.selectedLocId = opt.dataset.id;
              this.selectedLocName = opt.dataset.name;
              locInput.value = this.selectedLocName;
              locDropdown.style.display = 'none';
            });
          });
        }
      };

      locInput.addEventListener('focus', () => {
        locDropdown.style.display = 'block';
        renderLocs(locInput.value);
      });

      locInput.addEventListener('input', (e) => {
        renderLocs(e.target.value);
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
          locDropdown.style.display = 'none';
        }
      });
    }

    // Save
    const saveBtn = this.modal.querySelector('#btn-save-capture');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const desc = this.modal.querySelector('#qc-description').value.trim();
        if (!desc) {
          toast.error('Tem de escrever a descrição.');
          return;
        }

        // Se ele digitou algo no input mas não escolheu da lista, usamos o texto
        if (locInput && locInput.value !== this.selectedLocName) {
           this.selectedLocName = locInput.value.trim() || 'Estádio — local não indicado';
           this.selectedLocId = null; // desliga o ID porque não bate certo
        }

        if (this.selectedLocId) {
          localStorage.setItem('last_used_loc_id', this.selectedLocId);
        }
        localStorage.setItem('last_used_loc_name', this.selectedLocName);

        // Prepara dados
        const newReport = {
          locationId: this.selectedLocId,
          locationName: this.selectedLocName,
          priority: this.priority,
          status: 'pending',
          description: desc,
          date: new Date().toISOString(),
          timeSpent: 0,
          photos: [], // fotos temporárias se implementadas aqui
          audioDuration: 0,
          materials: []
        };

        try {
          await reportsRepo.create(newReport);
          this.close();
          toast.success('Avaria registada no telemóvel');
          if (typeof this.onSave === 'function') {
            this.onSave();
          }
        } catch (e) {
          toast.error('Erro ao guardar avaria.');
          console.error(e);
        }
      };
    }
  }

  esc(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
