/**
 * Speech Recognition Service (Ditado por Voz em Português)
 * Clean Web Speech API wrapper for real-time Speech-to-Text transcription.
 * Transcribes spoken Portuguese directly into text fields without saving audio files.
 */
export class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.activeButton = null;
    this.activeInput = null;
  }

  static isSupported() {
    return typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Start speech recognition session.
   * @param {Object} options
   * @param {string} [options.lang='pt-PT']
   * @param {Function} options.onResult - (text: string, isFinal: boolean) => void
   * @param {Function} [options.onStart]
   * @param {Function} [options.onEnd]
   * @param {Function} [options.onError]
   * @returns {boolean}
   */
  startListening({ lang = 'pt-PT', onResult, onStart, onEnd, onError } = {}) {
    if (!SpeechService.isSupported()) {
      if (typeof onError === 'function') onError('not-supported');
      return false;
    }

    this.stopListening();

    try {
      const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecClass();
      this.recognition.lang = lang;
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        if (typeof onStart === 'function') onStart();
      };

      this.recognition.onresult = (event) => {
        let finalPart = '';
        let interimPart = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalPart += (finalPart ? ' ' : '') + res[0].transcript.trim();
          } else {
            interimPart += (interimPart ? ' ' : '') + res[0].transcript.trim();
          }
        }

        const combined = [finalPart, interimPart].filter(Boolean).join(' ').trim();
        if (typeof onResult === 'function' && combined) {
          onResult(combined, !interimPart && !!finalPart);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[SpeechService] Recognition error:', event.error);
        // Erros fatais: não vale a pena voltar a ligar o microfone sozinho.
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
          this._shouldRestart = false;
        }
        if (typeof onError === 'function') onError(event.error);
      };

      this.recognition.onend = () => {
        // O motor de voz do Chrome desliga-se sozinho ao fim de uma pausa na fala,
        // mesmo com continuous:true. Volta a ligar automaticamente, a não ser que
        // o próprio técnico tenha carregado em "Parar".
        if (this._shouldRestart) {
          try {
            this.recognition.start();
            return;
          } catch (e) {
            // Não foi possível reiniciar; cai para o estado parado abaixo.
          }
        }
        this.isListening = false;
        if (typeof onEnd === 'function') onEnd();
      };

      this._shouldRestart = true;
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('[SpeechService] Start failed:', err);
      this.isListening = false;
      if (typeof onError === 'function') onError(err);
      return false;
    }
  }

  stopListening() {
    this._shouldRestart = false;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
  }

  /**
   * Helper to attach dictation to any button and text field.
   * @param {HTMLElement|string} button - The mic/dictate button
   * @param {HTMLInputElement|HTMLTextAreaElement|string} input - The text field
   * @param {Object} [options]
   * @returns {Function} cleanup function
   */
  attachDictation(button, input, options = {}) {
    const btnEl = typeof button === 'string' ? document.querySelector(button) : button;
    const inputEl = typeof input === 'string' ? document.querySelector(input) : input;

    if (!btnEl || !inputEl) return () => {};

    let originalHtml = btnEl.innerHTML;
    let initialText = '';

    const updateBtnState = (listening) => {
      if (listening) {
        btnEl.classList.add('dictation-active', 'recording');
        if (options.activeHtml) {
          btnEl.innerHTML = options.activeHtml;
        } else {
          btnEl.innerHTML = `
            <span class="dictation-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ef4444; margin-right:6px; animation:pulse 1s infinite;"></span>
            <span>A ouvir... (Parar)</span>
          `;
        }
      } else {
        btnEl.classList.remove('dictation-active', 'recording');
        btnEl.innerHTML = originalHtml;
      }
    };

    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.isListening && this.activeButton === btnEl) {
        this.stopListening();
        updateBtnState(false);
        this.activeButton = null;
        this.activeInput = null;
        return;
      }

      if (this.isListening) {
        this.stopListening();
      }

      if (!SpeechService.isSupported()) {
        if (window.toast) {
          window.toast.warning('O seu navegador não suporta ditado por voz.');
        } else {
          alert('Ditado por voz não suportado neste navegador.');
        }
        return;
      }

      initialText = (inputEl.value || '').trim();
      this.activeButton = btnEl;
      this.activeInput = inputEl;

      const started = this.startListening({
        lang: options.lang || 'pt-PT',
        onStart: () => {
          updateBtnState(true);
          if (options.onStart) options.onStart();
        },
        onResult: (spokenText) => {
          const newText = initialText ? `${initialText} ${spokenText}` : spokenText;
          inputEl.value = newText;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          if (options.onResult) options.onResult(newText);
        },
        onEnd: () => {
          updateBtnState(false);
          this.activeButton = null;
          this.activeInput = null;
          if (options.onEnd) options.onEnd(inputEl.value);
        },
        onError: (err) => {
          updateBtnState(false);
          this.activeButton = null;
          this.activeInput = null;
          if (err === 'not-allowed') {
            if (window.toast) window.toast.error('Permissão de microfone negada.');
          } else if (err !== 'no-speech' && err !== 'aborted') {
            if (window.toast) window.toast.warning('Não foi possível transcrever a voz.');
          }
          if (options.onError) options.onError(err);
        }
      });

      if (!started) {
        updateBtnState(false);
        this.activeButton = null;
        this.activeInput = null;
      }
    };

    btnEl.addEventListener('click', clickHandler);

    return () => {
      btnEl.removeEventListener('click', clickHandler);
      if (this.activeButton === btnEl) {
        this.stopListening();
      }
    };
  }
}

export const speechService = new SpeechService();
