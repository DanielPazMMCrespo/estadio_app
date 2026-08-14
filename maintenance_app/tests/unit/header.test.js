import { describe, it, expect, beforeEach } from 'vitest';
import { HeaderComponent } from '../../src/ui/header.js';

describe('HeaderComponent Unit Tests', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<header id="header-container"></header>';
    container = document.getElementById('header-container');
  });

  it('should render header with greeting and default online status', () => {
    const header = new HeaderComponent(container, {
      userName: 'Carlos',
      isOnline: true
    });
    header.render();

    expect(container.innerHTML).toContain('user-name');
    expect(container.innerHTML).toContain('Carlos');
    expect(container.innerHTML).toContain('Estádio Municipal de Leiria');

    const badge = container.querySelector('#connectivity-badge');
    expect(badge).not.toBeNull();
    expect(badge.classList.contains('online')).toBe(true);
    expect(badge.textContent).toContain('Online');
  });

  it('should render header with offline status', () => {
    const header = new HeaderComponent(container, {
      userName: 'Maria',
      isOnline: false
    });
    header.render();

    const badge = container.querySelector('#connectivity-badge');
    expect(badge.classList.contains('offline')).toBe(true);
    expect(badge.textContent).toContain('Offline');
  });

  it('should dynamically update connectivity badge status', () => {
    const header = new HeaderComponent(container, {
      userName: 'João',
      isOnline: true
    });
    header.render();

    let badge = container.querySelector('#connectivity-badge');
    expect(badge.classList.contains('online')).toBe(true);

    // Switch to offline
    header.updateStatus(false);
    badge = container.querySelector('#connectivity-badge');
    expect(badge.classList.contains('offline')).toBe(true);
    expect(badge.querySelector('.status-text').textContent).toBe('Offline');

    // Switch back to online
    header.updateStatus(true);
    badge = container.querySelector('#connectivity-badge');
    expect(badge.classList.contains('online')).toBe(true);
    expect(badge.querySelector('.status-text').textContent).toBe('Online');
  });

  it('should update user name dynamically', () => {
    const header = new HeaderComponent(container, {
      userName: 'Operador',
      isOnline: true
    });
    header.render();

    expect(container.querySelector('.user-name').textContent).toBe('Operador');

    header.setUserName('Manuel');
    expect(container.querySelector('.user-name').textContent).toBe('Manuel');
  });
});
