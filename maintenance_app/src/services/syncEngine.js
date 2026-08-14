import { db } from '../db/db.js';
import { toast } from '../ui/toast.js';

/**
 * Motor de sincronização de uma app OFFLINE-FIRST.
 *
 * Regra de ouro: não haver rede, não haver servidor ou não haver backend
 * configurado é o caso NORMAL, não é uma exceção. Nada disto grita na consola
 * nem chega aos olhos do técnico. O que ele precisa de saber é só quanto é que
 * está à espera de subir — e isso é informação, não erro.
 */

const API_PUSH = '/api/sync/push';
const API_PULL = '/api/sync/pull';
const API_HEALTH = '/api/health';

// Espera crescente entre tentativas depois de o backend não responder.
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
const PERIODIC_MS = 30_000;

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = [];
    // 'unknown' | 'available' | 'unavailable'
    this.backendState = 'unknown';
    this.failureCount = 0;
    this.retryAfter = 0;
  }

  /**
   * Adiciona um callback para ser notificado do estado da sincronização
   * @param {Function} cb - (status: 'idle'|'syncing'|'synced'|'offline'|'error', details) => void
   */
  onStatusChange(cb) {
    if (typeof cb === 'function') {
      this.listeners.push(cb);
    }
  }

  notify(status, details = {}) {
    this.listeners.forEach(cb => {
      try { cb(status, details); } catch (e) { console.warn('[SyncEngine] Listener falhou:', e); }
    });
  }

  /**
   * O backend só é contactado se alguém o tiver configurado.
   * Sem configuração a app é puramente local: zero pedidos, zero ruído.
   * Ativar: localStorage.setItem('sync.backend.enabled', '1')  ou  VITE_SYNC_ENABLED=true
   */
  isBackendConfigured() {
    try {
      if (localStorage.getItem('sync.backend.enabled') === '1') return true;
    } catch { /* localStorage bloqueado — trata como não configurado */ }
    try {
      const env = import.meta.env || {};
      if (String(env.VITE_SYNC_ENABLED) === 'true') return true;
    } catch { /* sem import.meta.env */ }
    return false;
  }

  /** Quantas mutações estão à espera de subir. Informação honesta, não erro. */
  async pendingCount() {
    try { return await db.sync_queue.count(); } catch { return 0; }
  }

  /** Marca o backend como ausente e agenda a próxima tentativa mais para a frente. */
  markUnavailable(reason) {
    this.backendState = 'unavailable';
    const wait = BACKOFF_MS[Math.min(this.failureCount, BACKOFF_MS.length - 1)];
    this.failureCount += 1;
    this.retryAfter = Date.now() + wait;
    console.info(
      `[SyncEngine] Sem backend (${reason}). A app continua a gravar localmente. ` +
      `Nova tentativa dentro de ${Math.round(wait / 1000)}s.`
    );
  }

  markAvailable() {
    this.backendState = 'available';
    this.failureCount = 0;
    this.retryAfter = 0;
  }

  /**
   * Faz um pedido tolerante: nunca lança, nunca faz parse de HTML.
   * Devolve { ok, data } ou { ok: false, unavailable: true, reason }.
   */
  async request(url, init) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      // Rede em baixo, servidor em baixo, proxy sem destino. Tudo o mesmo caso.
      return { ok: false, unavailable: true, reason: err && err.name === 'AbortError' ? 'tempo esgotado' : 'sem ligação' };
    }

    // Um 404 não é uma falha de programação, é um servidor que não está lá.
    if (!res.ok) {
      return { ok: false, unavailable: true, reason: `HTTP ${res.status}` };
    }

    // O Vite (e qualquer SPA fallback) devolve index.html a rotas desconhecidas.
    // Verificar o content-type ANTES de tentar interpretar como JSON.
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('application/json')) {
      return { ok: false, unavailable: true, reason: 'resposta não é JSON' };
    }

    try {
      return { ok: true, data: await res.json() };
    } catch {
      return { ok: false, unavailable: true, reason: 'JSON ilegível' };
    }
  }

  /**
   * Inicializa os listeners de rede e o timer periódico de sincronização
   */
  init() {
    window.addEventListener('online', () => {
      // Voltar a ter rede é um bom momento para esquecer o backoff.
      this.failureCount = 0;
      this.retryAfter = 0;
      this.sync({ background: true });
    });

    window.addEventListener('offline', () => {
      this.notify('offline');
    });

    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync({ background: true });
      }
    }, PERIODIC_MS);

    // Primeira tentativa 2 segundos após arranque
    setTimeout(() => {
      if (navigator.onLine) this.sync({ background: true });
    }, 2000);
  }

  /**
   * Executa uma ronda completa de Push e Pull de sincronização.
   * Nunca lança. Nunca mostra um erro ao técnico.
   */
  async sync(options = {}) {
    const manual = options.showToast === true || options.manual === true;

    if (this.isSyncing) return { success: false, reason: 'already_syncing' };

    if (!navigator.onLine) {
      const pending = await this.pendingCount();
      this.notify('offline', { pending });
      if (manual && window.toast) {
        toast.info(pending > 0
          ? `Sem rede. ${pending} por enviar — está tudo gravado.`
          : 'Sem rede. Está tudo gravado.');
      }
      return { success: false, reason: 'offline', pending };
    }

    // Sem backend configurado: caso normal de uma app local. Não se faz pedido nenhum.
    if (!this.isBackendConfigured()) {
      const pending = await this.pendingCount();
      this.notify('idle', { reason: 'no-backend', pending });
      return { success: false, reason: 'no_backend', pending };
    }

    // Backoff: já falhou há pouco, não se insiste em ciclo.
    if (this.backendState === 'unavailable' && Date.now() < this.retryAfter && !manual) {
      const pending = await this.pendingCount();
      this.notify('idle', { reason: 'backend-unavailable', pending });
      return { success: false, reason: 'backoff', pending };
    }

    this.isSyncing = true;
    this.notify('syncing');

    try {
      // Sonda leve: se o servidor não estiver lá, sai antes de mexer na fila.
      if (this.backendState !== 'available') {
        const health = await this.request(API_HEALTH, { method: 'GET' });
        if (!health.ok) {
          this.markUnavailable(health.reason);
          const pending = await this.pendingCount();
          this.notify('idle', { reason: 'backend-unavailable', pending });
          return { success: false, reason: 'backend_unavailable', pending };
        }
        this.markAvailable();
      }

      let pushedCount = 0;
      let pulledCount = 0;

      // ----------------------------------------
      // 1. PUSH: drenar a fila local (sync_queue)
      // ----------------------------------------
      const queueItems = await db.sync_queue.toArray();

      if (queueItems.length > 0) {
        const push = await this.request(API_PUSH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mutations: queueItems })
        });

        if (!push.ok) {
          // A FILA FICA INTACTA. Perder uma avaria é o pior que podia acontecer.
          this.markUnavailable(push.reason);
          const pending = await this.pendingCount();
          this.notify('idle', { reason: 'backend-unavailable', pending });
          return { success: false, reason: 'push_failed', pending };
        }

        // Só se apaga o que o servidor CONFIRMOU ter processado, item a item.
        const confirmed = Array.isArray(push.data?.processedIds) ? push.data.processedIds : [];
        const confirmedSet = new Set(confirmed.map(String));
        const toDelete = queueItems
          .filter(q => confirmedSet.has(String(q.id)))
          .map(q => q.id);

        if (toDelete.length > 0) {
          await db.sync_queue.bulkDelete(toDelete);
          pushedCount = toDelete.length;
        }

        if (pushedCount < queueItems.length) {
          console.info(
            `[SyncEngine] ${queueItems.length - pushedCount} mutações ficaram na fila ` +
            `por não terem sido confirmadas pelo servidor.`
          );
        }
      }

      // ----------------------------------------
      // 2. PULL: obter novidades
      // ----------------------------------------
      const lastSync = (() => {
        try { return localStorage.getItem('last_sync_timestamp') || '0'; } catch { return '0'; }
      })();

      const pull = await this.request(`${API_PULL}?since=${encodeURIComponent(lastSync)}`, { method: 'GET' });

      if (!pull.ok) {
        this.markUnavailable(pull.reason);
      } else {
        const data = pull.data || {};
        const tables = [
          ['reports', db.reports],
          ['tasks', db.tasks],
          ['notes', db.notes],
          ['tools', db.tools],
          ['equipment', db.equipment],
          ['locations', db.locations]
        ];

        for (const [key, table] of tables) {
          const rows = data[key];
          if (!Array.isArray(rows) || rows.length === 0 || !table) continue;
          for (const row of rows) {
            await table.put(row);
          }
          pulledCount += rows.length;
        }

        if (data.timestamp) {
          try { localStorage.setItem('last_sync_timestamp', String(data.timestamp)); } catch { /* ignorar */ }
        }
      }

      const pending = await this.pendingCount();
      this.notify('synced', { pushedCount, pulledCount, pending });

      if (manual && window.toast && (pushedCount > 0 || pulledCount > 0)) {
        toast.success(`Sincronizado: ${pushedCount} enviados, ${pulledCount} recebidos.`);
      }

      return { success: true, pushedCount, pulledCount, pending };
    } catch (err) {
      // Aqui só chegam bugs a sério (ex.: Dexie a falhar), não a ausência de rede.
      console.warn('[SyncEngine] Sincronização interrompida:', err && err.message ? err.message : err);
      const pending = await this.pendingCount();
      this.notify('idle', { reason: 'interrupted', pending });
      return { success: false, error: err && err.message ? err.message : String(err), pending };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
