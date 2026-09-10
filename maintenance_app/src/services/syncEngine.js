import { db } from '../db/db.js';
import { toast } from '../ui/toast.js';

/**
 * As tabelas que guardam um campo `synced`. Depois de o servidor confirmar
 * uma mutação, o registo correspondente é marcado como sincronizado — sem
 * isto, o indicador do cartão dizia "Local" para sempre.
 */
const SYNCED_TABLES = {
  report: 'reports',
  reports: 'reports',
  task: 'tasks',
  tasks: 'tasks',
  note: 'notes',
  notes: 'notes',
  tool: 'tools',
  tools: 'tools',
  tool_move: 'tool_moves',
  tool_moves: 'tool_moves',
  material: 'materials',
  materials: 'materials',
  equipment: 'equipment',
  door: 'doors',
  doors: 'doors',
  location: 'locations',
  locations: 'locations'
};

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
// Lotes de push pequenos: uma fila de meses (fotos incluídas) não vai num
// POST só — e o servidor recusa lotes acima de 500. 100 dá folga e anda.
const PUSH_CHUNK_SIZE = 100;
// Trava de segurança do loop de pull: 50 lotes × 1000 linhas chegam para
// qualquer base real; sem a trava, um hasMore encravado fazia loop eterno.
const PULL_MAX_BATCHES = 50;

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
   * Ligado por defeito: vários técnicos usam esta app e têm de ver o
   * trabalho uns dos outros, por isso a sincronização não pode depender de
   * um passo manual que ninguém vai fazer. Se o servidor não tiver base de
   * dados configurada, o pedido falha em segurança (ver server.js) e os
   * dados ficam guardados no telemóvel na mesma — nada se perde.
   * Desativar só para testes: localStorage.setItem('sync.backend.enabled', '0')
   * ou VITE_SYNC_ENABLED=false no build.
   */
  isBackendConfigured() {
    try {
      const stored = localStorage.getItem('sync.backend.enabled');
      if (stored === '0') return false;
      if (stored === '1') return true;
    } catch { /* localStorage bloqueado — segue para o valor por defeito */ }
    try {
      const env = import.meta.env || {};
      if (String(env.VITE_SYNC_ENABLED) === 'false') return false;
    } catch { /* sem import.meta.env */ }
    return true;
  }

  /** Quantas mutações estão à espera de subir. Informação honesta, não erro. */
  async pendingCount() {
    try { return await db.sync_queue.count(); } catch { return 0; }
  }

  /**
   * Estado da fila para as Definições: quantas faltam, há quanto tempo está
   * a mais antiga à espera, e quando foi a última sincronização recebida.
   * É isto que distingue "offline há 1h" de "backend em baixo há 3 semanas".
   */
  async pendingInfo() {
    const info = { pending: 0, oldest: 0, lastSync: 0 };
    try {
      info.pending = await db.sync_queue.count();
      try {
        const first = await db.sync_queue.orderBy('timestamp').first();
        if (first && first.timestamp) info.oldest = Number(first.timestamp) || 0;
      } catch { /* fila ilegível — conta já diz o essencial */ }
    } catch { return info; }
    try {
      const raw = localStorage.getItem('last_sync_timestamp') || '';
      let t = Number(raw);
      if (!Number.isFinite(t) || t <= 0) t = Date.parse(raw) || 0;
      info.lastSync = t;
    } catch { /* sem relógio guardado */ }
    return info;
  }

  /**
   * Token da API de sync: do build (VITE_SYNC_TOKEN, igual em todos os
   * telemóveis do estádio) ou por aparelho (localStorage 'sync.token',
   * posto uma vez pelo responsável). Vazio = servidor sem SYNC_TOKEN.
   */
  authToken() {
    try {
      const env = import.meta.env || {};
      if (env.VITE_SYNC_TOKEN) return String(env.VITE_SYNC_TOKEN);
    } catch { /* sem import.meta.env */ }
    try {
      return localStorage.getItem('sync.token') || '';
    } catch { return ''; }
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

  /**
   * Apaga da fila só os itens que o servidor confirmou (por id), depois de
   * os marcar como sincronizados nas tabelas — tudo NUMA transação Dexie.
   * Antes eram dois passos separados: uma queda no meio deixava registos
   * marcados sem fila (mutação perdida sem erro visível). Devolve quantos.
   * Um item que falhe a marcar fica na fila; o push é idempotente no
   * servidor (upserts + client_ref), por isso repetir é seguro.
   */
  async markConfirmed(queueItems, confirmedIds) {
    const confirmedSet = new Set((confirmedIds || []).map(String));
    const confirmedItems = (queueItems || []).filter(q => confirmedSet.has(String(q.id)));
    if (!confirmedItems.length) return 0;
    // Tabelas deste lote (whitelist fixa, nunca nomes do pedido).
    const tableNames = [...new Set(
      confirmedItems.map(i => SYNCED_TABLES[i.entityType]).filter(t => t && db[t])
    )];
    const tables = [db.sync_queue, ...tableNames.map(t => db[t])];
    let deleted = 0;
    await db.transaction('rw', tables, async () => {
      const okIds = [];
      for (const item of confirmedItems) {
        const tableName = SYNCED_TABLES[item.entityType];
        // Sem tabela para marcar, o confirmado sai na mesma da fila: o
        // servidor já o tem e repeti-lo seria lixo eterno.
        if (!tableName || !db[tableName] || !item.entityId) { okIds.push(item.id); continue; }
        // tool_moves usa chave numérica (++id Dexie); o entityId viaja
        // como string na fila e falhava em silêncio sem esta conversão.
        let markKey = item.entityId;
        if (tableName === 'tool_moves') {
          markKey = Number(item.entityId);
          if (!Number.isInteger(markKey)) { okIds.push(item.id); continue; }
        }
        try {
          await db[tableName].update(markKey, { synced: 1 });
          okIds.push(item.id);
        } catch (err) {
          // Fica na fila para a próxima volta; o push é idempotente.
          console.info('[SyncEngine] Não foi possível marcar como sincronizado:', item.entityId);
        }
      }
      if (okIds.length) {
        await db.sync_queue.bulkDelete(okIds);
        deleted = okIds.length;
      }
    });
    return deleted;
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
    // O token viaja em todos os pedidos de sync (o health ignora-o).
    let finalInit = init;
    try {
      const token = this.authToken();
      if (token && typeof url === 'string' && url.includes('/api/sync/')) {
        finalInit = { ...(init || {}), headers: { ...((init && init.headers) || {}), Authorization: `Bearer ${token}` } };
      }
    } catch { finalInit = init; }
    try {
      res = await fetch(url, finalInit);
    } catch (err) {
      // Rede em baixo, servidor em baixo, proxy sem destino. Tudo o mesmo caso.
      return { ok: false, unavailable: true, reason: err && err.name === 'AbortError' ? 'tempo esgotado' : 'sem ligação' };
    }

    // Um 404 não é uma falha de programação, é um servidor que não está lá.
    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[SyncEngine] Sync recusado (401): falta o token ou está errado. A app continua a gravar localmente.');
      }
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
      // 1. PUSH: drenar a fila local (sync_queue), em lotes pequenos
      // ----------------------------------------
      const queueItems = await db.sync_queue.toArray();

      if (queueItems.length > 0) {
        const confirmedIds = [];
        let pushFailed = false;

        for (let i = 0; i < queueItems.length && !pushFailed; i += PUSH_CHUNK_SIZE) {
          const chunk = queueItems.slice(i, i + PUSH_CHUNK_SIZE);
          const push = await this.request(API_PUSH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mutations: chunk })
          });

          if (!push.ok) {
            // A FILA FICA INTACTA (incluindo lotes já confirmados? não: os
            // confirmados abaixo são apagados; os por enviar ficam).
            pushFailed = true;
            break;
          }

          const confirmed = Array.isArray(push.data?.processedIds) ? push.data.processedIds : [];
          for (const id of confirmed) confirmedIds.push(id);
        }

        if (pushFailed) {
          // Apaga só o que foi confirmado antes da falha; o resto fica.
          if (confirmedIds.length > 0) {
            await this.markConfirmed(queueItems, confirmedIds);
            pushedCount = confirmedIds.length;
          }
          this.markUnavailable('push_failed');
          const pending = await this.pendingCount();
          this.notify('idle', { reason: 'backend-unavailable', pending });
          return { success: false, reason: 'push_failed', pending };
        }

        // Só se apaga o que o servidor CONFIRMOU ter processado, item a item.
        pushedCount = await this.markConfirmed(queueItems, confirmedIds);

        if (pushedCount < queueItems.length) {
          console.info(
            `[SyncEngine] ${queueItems.length - pushedCount} mutações ficaram na fila ` +
            `por não terem sido confirmadas pelo servidor.`
          );
        }
      }

      // ----------------------------------------
      // 2. PULL: obter novidades, em lotes com cursor
      // ----------------------------------------
      let cursor = (() => {
        try { return localStorage.getItem('last_sync_timestamp') || '0'; } catch { return '0'; }
      })();

      const tables = [
        ['reports', db.reports],
        ['tasks', db.tasks],
        ['notes', db.notes],
        ['tools', db.tools],
        ['equipment', db.equipment],
        ['doors', db.doors],
        ['locations', db.locations],
        // materials viaja nos dois sentidos; tool_moves é só subida
        // (os ids locais ++id colidiriam com os SERIAL do servidor).
        ['materials', db.materials]
      ];

      let batches = 0;
      let more = true;
      let pullFailed = false;
      while (more && !pullFailed && batches < PULL_MAX_BATCHES) {
        batches += 1;
        const pull = await this.request(`${API_PULL}?since=${encodeURIComponent(cursor)}`, { method: 'GET' });

        if (!pull.ok) {
          pullFailed = true;
          break;
        }

        const data = pull.data || {};
        let batchRows = 0;
        try {
          for (const [key, table] of tables) {
            const rows = data[key];
            if (!Array.isArray(rows) || rows.length === 0 || !table) continue;
            for (const row of rows) {
              await table.put(row);
            }
            pulledCount += rows.length;
            batchRows += rows.length;
          }
        } catch (putErr) {
          // Telemóvel cheio a meio do pull: o push já foi, os lotes
          // anteriores avançaram o cursor. Parar aqui é honesto — tentar de
          // novo só ia falhar igual. O técnico tem de libertar espaço.
          if (putErr && (putErr.name === 'QuotaExceededError' || /quota/i.test(putErr.message || ''))) {
            pullFailed = 'quota';
            break;
          }
          throw putErr;
        }

        // O cursor avança por lote e é gravado já: se a app cair a meio de
        // um pull longo, o próximo continua daqui em vez de recomeçar.
        if (data.timestamp) {
          cursor = String(data.timestamp);
          try { localStorage.setItem('last_sync_timestamp', cursor); } catch { /* ignorar */ }
        }
        more = !!data.hasMore && batchRows > 0;
      }

      if (pullFailed) {
        if (pullFailed === 'quota') {
          if (window.toast) window.toast.warning('Armazenamento do telemóvel cheio: recebidas ' + pulledCount + ', em falta espaço para o resto. Apague fotos antigas.');
          else console.warn('[SyncEngine] Armazenamento cheio a meio do pull.');
        } else {
          this.markUnavailable('pull_failed');
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
