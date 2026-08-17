import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToastManager, showToast } from '../../src/ui/toast.js';

describe('Toast Module Unit Tests', () => {
  let toastManager;

  beforeEach(() => {
    document.body.innerHTML = '';
    toastManager = new ToastManager();
  });

  it('should create #toast-container if it does not exist', () => {
    expect(document.getElementById('toast-container')).toBeNull();
    toastManager.ensureContainer();
    const container = document.getElementById('toast-container');
    expect(container).not.toBeNull();
    expect(container.className).toBe('toast-container');
  });

  it('should display toast notification with message and type', () => {
    const toastEl = toastManager.show('Operação concluída com sucesso', 'success', 0);
    expect(toastEl).not.toBeNull();
    expect(toastEl.classList.contains('toast-success')).toBe(true);
    expect(toastEl.textContent).toContain('Operação concluída com sucesso');
    expect(toastEl.querySelector('.toast-icon svg')).not.toBeNull();
  });

  it('should display warning toast notification', () => {
    const toastEl = toastManager.warning('Modo offline ativo', 0);
    expect(toastEl.classList.contains('toast-warning')).toBe(true);
    expect(toastEl.textContent).toContain('Modo offline ativo');
    expect(toastEl.querySelector('.toast-icon svg')).not.toBeNull();
  });

  it('should display error toast notification', () => {
    const toastEl = toastManager.error('Erro ao guardar relatório', 0);
    expect(toastEl.classList.contains('toast-error')).toBe(true);
    expect(toastEl.textContent).toContain('Erro ao guardar relatório');
    expect(toastEl.querySelector('.toast-icon svg')).not.toBeNull();
  });

  it('should work with showToast helper function', () => {
    const toastEl = showToast('Mensagem de teste', 'info', 0);
    expect(toastEl).not.toBeNull();
    expect(toastEl.textContent).toContain('Mensagem de teste');
  });

  it('should auto-dismiss toast after duration', async () => {
    vi.useFakeTimers();
    const toastEl = toastManager.show('Notificação temporária', 'info', 1000);
    expect(document.body.contains(toastEl)).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(toastEl.classList.contains('fade-out')).toBe(true);

    // Fast-forward transition fallback timer
    vi.advanceTimersByTime(350);
    expect(document.body.contains(toastEl)).toBe(false);

    vi.useRealTimers();
  });
});
