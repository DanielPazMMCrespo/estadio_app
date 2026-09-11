import { setupProfile, verifyPin, clearProfile, isValidPin, getUsers, getUserById, getCurrentUser, setCurrentUser, verifyUserPin } from '../services/profile.js';
import { haptics } from '../services/haptics.js';
import { toast } from './toast.js';

import { esc } from '../utils/html.js';

/**
 * Ecrã de entrada — perfil local com PIN (sem servidor, sem rede).
 *
 * Três modos:
 * - setup: primeira abertura (ou criação): nome + PIN duas vezes.
 * - unlock: aberturas seguintes: "Olá, nome" + PIN uma vez.
 * - select: alternar entre utilizadores registados.
 *
 * Teclado de luvas: teclas de 72px, pontos grandes, vibração por toque.
 * Nunca mostra o PIN: nem em pontos pequenos, nem em lado nenhum.
 */
export class LockScreenComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.mode = options.mode === 'unlock' ? 'unlock' : 'setup';
    const current = getCurrentUser();
    this.selectedUserId = current ? current.id : null;
    this.name = options.name || (current ? current.name : '');
    this.onDone = options.onDone || null;
    this.overlay = null;
    this.entered = '';
    this.firstPin = '';
    this.expectingConfirm = false;
    this.busy = false;
    this.selectingUser = false;
  }

  open() {
    this.close();
    this.entered = '';
    this.firstPin = '';
    this.expectingConfirm = false;
    this.busy = false;

    this.overlay = document.createElement('div');
    this.overlay.className = 'lock-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', this.mode === 'setup' ? 'Criar perfil' : 'Desbloquear');
    this.overlay.innerHTML = this.template();
    (this.container || document.body).appendChild(this.overlay);
    this.bindEvents();
    const nameInput = this.overlay.querySelector('#lock-name');
    if (nameInput && !nameInput.value) {
      setTimeout(() => { try { nameInput.focus(); } catch { /* sem foco */ } }, 100);
    }
  }

  template() {
    if (this.selectingUser) {
      const users = getUsers();
      return `
        <div class="lock-card">
          <img src="/icons/logo-mmcrespo.png" alt="mmcrespo" class="lock-logo" />
          <h1 class="lock-title">Quem vai usar?</h1>
          <p class="lock-sub">Escolha o seu perfil para introduzir o PIN:</p>

          <div class="lock-users-list">
            ${users.map(u => `
              <button type="button" class="lock-user-tile touch-target${u.id === this.selectedUserId ? ' is-active' : ''}" data-user-id="${esc(u.id)}">
                <span class="lock-user-name">${esc(u.name)}</span>
                <span class="lock-user-badge ${u.role === 'admin' ? 'is-admin' : 'is-tech'}">${u.role === 'admin' ? 'Administrador' : 'Técnico'}</span>
              </button>
            `).join('')}
          </div>

          <button type="button" class="lock-switch" id="lock-back-pin">Voltar ao ecrã anterior</button>
        </div>
      `;
    }

    const isSetup = this.mode === 'setup';
    const allUsers = getUsers();
    const canSwitch = allUsers.length > 1;

    return `
      <div class="lock-card">
        <img src="/icons/logo-mmcrespo.png" alt="mmcrespo" class="lock-logo" />
        <h1 class="lock-title">${isSetup ? 'Quem vai usar?' : `Olá, ${esc(this.name) || 'técnico'}`}</h1>
        <p class="lock-sub">${isSetup
          ? 'Uma vez por aparelho. Depois basta o PIN — mesmo sem rede.'
          : 'O PIN para entrar.'}</p>

        ${isSetup ? `
          <label class="form-label" for="lock-name">Nome do técnico</label>
          <input type="text" id="lock-name" class="form-input lock-name-input"
                 placeholder="Ex: Manuel Silva" autocomplete="off" value="${esc(this.name)}" />
          <p class="form-label" id="lock-pin-label">Escolha um PIN de 4 dígitos</p>
        ` : ''}

        <div class="lock-dots" aria-hidden="true">
          <span class="lock-dot"></span><span class="lock-dot"></span><span class="lock-dot"></span><span class="lock-dot"></span>
        </div>
        <p class="lock-error" id="lock-error" aria-live="polite"></p>

        <div class="lock-pad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => `<button type="button" class="lock-key" data-key="${d}">${d}</button>`).join('')}
          <span></span>
          <button type="button" class="lock-key" data-key="0">0</button>
          <button type="button" class="lock-key lock-back" data-key="back" aria-label="Apagar">⌫</button>
        </div>

        ${!isSetup ? `<button type="button" class="lock-switch" id="lock-switch">${canSwitch ? 'Trocar de utilizador' : `Não é ${esc(this.name) || 'esta pessoa'}? Trocar`}</button>` : ''}
      </div>
    `;
  }

  bindEvents() {
    if (!this.overlay) return;

    if (this.selectingUser) {
      this.overlay.querySelectorAll('.lock-user-tile').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uid = btn.dataset.userId;
          const u = getUserById(uid);
          if (u) {
            this.selectedUserId = u.id;
            this.name = u.name;
          }
          this.selectingUser = false;
          this.open();
        });
      });

      const backBtn = this.overlay.querySelector('#lock-back-pin');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          this.selectingUser = false;
          this.open();
        });
      }
      return;
    }

    this.overlay.querySelectorAll('.lock-key').forEach((btn) => {
      btn.addEventListener('click', () => this.press(btn.dataset.key));
    });
    const swap = this.overlay.querySelector('#lock-switch');
    if (swap) {
      swap.addEventListener('click', () => {
        const users = getUsers();
        if (users.length > 1) {
          this.selectingUser = true;
          this.open();
        } else {
          clearProfile();
          this.mode = 'setup';
          this.name = '';
          this.selectedUserId = null;
          this.open();
        }
      });
    }
  }

  paintDots() {
    if (!this.overlay) return;
    const dots = this.overlay.querySelectorAll('.lock-dot');
    dots.forEach((d, i) => d.classList.toggle('filled', i < this.entered.length));
  }

  fail(msg) {
    haptics.warning();
    const err = this.overlay ? this.overlay.querySelector('#lock-error') : null;
    if (err) err.textContent = msg;
    this.entered = '';
    this.paintDots();
    this.busy = false;
  }

  async press(key) {
    if (this.busy || !this.overlay) return;
    if (key === 'back') {
      this.entered = this.entered.slice(0, -1);
      this.paintDots();
      return;
    }
    if (this.entered.length >= 4) return;
    this.entered += key;
    haptics.tap();
    this.paintDots();
    if (this.entered.length < 4) return;

    const pin = this.entered;
    this.entered = '';
    this.paintDots();

    if (this.mode === 'unlock') {
      this.busy = true;
      const ok = this.selectedUserId
        ? await verifyUserPin(this.selectedUserId, pin)
        : await verifyPin(pin);
      if (ok) {
        if (this.selectedUserId) {
          setCurrentUser(this.selectedUserId);
        }
        haptics.success();
        this.finish();
      } else {
        this.fail('PIN errado. Tente de novo.');
      }
      return;
    }

    // setup: primeira e segunda volta.
    if (!this.expectingConfirm) {
      if (!isValidPin(pin)) {
        this.fail('O PIN são 4 dígitos.');
        return;
      }
      this.firstPin = pin;
      this.expectingConfirm = true;
      const label = this.overlay.querySelector('#lock-pin-label');
      if (label) label.textContent = 'Repita o PIN para confirmar';
      haptics.tap();
      return;
    }

    if (pin !== this.firstPin) {
      this.firstPin = '';
      this.expectingConfirm = false;
      const label = this.overlay.querySelector('#lock-pin-label');
      if (label) label.textContent = 'Escolha um PIN de 4 dígitos';
      this.fail('Não coincidem. Escolha de novo.');
      return;
    }

    this.busy = true;
    try {
      const nameInput = this.overlay.querySelector('#lock-name');
      const name = (nameInput && nameInput.value ? nameInput.value : this.name).trim();
      if (!name) {
        this.busy = false;
        this.fail('Escreva o nome do técnico.');
        return;
      }
      await setupProfile(name, pin);
      haptics.success();
      toast.success(`Bem-vindo, ${name}.`);
      this.finish();
    } catch (err) {
      this.fail(err && err.message ? err.message : 'Não foi possível guardar.');
    }
  }

  finish() {
    const cb = this.onDone;
    this.close();
    if (typeof cb === 'function') cb();
  }

  close() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  destroy() {
    this.close();
  }
}
