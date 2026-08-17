/**
 * Photo Editor & Markup Tool
 * Provides client-side HTML5 canvas annotation (arrows, circles, brush) on captured photos.
 */

export class PhotoEditor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.img = null;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentColor = '#EF4444'; // Alerta Vermelho
    this.currentTool = 'arrow'; // 'arrow' | 'circle' | 'brush' | 'box'
    this.lineWidth = 4;
    this.history = [];
    this.historyStep = -1;
    this.container = null;
  }

  /**
   * Initialize and display modal photo editor for a given image file or dataURL.
   * @param {File|Blob|string} imageSource 
   * @returns {Promise<{ blob: Blob, dataUrl: string } | null>}
   */
  async open(imageSource) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'photo-editor-overlay animate-fade-in';
      modal.innerHTML = `
        <div class="photo-editor-modal">
          <div class="photo-editor-header">
            <div class="editor-title-group">
              <h3 class="photo-editor-title">Anotar Fotografia</h3>
            </div>
            <div class="photo-editor-actions">
              <button type="button" class="btn-editor-action" id="btn-editor-undo" title="Desfazer">Desfazer</button>
              <button type="button" class="btn-editor-action" id="btn-editor-clear" title="Limpar">Limpar</button>
              <button type="button" class="btn-close-editor" id="btn-editor-cancel">&times;</button>
            </div>
          </div>

          <div class="photo-editor-toolbar">
            <div class="tool-group">
              <button type="button" class="editor-tool-btn active" data-tool="arrow" title="Seta Indicadora">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <span>Seta</span>
              </button>
              <button type="button" class="editor-tool-btn" data-tool="circle" title="Círculo de Destaque">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/></svg>
                <span>Círculo</span>
              </button>
              <button type="button" class="editor-tool-btn" data-tool="box" title="Caixa de Destaque">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                <span>Caixa</span>
              </button>
              <button type="button" class="editor-tool-btn" data-tool="brush" title="Pincel Livre">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                <span>Pincel</span>
              </button>
            </div>

            <div class="color-group">
              <button type="button" class="color-btn active" data-color="#EF4444" style="background:#EF4444;" title="Vermelho"></button>
              <button type="button" class="color-btn" data-color="#00F59B" style="background:#00F59B;" title="Verde Neon"></button>
              <button type="button" class="color-btn" data-color="#F59E0B" style="background:#F59E0B;" title="Âmbar"></button>
              <button type="button" class="color-btn" data-color="#FFFFFF" style="background:#FFFFFF;" title="Branco"></button>
            </div>
          </div>

          <div class="photo-editor-canvas-wrapper" id="canvas-wrapper">
            <canvas id="photo-editor-canvas"></canvas>
          </div>

          <div class="photo-editor-footer">
            <button type="button" class="btn-secondary" id="btn-editor-discard" style="flex:1;">Manter Original</button>
            <button type="button" class="btn-primary-cta" id="btn-editor-save" style="flex:2;">Concluir e Guardar Anotação</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      this.canvas = modal.querySelector('#photo-editor-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.container = modal;

      // Load Image
      this.loadImage(imageSource).then(() => {
        this.saveState();
        this.setupEditorEvents(modal, resolve);
      });
    });
  }

  loadImage(source) {
    return new Promise((resolve, reject) => {
      this.img = new Image();
      this.img.crossOrigin = 'anonymous';

      this.img.onload = () => {
        const maxWidth = 1024;
        const maxHeight = 1024;
        let w = this.img.width;
        let h = this.img.height;

        if (w > maxWidth || h > maxHeight) {
          if (w > h) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          } else {
            w = Math.round((w * maxHeight) / h);
            h = maxHeight;
          }
        }

        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(this.img, 0, 0, w, h);
        resolve();
      };

      this.img.onerror = reject;

      if (typeof source === 'string') {
        this.img.src = source;
      } else if (source instanceof Blob || source instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => { this.img.src = e.target.result; };
        reader.readAsDataURL(source);
      }
    });
  }

  saveState() {
    this.historyStep++;
    if (this.historyStep < this.history.length) {
      this.history.length = this.historyStep;
    }
    this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
  }

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.ctx.putImageData(this.history[this.historyStep], 0, 0);
    }
  }

  clear() {
    if (this.img) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
      this.saveState();
    }
  }

  setupEditorEvents(modal, resolve) {
    // Tool buttons
    modal.querySelectorAll('.editor-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.editor-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
      });
    });

    // Color buttons
    modal.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
      });
    });

    // Undo / Clear
    modal.querySelector('#btn-editor-undo')?.addEventListener('click', () => this.undo());
    modal.querySelector('#btn-editor-clear')?.addEventListener('click', () => this.clear());

    // Discard / Cancel
    const closeEditor = (result = null) => {
      modal.remove();
      this.history = [];
      this.historyStep = -1;
      resolve(result);
    };

    modal.querySelector('#btn-editor-cancel')?.addEventListener('click', () => closeEditor(null));
    modal.querySelector('#btn-editor-discard')?.addEventListener('click', () => closeEditor(null));

    // Save
    modal.querySelector('#btn-editor-save')?.addEventListener('click', () => {
      this.canvas.toBlob((blob) => {
        const dataUrl = this.canvas.toDataURL('image/jpeg', 0.85);
        closeEditor({ blob, dataUrl });
      }, 'image/jpeg', 0.85);
    });

    // Drawing Interaction (Mouse & Touch)
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    let snapshot = null;

    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = getPos(e);
      this.startX = pos.x;
      this.startY = pos.y;
      snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      if (this.currentTool === 'brush') {
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
      }
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);

      if (this.currentTool === 'brush') {
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
      } else {
        this.ctx.putImageData(snapshot, 0, 0);
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.shadowBlur = 4;

        if (this.currentTool === 'arrow') {
          this.drawArrow(this.startX, this.startY, pos.x, pos.y);
        } else if (this.currentTool === 'circle') {
          this.drawEllipse(this.startX, this.startY, pos.x, pos.y);
        } else if (this.currentTool === 'box') {
          this.ctx.strokeRect(this.startX, this.startY, pos.x - this.startX, pos.y - this.startY);
        }
        this.ctx.shadowBlur = 0;
      }
    };

    const endDraw = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.saveState();
    };

    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', endDraw);

    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', endDraw);
  }

  drawArrow(fromX, fromY, toX, toY) {
    const headlen = 22;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.stroke();
  }

  drawEllipse(x1, y1, x2, y2) {
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;
    const centerX = Math.min(x1, x2) + radiusX;
    const centerY = Math.min(y1, y2) + radiusY;

    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    this.ctx.stroke();
  }
}

export const photoEditor = new PhotoEditor();
