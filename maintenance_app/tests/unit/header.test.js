import { describe, it, expect, beforeEach } from 'vitest';
import { HeaderComponent } from '../../src/ui/header.js';

describe('HeaderComponent Unit Tests', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<header id="header-container"></header>';
    container = document.getElementById('header-container');
  });

  // O cabeçalho é moldura, não conteúdo. A saudação ("Olá, Técnico") e o nome
  // do estádio foram removidos de propósito: ocupavam duas linhas no topo de
  // todos os ecrãs, cerca de 120px dos 844px do telemóvel, e não diziam nada
  // que o técnico não soubesse. O espaço passou para o trabalho.
  it('renders only the logo and the status badge', () => {
    const header = new HeaderComponent(container, {
      userName: 'Carlos',
      isOnline: true
    });
    header.render();

    expect(container.querySelector('.header-logo')).not.toBeNull();

    // A saudação e o nome do estádio não voltam ao cabeçalho.
    expect(container.innerHTML).not.toContain('user-name');
    expect(container.innerHTML).not.toContain('Olá');
    expect(container.innerHTML).not.toContain('Estádio Municipal de Leiria');

    const badge = container.querySelector('#connectivity-badge');
    expect(badge).not.toBeNull();
    expect(badge.classList.contains('online')).toBe(true);
    expect(badge.textContent).toContain('Online');
  });

  // O alvo tem de ser tocável com luvas, por isso é um <button> a sério
  // e não uma <div> com um onclick.
  it('exposes the status badge as a real button', () => {
    const header = new HeaderComponent(container, { userName: 'Carlos', isOnline: true });
    header.render();

    const badge = container.querySelector('#connectivity-badge');
    expect(badge.tagName).toBe('BUTTON');
    expect(badge.getAttribute('type')).toBe('button');
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

  // O nome do operador continua a ser guardado (as fichas em PDF e as
  // definições usam-no), mas já não é desenhado no cabeçalho. Mudar o nome
  // não pode rebentar nem voltar a pôr a saudação no ecrã.
  it('keeps the operator name in state without drawing it', () => {
    const header = new HeaderComponent(container, {
      userName: 'Operador',
      isOnline: true
    });
    header.render();

    expect(() => header.setUserName('Manuel')).not.toThrow();
    expect(header.userName).toBe('Manuel');
    expect(container.innerHTML).not.toContain('Manuel');

    // E o estado de ligação sobrevive à mudança de nome.
    expect(container.querySelector('#connectivity-badge')).not.toBeNull();
  });
});
