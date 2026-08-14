/**
 * Speech Recognition Service (Ditado por Voz em Português)
 * Clean Web Speech API wrapper without conflicting getUserMedia locks.
 */
export class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
  }

  static isSupported() {
    return typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Start speech recognition session.
   * @param {Object} options
   * @param {string} [options.lang='pt-PT']
   * @param {Function} options.onResult - (transcript: string, isFinal: boolean) => void
   * @param {Function} [options.onEnd]
   * @param {Function} [options.onError]
   * @returns {boolean}
   */
  startListening({ lang = 'pt-PT', onResult, onEnd, onError }) {
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

      let finalTranscript = '';

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + res[0].transcript.trim();
          } else {
            interim += res[0].transcript;
          }
        }
        const text = (finalTranscript + ' ' + interim).trim();
        if (typeof onResult === 'function' && text) {
          onResult(text);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[SpeechService] Error:', event.error);
        if (typeof onError === 'function') onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (typeof onEnd === 'function') onEnd(finalTranscript);
      };

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
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
  }
}

export const speechService = new SpeechService();
