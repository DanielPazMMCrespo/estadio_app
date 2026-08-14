import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SpeechService, speechService } from '../../src/services/speechService.js';

describe('SpeechService (Speech-to-Text)', () => {
  let mockRecognitionInstance;
  let MockRecognitionClass;

  beforeEach(() => {
    mockRecognitionInstance = {
      lang: '',
      continuous: false,
      interimResults: false,
      maxAlternatives: 1,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null
    };

    MockRecognitionClass = vi.fn().mockImplementation(() => mockRecognitionInstance);
    window.SpeechRecognition = MockRecognitionClass;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    speechService.stopListening();
  });

  it('detects browser Speech Recognition support correctly', () => {
    expect(SpeechService.isSupported()).toBe(true);
    delete window.SpeechRecognition;
    expect(SpeechService.isSupported()).toBe(false);
  });

  it('starts listening and processes speech events into transcribed text', () => {
    const service = new SpeechService();
    const onStart = vi.fn();
    const onResult = vi.fn();
    const onEnd = vi.fn();

    const started = service.startListening({
      lang: 'pt-PT',
      onStart,
      onResult,
      onEnd
    });

    expect(started).toBe(true);
    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(mockRecognitionInstance.lang).toBe('pt-PT');
    expect(mockRecognitionInstance.continuous).toBe(true);

    // Simulate recognition onstart
    mockRecognitionInstance.onstart();
    expect(onStart).toHaveBeenCalled();
    expect(service.isListening).toBe(true);

    // Simulate recognition speech result event
    const mockEvent = {
      resultIndex: 0,
      results: [
        [
          { transcript: 'Substituição da lâmpada' }
        ]
      ]
    };
    mockRecognitionInstance.onresult(mockEvent);
    expect(onResult).toHaveBeenCalledWith('Substituição da lâmpada', false);

    // Simulate recognition onend
    mockRecognitionInstance.onend();
    expect(onEnd).toHaveBeenCalled();
    expect(service.isListening).toBe(false);
  });

  it('handles error events properly', () => {
    const service = new SpeechService();
    const onError = vi.fn();

    service.startListening({ onError });
    mockRecognitionInstance.onerror({ error: 'not-allowed' });

    expect(onError).toHaveBeenCalledWith('not-allowed');
  });

  it('attachDictation binds click to input field and manages button active state', () => {
    const service = new SpeechService();
    const button = document.createElement('button');
    button.innerHTML = '<span>Ditar</span>';
    const input = document.createElement('textarea');
    input.value = 'Nota inicial:';

    const cleanup = service.attachDictation(button, input, {
      activeHtml: '<span>A ouvir...</span>'
    });

    expect(typeof cleanup).toBe('function');

    // Click button to start dictation
    button.click();
    expect(mockRecognitionInstance.start).toHaveBeenCalled();

    // Trigger onstart
    mockRecognitionInstance.onstart();
    expect(button.classList.contains('dictation-active')).toBe(true);
    expect(button.innerHTML).toBe('<span>A ouvir...</span>');

    // Trigger speech result
    mockRecognitionInstance.onresult({
      resultIndex: 0,
      results: [[{ transcript: 'Torre norte reparada.' }]]
    });

    expect(input.value).toBe('Nota inicial: Torre norte reparada.');

    // Click button again to stop dictation
    button.click();
    expect(mockRecognitionInstance.stop).toHaveBeenCalled();

    // Trigger onend
    mockRecognitionInstance.onend();
    expect(button.classList.contains('dictation-active')).toBe(false);
    expect(button.innerHTML).toBe('<span>Ditar</span>');

    // Call cleanup
    cleanup();
  });
});
