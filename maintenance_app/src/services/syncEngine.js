import { db } from '../db/db.js';
import { toast } from '../ui/toast.js';

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = [];
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
      try { cb(status, details); } catch (e) { console.error('[SyncEngine] Listener error:', e); }
    });
  }

  /**
   * Inicializa os listeners de rede e o timer periódico de sincronização
   */
  init() {
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Rede restabelecida. A iniciar sincronização...');
      this.sync({ showToast: true });
    });

    window.addEventListener('offline', () => {
      console.log('[SyncEngine] Dispositivo offline.');
      this.notify('offline');
    });

    // Sincronização periódica a cada 30 segundos (se online)
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync({ background: true });
      }
    }, 30000);

    // Tentar primeira sincronização 2 segundos após arranque
    setTimeout(() => {
      if (navigator.onLine) {
        this.sync({ background: true });
      }
    }, 2000);
  }

  /**
   * Executa uma ronda completa de Push e Pull de sincronização
   */
  async sync(options = {}) {
    if (!navigator.onLine) {
      this.notify('offline');
      return { success: false, reason: 'offline' };
    }

    if (this.isSyncing) return { success: false, reason: 'already_syncing' };

    this.isSyncing = true;
    this.notify('syncing');

    try {
      // ----------------------------------------
      // 1. PUSH: Drenar a fila local (sync_queue)
      // ----------------------------------------
      const queueItems = await db.sync_queue.toArray();
      let pushedCount = 0;

      if (queueItems.length > 0) {
        // Enviar mutações para a API
        const pushRes = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mutations: queueItems })
        });

        if (pushRes.ok) {
          const pushData = await pushRes.json();
          const processedIds = pushData.processedIds || [];

          // Remover itens processados da fila local
          if (processedIds.length > 0) {
            await db.sync_queue.bulkDelete(queueItems.map(q => q.id));
            pushedCount = processedIds.length;
          }
        } else if (pushRes.status !== 503) {
          // 503 significa que a BD não está configurada no servidor, ignora erro fatal
          console.warn('[SyncEngine] Push falhou com status:', pushRes.status);
        }
      }

      // ----------------------------------------
      // 2. PULL: Obter novidades da Cloud
      // ----------------------------------------
      const lastSync = localStorage.getItem('last_sync_timestamp') || '0';
      const pullRes = await fetch(`/api/sync/pull?since=${encodeURIComponent(lastSync)}`);

      let pulledCount = 0;

      if (pullRes.ok) {
        const pullData = await pullRes.json();

        // 1. Relatórios / Avarias
        if (Array.isArray(pullData.reports) && pullData.reports.length > 0) {
          for (const rep of pullData.reports) {
            await db.reports.put(rep);
          }
          pulledCount += pullData.reports.length;
        }

        // 2. Tarefas
        if (Array.isArray(pullData.tasks) && pullData.tasks.length > 0) {
          for (const t of pullData.tasks) {
            await db.tasks.put(t);
          }
          pulledCount += pullData.tasks.length;
        }

        // 3. Notas
        if (Array.isArray(pullData.notes) && pullData.notes.length > 0) {
          for (const n of pullData.notes) {
            await db.notes.put(n);
          }
          pulledCount += pullData.notes.length;
        }

        // 4. Ferramentas
        if (Array.isArray(pullData.tools) && pullData.tools.length > 0) {
          for (const tl of pullData.tools) {
            await db.tools.put(tl);
          }
          pulledCount += pullData.tools.length;
        }

        // 5. Equipamentos
        if (Array.isArray(pullData.equipment) && pullData.equipment.length > 0) {
          for (const eq of pullData.equipment) {
            await db.equipment.put(eq);
          }
          pulledCount += pullData.equipment.length;
        }

        // 6. Localizações
        if (Array.isArray(pullData.locations) && pullData.locations.length > 0) {
          for (const loc of pullData.locations) {
            await db.locations.put(loc);
          }
          pulledCount += pullData.locations.length;
        }

        if (pullData.timestamp) {
          localStorage.setItem('last_sync_timestamp', String(pullData.timestamp));
        }
      }

      this.notify('synced', { pushedCount, pulledCount });

      if (options.showToast && (pushedCount > 0 || pulledCount > 0)) {
        if (window.toast) {
          toast.success(`Sincronizado: ${pushedCount} enviados, ${pulledCount} recebidos.`);
        }
      }

      return { success: true, pushedCount, pulledCount };
    } catch (err) {
      console.error('[SyncEngine] Erro durante a sincronização:', err);
      this.notify('error', { error: err.message });
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
