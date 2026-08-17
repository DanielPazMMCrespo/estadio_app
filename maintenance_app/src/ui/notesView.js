import { notesRepo } from '../db/notesRepo.js';
import { speechService } from '../services/speechService.js';
import { toast } from './toast.js';

/**
 * Ecrã NOTAS — notas soltas, sem campos obrigatórios.
 *
 * Contrato (outro agente instancia isto):
 *   new NotesViewComponent(container, {
 *     onConvertToReport,  // (note) => void — "Virar intervenção"
 *     onConvertToTask     // (note) => void — "Virar tarefa"
 *   })
 *   await view.render()
 *   await view.refresh()
 */

const SVG_MIC = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
const SVG_STOP = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';
const SVG_PIN = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 17v5"></path><path d="M9 10.8V4h6v6.8l2 3.2H7z"></path></svg>';

export class NotesViewComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onConvertToReport = options.onConvertToReport || null;
    this.onConvertToTask = options.onConvertToTask || null;

    this.notes = [];
    this.totalNotes = 0;
    this.searchQuery = '';
    this.isListening = false;
    this.saving = false;
    this.suppressBlurSave = false;
  }

  /* ===================== dados ===================== */

  async load() {
    try {
      const all = await notesRepo.getAll();
      this.totalNotes = all.length;
      this.notes = this.searchQuery ? await notesRepo.search(this.searchQuery) : all;
    } catch (err) {
      console.error('[Notas] Erro ao carregar:', err);
      this.notes = [];
      this.totalNotes = 0;
    }
  }

  /* ===================== render ===================== */

  async render() {
    if (!this.container) return;
    await this.load();

    this.container.innerHTML = `
      <section class="nv-view animate-fade-in">
        <div class="nv-composer">
          <label class="form-label" for="nv-input">Escreva ou use a escrita por voz para uma nota</label>
          <textarea id="nv-input" class="form-textarea nv-input" rows="3"
                    placeholder="Escreva aqui ou toque em Escrita por voz. Guarda ao sair do campo."></textarea>
          <div class="nv-composer-actions">
            <button type="button" class="nv-mic" id="nv-mic" aria-label="Escrita por voz">
              <span class="nv-mic-glyph">${SVG_MIC}</span>
              <span class="nv-mic-text">Escrita por voz</span>
            </button>
            <button type="button" class="nv-save" id="nv-save">Guardar nota</button>
          </div>
          <p class="nv-mic-status" id="nv-mic-status">Toque em Escrita por voz para transcrever a voz em texto.</p>
        </div>

        <div id="nv-list-wrap">${this.renderListWrap()}</div>
      </section>
    `;

    this.bindComposer();
    this.bindList();
  }

  async refresh() {
    if (!this.container) return;
    if (!this.container.querySelector('#nv-list-wrap')) {
      await this.render();
      return;
    }
    await this.load();
    const wrap = this.container.querySelector('#nv-list-wrap');
    wrap.innerHTML = this.renderListWrap();
    this.bindList();
  }

  renderListWrap() {
    const showSearch = this.totalNotes > 5;
    return `
      ${showSearch ? `
        <div class="nv-search">
          <label class="form-label" for="nv-search-input">Procurar nas notas</label>
          <input type="text" id="nv-search-input" class="form-input" placeholder="Palavra da nota ou local"
                 value="${this.esc(this.searchQuery)}" />
        </div>
      ` : ''}
      <div class="nv-list">${this.renderNotes()}</div>
    `;
  }

  renderNotes() {
    if (!this.notes.length) {
      if (this.searchQuery) {
        return `
          <div class="nv-empty">
            <h2 class="nv-empty-title">Nenhuma nota com "${this.esc(this.searchQuery)}"</h2>
            <p class="nv-empty-text">Apague a procura para ver todas as notas.</p>
          </div>
        `;
      }
      return `
        <div class="nv-empty">
          <h2 class="nv-empty-title">Ainda não há notas</h2>
          <p class="nv-empty-text">
            O campo lá em cima está pronto: escreva o que viu e saia do campo — fica guardado.
            Se tiver as mãos ocupadas, toque em <strong>Escrita por voz</strong> e fale.
          </p>
          <p class="nv-empty-text">Depois pode virar qualquer nota em intervenção ou em tarefa.</p>
        </div>
      `;
    }
    return this.notes.map(n => this.renderNote(n)).join('');
  }

  renderNote(note) {
    return `
      <article class="nv-note${note.pinned ? ' nv-note--pinned' : ''}" data-note-id="${this.esc(note.id)}">
        <header class="nv-note-head">
          <span class="nv-note-date">${this.esc(formatStamp(note.createdAt))}</span>
          ${note.pinned ? '<span class="nv-note-flag">Fixada</span>' : ''}
        </header>

        <p class="nv-note-body">${this.esc(note.body)}</p>

        ${note.locationName ? `<p class="nv-note-loc">${this.esc(note.locationName)}</p>` : ''}

        <div class="nv-note-actions">
          <button type="button" class="nv-act nv-act--report" data-action="to-report" data-id="${this.esc(note.id)}">Virar intervenção</button>
          <button type="button" class="nv-act nv-act--task" data-action="to-task" data-id="${this.esc(note.id)}">Virar tarefa</button>
          <button type="button" class="nv-act" data-action="pin" data-id="${this.esc(note.id)}">
            <span class="nv-act-glyph">${SVG_PIN}</span>
            <span>${note.pinned ? 'Desafixar' : 'Fixar'}</span>
          </button>
          <button type="button" class="nv-act nv-act--del" data-action="del" data-id="${this.esc(note.id)}">Apagar</button>
        </div>
      </article>
    `;
  }

  /* ===================== eventos ===================== */

  bindComposer() {
    const input = this.container.querySelector('#nv-input');
    const saveBtn = this.container.querySelector('#nv-save');
    const micBtn = this.container.querySelector('#nv-mic');

    [saveBtn, micBtn].forEach(btn => {
      if (!btn) return;
      btn.addEventListener('pointerdown', () => { this.suppressBlurSave = true; });
    });

    if (input) {
      input.addEventListener('blur', () => {
        if (this.suppressBlurSave || this.isListening) { return; }
        const body = (input.value || '').trim();
        if (!body) return;
        this.saveNote(body);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.suppressBlurSave = false;
        if (this.isListening) {
          this.toggleDictation();
        }
        const body = (input?.value || '').trim();
        if (!body) {
          toast.warning('Escreva ou dite alguma coisa primeiro.');
          if (input) try { input.focus(); } catch (e) {}
          return;
        }
        this.saveNote(body);
      });
    }

    if (micBtn) {
      micBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.suppressBlurSave = false;
        this.toggleDictation();
      });
    }
  }

  bindList() {
    const wrap = this.container.querySelector('#nv-list-wrap');
    if (!wrap) return;

    const search = wrap.querySelector('#nv-search-input');
    if (search) {
      search.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.refreshListOnly();
      });
    }

    wrap.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const note = this.notes.find(n => n.id === id) || await notesRepo.getById(id);
        if (!note) return;

        if (action === 'to-report') {
          if (this.onConvertToReport) this.onConvertToReport(note);
          else toast.info('Conversão em intervenção ainda não está ligada.');
          return;
        }
        if (action === 'to-task') {
          if (this.onConvertToTask) this.onConvertToTask(note);
          else toast.info('Conversão em tarefa ainda não está ligada.');
          return;
        }
        if (action === 'pin') {
          try {
            await notesRepo.togglePinned(id);
            toast.success(note.pinned ? 'Nota desafixada.' : 'Nota fixada no topo.');
            await this.refresh();
          } catch (err) {
            console.error('[Notas] pin:', err);
            toast.error('Não foi possível fixar a nota.');
          }
          return;
        }
        if (action === 'del') {
          const ok = window.confirm('Apagar esta nota?');
          if (!ok) return;
          try {
            await notesRepo.remove(id);
            toast.success('Nota apagada.');
            await this.refresh();
          } catch (err) {
            console.error('[Notas] del:', err);
            toast.error('Não foi possível apagar a nota.');
          }
        }
      });
    });
  }

  async refreshListOnly() {
    await this.load();
    const list = this.container?.querySelector('.nv-list');
    if (list) list.innerHTML = this.renderNotes();
    this.bindList();
  }

  /* ===================== ditar (Speech-to-Text) ===================== */

  setMicState(listening, statusText) {
    this.isListening = listening;
    const micBtn = this.container?.querySelector('#nv-mic');
    const glyph = micBtn?.querySelector('.nv-mic-glyph');
    const label = micBtn?.querySelector('.nv-mic-text');
    const status = this.container?.querySelector('#nv-mic-status');
    if (micBtn) micBtn.classList.toggle('nv-mic--rec', listening);
    if (glyph) glyph.innerHTML = listening ? SVG_STOP : SVG_MIC;
    if (label) label.textContent = listening ? 'Parar' : 'Escrita por voz';
    if (status && typeof statusText === 'string') status.textContent = statusText;
  }

  toggleDictation() {
    const input = this.container?.querySelector('#nv-input');

    if (!this.isListening) {
      const initialText = (input?.value || '').trim();
      const started = speechService.startListening({
        lang: 'pt-PT',
        onStart: () => {
          this.setMicState(true, 'A ouvir... Fale agora. Toque em Parar quando terminar.');
        },
        onResult: (spokenText) => {
          if (input) {
            input.value = initialText ? `${initialText} ${spokenText}` : spokenText;
          }
        },
        onEnd: () => {
          this.setMicState(false, 'Transcrição concluída. Pode editar ou carregar em Guardar nota.');
        },
        onError: (err) => {
          this.setMicState(false, 'Erro no microfone ou permissão negada.');
          if (err === 'not-allowed') toast.error('Permissão de microfone negada.');
          else if (err !== 'no-speech' && err !== 'aborted') toast.warning('Não foi possível transcrever a voz.');
        }
      });

      if (!started) {
        this.setMicState(false, 'Escrita por voz não suportada neste navegador.');
        toast.warning('O seu navegador não suporta escrita por voz.');
      }
    } else {
      speechService.stopListening();
      this.setMicState(false, 'Ditado parado. Pode guardar a nota.');
    }
  }

  /* ===================== guardar ===================== */

  async saveNote(body) {
    if (this.saving) return;
    const text = String(body || '').trim();
    if (!text) return;
    this.saving = true;
    try {
      await notesRepo.create({ body: text });
      const input = this.container?.querySelector('#nv-input');
      if (input) input.value = '';
      const status = this.container?.querySelector('#nv-mic-status');
      if (status) status.textContent = 'Nota guardada com sucesso.';
      toast.success('Nota guardada.');
      await this.refresh();
    } catch (err) {
      console.error('[Notas] create:', err);
      toast.error('Não foi possível guardar a nota.');
    } finally {
      this.saving = false;
    }
  }

  esc(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

function formatStamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
    const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} · ${timeStr}`;
  } catch (e) {
    return String(iso);
  }
}
