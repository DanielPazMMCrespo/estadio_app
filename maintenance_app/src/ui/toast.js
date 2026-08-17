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
    
    const ICONS = {
      info: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
      success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
      warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      error: '<circle cx="12" cy="12" r="9"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
    };
    const icon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[type] || ICONS.info}</svg>`;

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
