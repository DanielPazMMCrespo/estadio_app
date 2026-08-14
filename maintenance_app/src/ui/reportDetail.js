import { reportsRepo } from '../db/reportsRepo.js';
import { getPhotoDataUrl } from '../db/db.js';
import { PdfService } from '../services/pdfService.js';
import { toast } from './toast.js';

/**
 * Report Detail Component — Bottom Sheet / Full Screen Modal with
 * Priority & Status Manager, Photo Lightbox, and PDF Work Order Export.
 */
export class ReportDetailComponent {
  constructor(options = {}) {
    this.onEdit = options.onEdit || null;
    this.onDelete = options.onDelete || null;
    this.onStatusChanged = options.onStatusChanged || null;
    this.onClose = options.onClose || null;
    this.modalEl = null;
    this.currentReport = null;
  }

  async open(reportId) {
    if (!reportId) return;
    try {
      this.currentReport = await reportsRepo.getById(reportId);
    } catch (e) {
      console.error('[ReportDetail] getById error:', e);
      toast.error('Erro ao carregar registo');
      return;
    }

    if (!this.currentReport) {
      toast.error('Registo não encontrado');
      return;
    }

    this.buildModal();
    this.modalEl.style.zIndex = '9999';
    this.modalEl.style.display = 'flex';
    document.body.appendChild(this.modalEl);
  }

  buildModal() {
    if (this.modalEl?.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
    this.modalEl = null;

    const r = this.currentReport;
    if (!r) return;
    const date = new Date(r.date || Date.now());
    const dateStr = date.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    const priority = r.priority || 'medium';
    const status = r.status || 'pending';

    const priorityLabels = {
      critical: { label: 'CRÍTICO / URGENTE', cls: 'crit' },
      medium: { label: 'MÉDIO', cls: 'med' },
      low: { label: 'BAIXO', cls: 'low' }
    };
    const pInfo = priorityLabels[priority] || priorityLabels.medium;

    // Photos Gallery
    let photosHtml = '';
    if (Array.isArray(r.photos) && r.photos.length > 0) {
      const items = r.photos.map((p, idx) => {
        const url = getPhotoDataUrl(p);
        if (!url) return '';
        const typeLabel = p.type === 'before' ? 'Antes' : (p.type === 'after' ? 'Depois' : `Foto #${idx + 1}`);
        return `
          <div class="detail-photo-card" data-url="${url}">
            <img src="${url}" alt="Foto ${idx + 1}" class="detail-photo-img" />
            <span class="detail-photo-tag">${typeLabel}</span>
          </div>
        `;
      }).filter(Boolean).join('');

      if (items) {
        photosHtml = `
          <div class="detail-section">
            <h4 class="detail-section-title">Fotografias & Evidências (${r.photos.length})</h4>
            <div class="detail-photos-scroll">${items}</div>
          </div>
        `;
      }
    }

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'bottom-sheet-overlay animate-fade-in';
    this.modalEl.innerHTML = `
      <div class="bottom-sheet-content detail-sheet">
        <div class="sheet-drag-handle"><div class="drag-bar"></div></div>

        <!-- Top Header -->
        <div class="detail-header">
          <div class="detail-header-info">
            <span class="detail-ref">REF: EML-${(r.id || '').substring(0, 6).toUpperCase()}</span>
            <h3 class="detail-location-title">${this.esc(r.locationName || 'Estádio')}</h3>
            <p class="detail-timestamp">${dateStr} · ${timeStr}</p>
          </div>
          <button type="button" class="btn-close-detail" id="btn-close-detail">&times;</button>
        </div>

        <!-- Status & Priority Controls -->
        <div class="detail-status-bar">
          <div class="status-segment-group">
            <label class="status-seg-label">Estado:</label>
            <div class="status-segmented-control">
              <button type="button" class="status-seg-btn ${status === 'pending' ? 'active pending' : ''}" data-status="pending">⏳ Pendente</button>
              <button type="button" class="status-seg-btn ${status === 'in_progress' ? 'active in_progress' : ''}" data-status="in_progress">⚙️ Em Curso</button>
              <button type="button" class="status-seg-btn ${status === 'resolved' ? 'active resolved' : ''}" data-status="resolved">✅ Resolvido</button>
            </div>
          </div>
          <span class="detail-priority-chip ${pInfo.cls}">${pInfo.label}</span>
        </div>

        <!-- Work Description -->
        <div class="detail-section">
          <h4 class="detail-section-title">Descrição da Intervenção</h4>
          <div class="detail-text-box">${this.esc(r.description || '')}</div>
        </div>

        <!-- Materials & Time -->
        <div class="detail-grid-two">
          <div class="detail-section">
            <h4 class="detail-section-title">Tempo de Intervenção</h4>
            <div class="detail-stat-pill">⏱️ ${r.timeSpent || 0} minutos</div>
          </div>
          <div class="detail-section">
            <h4 class="detail-section-title">Sincronização</h4>
            <div class="detail-stat-pill">${r.synced ? '☁️ Sincronizado' : '📱 Gravado Local'}</div>
          </div>
        </div>

        ${r.materials ? `
          <div class="detail-section">
            <h4 class="detail-section-title">Materiais & Ferramentas</h4>
            <div class="detail-text-box">${this.esc(r.materials)}</div>
          </div>
        ` : ''}

        ${photosHtml}

        <!-- Resolution Notes if Resolved -->
        <div class="detail-section" id="section-resolution-notes" style="${status === 'resolved' ? '' : 'display:none;'}">
          <h4 class="detail-section-title">Notas de Resolução</h4>
          <div class="detail-text-box success" id="display-resolution-notes">${this.esc(r.resolutionNotes || 'Trabalho concluído com sucesso.')}</div>
        </div>

        <!-- Action Buttons -->
        <div class="detail-actions-footer">
          <button type="button" class="btn-pdf-export" id="btn-export-pdf">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Exportar Ficha PDF
          </button>
          <div class="detail-edit-del-group">
            <button type="button" class="btn-detail-edit" id="btn-edit-report">Editar</button>
            <button type="button" class="btn-detail-delete" id="btn-delete-report">Eliminar</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.modalEl) return;

    this.modalEl.querySelector('#btn-close-detail')?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // Status Buttons Click
    this.modalEl.querySelectorAll('.status-seg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status;
        if (newStatus === this.currentReport.status) return;

        let notes = this.currentReport.resolutionNotes || '';
        if (newStatus === 'resolved' && !notes) {
          notes = 'Trabalho efetuado e verificado.';
        }

        try {
          const updated = await reportsRepo.setStatus(this.currentReport.id, newStatus, notes);
          this.currentReport = updated;
          toast.success(newStatus === 'resolved' ? 'Marcado como Resolvido!' : 'Estado atualizado');
          this.buildModal();
          if (this.onStatusChanged) this.onStatusChanged();
        } catch (err) {
          toast.error('Erro ao atualizar estado');
        }
      });
    });

    // Export PDF
    this.modalEl.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
      if (this.currentReport) {
        PdfService.exportReport(this.currentReport);
      }
    });

    // Edit
    this.modalEl.querySelector('#btn-edit-report')?.addEventListener('click', () => {
      const id = this.currentReport?.id;
      this.close();
      if (id && this.onEdit) this.onEdit(id);
    });

    // Delete
    this.modalEl.querySelector('#btn-delete-report')?.addEventListener('click', async () => {
      if (!confirm('Eliminar este registo de intervenção?')) return;
      try {
        const id = this.currentReport?.id;
        if (id) {
          await reportsRepo.remove(id);
          toast.success('Intervenção eliminada');
          this.close();
          if (this.onDelete) this.onDelete(id);
        }
      } catch (e) {
        toast.error('Erro ao eliminar');
      }
    });

    // Photo Click Lightbox
    this.modalEl.querySelectorAll('.detail-photo-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.dataset.url;
        if (url) {
          window.open(url, '_blank');
        }
      });
    });
  }

  close() {
    if (this.modalEl?.parentNode) this.modalEl.parentNode.removeChild(this.modalEl);
    this.modalEl = null;
    this.currentReport = null;
    if (this.onClose) this.onClose();
  }

  esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
