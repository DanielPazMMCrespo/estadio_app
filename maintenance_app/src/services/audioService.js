/**
 * Audio Service for Voice Memos
 * Allows field technicians to record quick voice notes offline using the MediaRecorder API.
 */

export class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = 0;
    this.timerInterval = null;
  }

  /**
   * Check if audio recording is supported in the current browser.
   * @returns {boolean}
   */
  static isSupported() {
    return typeof navigator !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  /**
   * Start audio recording from microphone.
   * @param {Function} [onTick] Callback on every second with elapsed time
   * @returns {Promise<boolean>}
   */
  async startRecording(onTick) {
    if (!AudioService.isSupported()) {
      throw new Error('Gravação de áudio não suportada neste dispositivo.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];
      const supportedMime = mimeTypes.find(t => !t || (window.MediaRecorder && MediaRecorder.isTypeSupported(t))) || '';

      this.mediaRecorder = supportedMime
        ? new MediaRecorder(this.stream, { mimeType: supportedMime })
        : new MediaRecorder(this.stream);

      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      if (onTick) {
        this.timerInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          onTick(elapsed);
        }, 500);
      }

      this.mediaRecorder.start(250);
      return true;
    } catch (err) {
      console.error('[AudioService] Erro ao iniciar gravação:', err);
      this.cleanup();
      throw err;
    }
  }

  /**
   * Stop audio recording and return audio Blob and duration in seconds.
   * @returns {Promise<{ blob: Blob, duration: number, dataUrl: string }>}
   */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup();
        reject(new Error('Nenhuma gravação ativa.'));
        return;
      }

      const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
      if (this.timerInterval) clearInterval(this.timerInterval);

      this.mediaRecorder.onstop = async () => {
        try {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          const dataUrl = await AudioService.blobToDataUrl(audioBlob);
          this.cleanup();
          resolve({
            blob: audioBlob,
            duration,
            dataUrl
          });
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel and discard current recording.
   */
  cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {}
    }
    this.cleanup();
  }

  cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Convert Blob to base64 Data URL.
   * @param {Blob} blob 
   * @returns {Promise<string>}
   */
  static blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert data URL or Uint8Array to playable URL
   * @param {Blob|Uint8Array|string} audioData 
   * @returns {string}
   */
  static getPlayableUrl(audioData) {
    if (!audioData) return '';
    if (typeof audioData === 'string') return audioData;
    if (audioData instanceof Blob) return URL.createObjectURL(audioData);
    if (audioData.buffer || audioData instanceof Uint8Array) {
      const blob = new Blob([audioData], { type: 'audio/webm' });
      return URL.createObjectURL(blob);
    }
    return '';
  }
}

export const audioService = new AudioService();
