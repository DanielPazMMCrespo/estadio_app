/**
 * Toast Notification Module
 */
export class ToastManager {
  constructor(container = null) {
    this.container = container;
  }

  ensureContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      let el = document.getElementById('toast-container');
      if (!el && typeof document !== 'undefined' && document.body) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        document.body.appendChild(el);
      }
      this.container = el;
    }
    return this.container;
  }

  show(message, type = 'info', duration = 3500) {
    const container = this.ensureContainer();
    if (!container) return null;

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type} slide-in`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toastEl.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toastEl);

    if (duration > 0) {
      setTimeout(() => {
        toastEl.classList.add('fade-out');
        const removeToast = () => {
          if (toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
          }
        };
        toastEl.addEventListener('transitionend', removeToast, { once: true });
        // Fallback safety timeout if transitionend doesn't trigger
        setTimeout(removeToast, 300);
      }, duration);
    }

    return toastEl;
  }

  success(message, duration) { return this.show(message, 'success', duration); }
  error(message, duration) { return this.show(message, 'error', duration); }
  warning(message, duration) { return this.show(message, 'warning', duration); }
  info(message, duration) { return this.show(message, 'info', duration); }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const toast = new ToastManager();
export const showToast = (message, type, duration) => toast.show(message, type, duration);
