import { reportsRepo } from '../db/reportsRepo.js';
import { locationsRepo, locationLabel } from '../db/locationsRepo.js';
import { speechService } from '../services/speechService.js';
import { compressPhoto } from '../services/photoCompressor.js';
import { toolsRepo } from '../db/toolsRepo.js';
import { toast } from './toast.js';
import { haptics } from '../services/haptics.js';

import { esc } from '../utils/html.js';

/** Gera um id local único para fotos (crypto.randomUUID nem sempre existe). */
function photoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `qc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export class QuickCaptureComponent {
  constructor(options = {}) {
    this.onSave = options.onSave || null;
    // Chamado quando o técnico quer os campos todos (tempo, materiais):
    // recebe o que já escreveu para o formulário completo continuar.
    this.onExpand = options.onExpand || null;
    this.modal = null;
    this.locations = [];
    this.selectedLocId = null;
    this.selectedLocName = null;
    this.priority = 'medium';
    // Fotos desta captura, no mesmo formato do formulário completo
    // ({id, blobData, dataUrl, type, mimeType}) para o reportsRepo tratar.
    this.photos = [];
    // Contexto opcional: equipamento, porta ou ferramenta em consumo.
    this.context = {};
    this.consumeTool = null;
    this.dictationCleanup = null;
    // Referência ao ouvinte de cliques na página, removido no close().
    this.outsideClickHandler = null;
  }

  async open(prefill = {}) {
    if (this.modal) this.close();
    
    // Load locations
    try {
      this.locations = await locationsRepo.getAll();
    } catch (e) {
      // Sem locais a folha continua (texto livre), mas o técnico escolhe
      // às cegas: regista-se o porquê em vez de falhar em silêncio.
      console.warn('[Captura] Lista de locais indisponível:', e);
      this.locations = [];
    }

    // Default location (last used or fallback)
    const lastUsedLocId = localStorage.getItem('last_used_loc_id');
    const lastUsedLocName = localStorage.getItem('last_used_loc_name');
    
    this.selectedLocId = prefill.locationId || lastUsedLocId || null;
    this.selectedLocName = prefill.locationName || lastUsedLocName || 'Estádio — local não indicado';
    this.priority = prefill.priority || 'medium';
    // Contexto estruturado (equipamento/porta) viaja para o registo em vez
    // de ficar só em texto livre na descrição.
    this.context = {
      equipmentId: prefill.equipmentId || '',
      equipmentName: prefill.equipmentName || '',
      doorId: prefill.doorId || '',
      doorNumero: prefill.doorNumero || '',
    };
    // Ferramenta a descontar do stock ao gravar (vinda do ecrã Ferramentas).
    this.consumeTool = prefill.toolId
      ? { toolId: prefill.toolId, toolName: prefill.toolName || '', qty: 1 }
      : null;
    this.photos = [];
    this.prefillDescription = prefill.description || '';

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
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--color-text);">Nova Intervenção</h3>
          </div>
          <button type="button" class="btn-close-detail" id="btn-cancel-capture" style="width: 48px; height: 48px; font-size: 1.5rem;">&times;</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding-bottom: 24px;">
          <!-- DESCRIÇÃO (OBRIGATÓRIO) -->
          <div class="form-group" style="margin-bottom: 16px;">
            <div class="form-label-row">
              <label class="form-label" for="qc-description">Descrição da Intervenção *</label>
              <button type="button" id="qc-btn-mic" class="btn-secondary btn-dictate" title="Escrita por voz">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <span>Escrita por voz</span>
              </button>
            </div>
            <textarea id="qc-description" class="form-textarea" placeholder="Ex: Substituição do filtro ou reparação..." style="height: 110px; font-size: 1.1rem; padding: 12px;">${esc(this.prefillDescription || '')}</textarea>
          </div>

          <!-- FOTO (OPCIONAL, COMPRIMIDA) -->
          <div class="form-group" style="margin-bottom: 16px;">
            <span class="form-label">Foto</span>
            <div id="qc-context-line">${this.renderContextLine()}</div>
            <button type="button" id="qc-btn-photo" class="btn-secondary touch-target" style="width: 100%;">
              Fotografar avaria
            </button>
            <input type="file" id="qc-photo-input" accept="image/*" capture="environment" hidden />
            <div id="qc-photo-list" style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;"></div>
          </div>

          <!-- LOCALIZAÇÃO -->
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" style="font-size: 0.9rem;">Onde?</label>
            <div style="position: relative;">
              <input type="text" id="qc-loc-search" class="form-input touch-target" value="${esc(this.selectedLocName)}" autocomplete="off" placeholder="Pesquisar local..." style="padding-right: 40px;" />
              <svg style="position: absolute; right: 12px; top: 18px; color: var(--color-text-muted);" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <div id="qc-loc-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--color-surface); border: 1px solid var(--color-border); max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
            </div>
          </div>

          <!-- PRIORIDADE -->
          <div class="form-group" style="margin-bottom: 24px;">
            <label class="form-label" style="font-size: 0.9rem;">Prioridade</label>
            <div style="display:flex; gap:8px;" id="qc-priority-group">
              <button type="button" class="btn-secondary touch-target priority-btn" data-priority="low" style="flex:1;">Baixa</button>
              <button type="button" class="btn-secondary touch-target priority-btn active" data-priority="medium" style="flex:1;">Média</button>
              <button type="button" class="btn-secondary touch-target priority-btn" data-priority="critical" style="flex:1;">Crítica</button>
            </div>
          </div>
        </div>

        <!-- GRAVAR (SEMPRE VISÍVEL NO FUNDO) -->
        <div style="padding-top: 12px; background: var(--color-bg); border-top: 1px solid var(--color-border);">
          <button type="button" id="btn-save-capture" class="btn-primary-cta touch-target" style="width: 100%; height: 56px; font-size: 1.15rem; font-weight: 800; border-radius: var(--radius-md);">
            Gravar Intervenção
          </button>
          <button type="button" id="btn-expand-capture" class="btn-secondary" style="width: 100%; margin-top: 8px;">
            Mais campos (tempo, materiais)
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

  /** Linha de contexto: equipamento, porta ou ferramenta em consumo. */
  renderContextLine() {
    const parts = [];
    if (this.context.equipmentName || this.context.equipmentId) {
      parts.push(`Equipamento: ${this.context.equipmentName || this.context.equipmentId}`);
    }
    if (this.context.doorNumero || this.context.doorId) {
      parts.push(`Porta ${this.context.doorNumero || this.context.doorId}`);
    }
    if (this.consumeTool) {
      parts.push(`Desconta do stock: ${this.consumeTool.toolName || 'ferramenta'}`);
    }
    if (!parts.length) return '';
    return `<p class="qc-context" style="margin: 0 0 8px 0; font-size: var(--fs-label); font-weight: 700; color: var(--color-text);">${esc(parts.join(' · '))}</p>
      ${this.consumeTool ? `<label class="form-label" for="qc-consume-qty">Quantidade a descontar</label>
      <input type="number" id="qc-consume-qty" class="form-input touch-target" value="1" min="1" inputmode="numeric" style="max-width: 120px;" />` : ''}`;
  }

  /** Miniaturas das fotos desta captura, com botão de tirar. */
  renderPhotoList() {
    const list = this.modal ? this.modal.querySelector('#qc-photo-list') : null;
    if (!list) return;
    list.innerHTML = this.photos.map((p, idx) => `
      <div style="position: relative; width: 72px; height: 72px;">
        <img src="${esc(p.dataUrl)}" alt="Foto ${idx + 1}" style="width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-border);" />
        <button type="button" data-qc-photo-del="${idx}" aria-label="Tirar foto ${idx + 1}"
                style="position: absolute; top: -8px; right: -8px; width: 32px; height: 32px; border-radius: 50%; background: var(--color-danger); color: #FFFFFF; border: none; font-size: 18px; line-height: 1;">×</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-qc-photo-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.photos.splice(Number(btn.dataset.qcPhotoDel), 1);
        this.renderPhotoList();
      });
    });
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
          // A cor de cada opção vem do CSS (--seg-color), por data-priority.
          priorityGroup.querySelectorAll('.priority-btn').forEach(b => {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          this.priority = btn.dataset.priority;
        });
      });
    }

    // Dictation Button
    const micBtn = this.modal.querySelector('#qc-btn-mic');
    const descInput = this.modal.querySelector('#qc-description');
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

    // Foto da câmara, comprimida antes de entrar na base de dados.
    const photoBtn = this.modal.querySelector('#qc-btn-photo');
    const photoInput = this.modal.querySelector('#qc-photo-input');
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files && photoInput.files[0];
        photoInput.value = '';
        if (!file) return;
        if (file.type && !String(file.type).startsWith('image/')) {
          toast.error('Só fotografias (imagens).');
          return;
        }
        try {
          const result = await compressPhoto(file);
          this.photos.push({
            id: photoId(),
            blobData: result.blob,
            dataUrl: result.dataUrl,
            type: 'before',
            mimeType: result.mimeType
          });
          this.renderPhotoList();
          haptics.tap();
        } catch (err) {
          console.error('[Captura] Erro na foto:', err);
          toast.error('Não foi possível juntar a foto.');
        }
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
            (l.number && String(l.number).toLowerCase().includes(q)) ||
            (l.sectorName && l.sectorName.toLowerCase().includes(q))
          );
        }
        
        if (matches.length === 0) {
          // Sem resultados a lista FECHA — uma caixa vazia só tapava o botão de
          // gravar. Escrever texto livre é um caminho válido nesta app.
          locDropdown.innerHTML = '';
          locDropdown.style.display = 'none';
        } else {
          locDropdown.style.display = 'block';
          locDropdown.innerHTML = matches.map(l => `
            <div class="loc-option touch-target" data-id="${esc(l.id)}" data-name="${esc(locationLabel(l))}" style="padding: 16px; border-bottom: 1px solid var(--color-border); cursor: pointer; display: flex; flex-direction: column; justify-content: center; min-height: 56px;">
              <div style="font-weight: 700; color: var(--color-text); font-size: 1.05rem;">${esc(locationLabel(l))}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-secondary);">${esc(l.sectorName)}</div>
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

      // Quem decide se a lista aparece é o renderLocs, em função dos resultados.
      locInput.addEventListener('focus', () => {
        renderLocs(locInput.value);
      });

      locInput.addEventListener('input', (e) => {
        renderLocs(e.target.value);
      });
      
      // Fechar ao tocar fora. Guardado numa referência para o close() o poder
      // remover — esta folha abre e fecha muitas vezes por turno.
      if (this.outsideClickHandler) {
        document.removeEventListener('click', this.outsideClickHandler);
      }
      this.outsideClickHandler = (e) => {
        if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
          locDropdown.style.display = 'none';
        }
      };
      document.addEventListener('click', this.outsideClickHandler);
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

        // Se digitou algo no input mas não escolheu da lista, usamos o texto.
        // O id fica LOC_UNKNOWN e nunca null: o reportsRepo.create() exige um id
        // e, com null, o registo era rejeitado e o técnico perdia o que escreveu.
        if (locInput && locInput.value !== this.selectedLocName) {
           this.selectedLocName = locInput.value.trim() || 'Estádio — local não indicado';
           this.selectedLocId = 'LOC_UNKNOWN';
        }

        if (this.selectedLocId) {
          localStorage.setItem('last_used_loc_id', this.selectedLocId);
        }
        localStorage.setItem('last_used_loc_name', this.selectedLocName);

        const newReport = {
          locationId: this.selectedLocId || 'LOC_UNKNOWN',
          locationName: this.selectedLocName,
          priority: this.priority,
          status: 'pending',
          description: desc,
          date: new Date().toISOString(),
          timeSpent: 0,
          photos: this.photos,
          audioBlob: null,
          audioDuration: 0,
          materials: '',
          ...(this.context.equipmentId ? { equipmentId: this.context.equipmentId } : {}),
          ...(this.context.equipmentName ? { equipmentName: this.context.equipmentName } : {}),
          ...(this.context.doorId ? { doorId: this.context.doorId } : {}),
          ...(this.context.doorNumero ? { doorNumero: this.context.doorNumero } : {}),
        };

        try {
          const saved = await reportsRepo.create(newReport);
          // Desconto de stock pedido no ecrã Ferramentas: depois da avaria
          // gravada, nunca antes — a avaria nunca se perde por falta de stock.
          if (this.consumeTool) {
            const qtyInput = this.modal.querySelector('#qc-consume-qty');
            const qty = Math.max(1, Number(qtyInput && qtyInput.value) || 1);
            try {
              await toolsRepo.take(this.consumeTool.toolId, qty, 'uso em obra', saved.id);
            } catch (takeErr) {
              toast.warning(takeErr && takeErr.message ? takeErr.message : 'Não foi possível descontar do stock.');
            }
          }
          haptics.success();
          this.close();
          toast.success('Intervenção registada no telemóvel');
          if (typeof this.onSave === 'function') {
            this.onSave();
          }
        } catch (e) {
          // Telemóvel cheio: dizê-lo de frente em vez de "erro ao guardar".
          if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) {
            toast.error('Armazenamento do telemóvel cheio. Apague fotos antigas e tente de novo.');
          } else {
            toast.error('Erro ao guardar intervenção.');
          }
          console.error(e);
        }
      };
    }
    // Mais campos: leva o já escrito para o formulário completo.
    const expandBtn = this.modal.querySelector('#btn-expand-capture');
    if (expandBtn && typeof this.onExpand === 'function') {
      expandBtn.addEventListener('click', () => {
        const desc = (this.modal.querySelector('#qc-description').value || '').trim();
        const carried = {
          description: desc,
          locationId: this.selectedLocId,
          locationName: this.selectedLocName,
          priority: this.priority,
          ...this.context,
        };
        this.close();
        this.onExpand(carried);
      });
    } else if (expandBtn) {
      expandBtn.style.display = 'none';
    }
  }


  close() {
    speechService.stopListening();
    this.photos = [];
    this.consumeTool = null;
    this.context = {};
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
