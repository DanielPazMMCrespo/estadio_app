import { locationsRepo as defaultLocationsRepo } from '../db/locationsRepo.js';
import { toast } from './toast.js';
import { esc } from '../utils/html.js';

/**
 * Location Selector & Custom Location Modal Component
 * Displays a sliding bottom sheet modal for location selection & creation.
 */
export class LocationModalComponent {
  constructor(container = null, options = {}) {
    this.container = container || document.body;
    this.locationsRepo = options.locationsRepo || defaultLocationsRepo;
    this.onSelect = options.onSelect || null;
    this.selectedLocationId = options.selectedLocationId || '';

    this.modalEl = null;
    this.locationsList = [];
    this.filteredList = [];
    this.isFormExpanded = false;

    this.init();
  }

  init() {
    this.ensureModalDOM();
    this.bindEvents();
  }

  ensureModalDOM() {
    let modal = document.getElementById('modal-location');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-location';
      modal.className = 'bottom-sheet-overlay';
      modal.style.display = 'none';
      modal.style.zIndex = '9999';

      modal.innerHTML = `
        <div class="bottom-sheet-content location-modal-content" style="max-height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-shrink: 0;">
            <h3 class="modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--color-text);">Seleccionar Localização</h3>
            <button type="button" id="btn-close-location-modal" class="btn-close" aria-label="Fechar" style="background: none; border: none; font-size: 1.75rem; line-height: 1; cursor: pointer; color: var(--color-text-secondary); padding: 4px 8px; min-width: 36px; min-height: 36px;">&times;</button>
          </div>

          <!-- Search / Filter Input -->
          <div class="form-group" style="margin-bottom: 16px; flex-shrink: 0;">
            <input type="text" id="input-search-location" class="form-input" inputmode="search" placeholder="Pesquisar localização..." style="min-height: 48px; width: 100%;" />
          </div>

          <!-- Location Cards Radio List -->
          <div id="location-cards-list" class="location-cards-list" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1 1 auto; min-height: 0; margin-bottom: 16px; padding-right: 4px;">
            <!-- Rendered cards -->
          </div>

          <!-- Expandable Add New Location Form -->
          <div class="add-location-section" style="border-top: 1px solid var(--color-border); padding-top: 16px; flex-shrink: 0;">
            <button type="button" id="btn-add-location-trigger" class="touch-target btn-secondary" style="width: 100%; justify-content: center; gap: 8px; min-height: 48px; margin-bottom: 8px; font-size: 1.15rem;">
              <span style="font-size: 1.25rem; font-weight: 700;">+</span> Adicionar Novo Local
            </button>

            <form id="form-add-location" class="add-location-form" style="display: none; margin-top: 12px;" onsubmit="return false;">
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label" for="input-location-name">Nome da Localização *</label>
                <input type="text" id="input-location-name" class="form-input" placeholder="Ex: Camarote Presidencial" style="min-height: 48px; width: 100%;" required />
              </div>
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" for="input-location-desc">Descrição (Opcional)</label>
                <input type="text" id="input-location-desc" class="form-input" placeholder="Ex: Zona VIP superior" style="min-height: 48px; width: 100%;" />
              </div>
              <button type="button" id="btn-save-location" class="btn-primary-cta" style="width: 100%; height: var(--cta-height, 56px);">Guardar Localização</button>
            </form>
          </div>
        </div>
      `;

      this.container.appendChild(modal);
    }
    this.modalEl = modal;
  }

  bindEvents() {
    if (!this.modalEl) return;

    // Close button click
    const closeBtn = this.modalEl.querySelector('#btn-close-location-modal');
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    // Overlay backdrop click to dismiss
    this.modalEl.onclick = (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    };

    // Search filter input change
    const searchInput = this.modalEl.querySelector('#input-search-location');
    if (searchInput) {
      searchInput.oninput = (e) => {
        const query = (e.target.value || '').toLowerCase().trim();
        this.filterLocations(query);
      };
    }

    // Add location form toggle button
    const addTrigger = this.modalEl.querySelector('#btn-add-location-trigger');
    if (addTrigger) {
      addTrigger.onclick = () => {
        this.toggleAddForm();
      };
    }

    // Save location button click
    const saveBtn = this.modalEl.querySelector('#btn-save-location');
    if (saveBtn) {
      saveBtn.onclick = () => this.saveCustomLocation();
    }

    // Form submit enter key support
    const formEl = this.modalEl.querySelector('#form-add-location');
    if (formEl) {
      formEl.onsubmit = (e) => {
        e.preventDefault();
        this.saveCustomLocation();
      };
    }

    // Listen for global clicks on any #btn-add-location-trigger outside modal
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('#btn-add-location-trigger');
      if (trigger && !this.modalEl.contains(trigger)) {
        e.preventDefault();
        this.open({ expandForm: true });
      }
    });
  }

  async open(options = {}) {
    await this.loadLocations();
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';

      if (options.expandForm) {
        this.showAddForm();
      } else {
        this.hideAddForm();
      }

      // Clear search
      const searchInput = this.modalEl.querySelector('#input-search-location');
      if (searchInput) {
        searchInput.value = '';
        this.filterLocations('');
      }
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      this.hideAddForm();
    }
  }

  async loadLocations() {
    try {
      this.locationsList = await this.locationsRepo.getAll();
      this.filteredList = [...this.locationsList];
      this.renderCards();
    } catch (err) {
      console.error('[LocationModal] Error loading locations:', err);
    }
  }

  filterLocations(query) {
    if (!query) {
      this.filteredList = [...this.locationsList];
    } else {
      this.filteredList = this.locationsList.filter(loc =>
        (loc.name || '').toLowerCase().includes(query) ||
        (loc.description || '').toLowerCase().includes(query)
      );
    }
    this.renderCards();
  }

  renderCards() {
    const listEl = this.modalEl ? this.modalEl.querySelector('#location-cards-list') : null;
    if (!listEl) return;

    if (this.filteredList.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--color-text-secondary); font-size: 1.15rem;">
          Nenhuma localização encontrada.
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.filteredList.map(loc => {
      const isSelected = loc.id === this.selectedLocationId;
      return `
        <div class="location-card" data-id="${loc.id}" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border: 1.5px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--color-border)'};
          background-color: ${isSelected ? 'var(--color-surface)' : 'var(--color-card)'};
          border-radius: var(--radius-md);
          cursor: pointer;
          min-height: 60px;
          flex-shrink: 0;
          gap: 12px;
          box-sizing: border-box;
          transition: border-color 150ms ease, background-color 150ms ease;
        ">
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
            <div style="font-weight: 700; color: var(--color-text); font-size: 1.05rem; line-height: 1.35; word-break: break-word;">
              ${esc(loc.name)}
              ${loc.isCustom ? '<span style="font-size: 0.8rem; background: var(--color-surface-hover); color: var(--color-text-secondary); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 600; vertical-align: middle;">Personalizado</span>' : ''}
            </div>
            ${loc.description ? `<div style="font-size: 0.95rem; color: var(--color-text-secondary); line-height: 1.35; margin-top: 4px; word-break: break-word;">${esc(loc.description)}</div>` : ''}
          </div>
          <div style="
            width: 24px;
            height: 24px;
            min-width: 24px;
            min-height: 24px;
            border-radius: 50%;
            border: 2px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--color-border)'};
            background-color: ${isSelected ? 'var(--color-brand-primary)' : 'transparent'};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            ${isSelected ? '<div style="width: 10px; height: 10px; border-radius: 50%; background: var(--color-card);"></div>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    listEl.querySelectorAll('.location-card').forEach(card => {
      card.onclick = () => {
        const id = card.getAttribute('data-id');
        const selectedLoc = this.locationsList.find(l => l.id === id);
        if (selectedLoc) {
          this.selectLocation(selectedLoc);
        }
      };
    });
  }

  selectLocation(location) {
    this.selectedLocationId = location.id;
    this.renderCards();

    // Update parent select dropdown #select-location if present in DOM
    const selectEl = document.getElementById('select-location');
    if (selectEl) {
      let opt = selectEl.querySelector(`option[value="${location.id}"]`);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = location.id;
        opt.textContent = location.name;
        selectEl.appendChild(opt);
      }
      selectEl.value = location.id;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (typeof this.onSelect === 'function') {
      this.onSelect(location);
    }

    this.close();
  }

  toggleAddForm() {
    if (this.isFormExpanded) {
      this.hideAddForm();
    } else {
      this.showAddForm();
    }
  }

  showAddForm() {
    this.isFormExpanded = true;
    const formEl = this.modalEl ? this.modalEl.querySelector('#form-add-location') : null;
    if (formEl) {
      formEl.style.display = 'block';
      const nameInput = formEl.querySelector('#input-location-name');
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 100);
      }
    }
  }

  hideAddForm() {
    this.isFormExpanded = false;
    const formEl = this.modalEl ? this.modalEl.querySelector('#form-add-location') : null;
    if (formEl) {
      formEl.style.display = 'none';
      const nameInput = formEl.querySelector('#input-location-name');
      const descInput = formEl.querySelector('#input-location-desc');
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
    }
  }

  async saveCustomLocation() {
    const nameInput = this.modalEl ? this.modalEl.querySelector('#input-location-name') : null;
    const descInput = this.modalEl ? this.modalEl.querySelector('#input-location-desc') : null;

    const name = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';

    if (!name) {
      toast.error('Por favor, insira o nome da localização');
      if (nameInput) nameInput.focus();
      return;
    }

    try {
      const newLoc = await this.locationsRepo.create({
        name,
        description,
        isCustom: true
      });

      // Reload local list
      await this.loadLocations();

      // Update active parent form select dropdown `#select-location`
      const selectEl = document.getElementById('select-location');
      if (selectEl) {
        let opt = selectEl.querySelector(`option[value="${newLoc.id}"]`);
        if (!opt) {
          opt = document.createElement('option');
          opt.value = newLoc.id;
          opt.textContent = newLoc.name;
          selectEl.appendChild(opt);
        }
        selectEl.value = newLoc.id;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Display toast confirmation
      toast.success('Localização guardada no telemóvel');

      // Execute onSelect callback if registered
      if (typeof this.onSelect === 'function') {
        this.onSelect(newLoc);
      }

      // Close modal and reset form
      this.close();
    } catch (err) {
      console.error('[LocationModal] Failed to create location:', err);
      toast.error('Erro ao guardar localização');
    }
  }

}
