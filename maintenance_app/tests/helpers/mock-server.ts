import { Page, Route } from '@playwright/test';

/**
 * MockSyncServer — intercepts the REAL sync API used by the app
 * (src/services/syncEngine.js) instead of the old /api/v1/* routes.
 *
 * Endpoints:
 *   GET  /api/health            -> { status: 'ok' }        (health probe)
 *   POST /api/sync/push         -> { mutations }  -> { success, processedCount,
 *                                                       processedIds, processedTimes,
 *                                                       unprocessedCount, unprocessedIds }
 *   GET  /api/sync/pull?since=..-> { timestamp, cursors, hasMore,
 *                                                       reports, tasks, notes, tools,
 *                                                       equipment, doors, locations, materials }
 *
 * Rules of the game with the engine:
 *   - processedIds are the sync_queue item ids (the `id` of each mutation), NOT entity ids.
 *   - processedTimes maps mutation id -> fresh ISO server timestamp (used to anchor the
 *     local row's updatedAt and stop the pull from resending the row forever).
 *   - Every response MUST be application/json (the engine refuses non-JSON responses).
 */

export interface RemoteReport {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  sectorCode?: string;
  priority: string;
  status: string;
  description: string;
  timeSpent: number;
  photos: Array<{ id?: string; type?: string; mimeType?: string; url?: string }>;
  materials?: string;
  author?: string;
  resolutionNotes?: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: number;
  deleted: number;
  [key: string]: any;
}

export interface RemoteLocation {
  id: string;
  name: string;
  description?: string;
  isCustom: boolean;
  createdAt: string;
  updatedAt?: string;
  synced: number;
  deleted: number;
  [key: string]: any;
}

const TYPE_TO_TABLE: Record<string, string> = {
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

const PULL_TABLES = ['reports', 'tasks', 'notes', 'tools', 'equipment', 'doors', 'locations', 'materials'];

const BASE_TS = '1970-01-01T00:00:00.000Z';

function maxTs(rows: any[]): string {
  let max = '';
  for (const r of rows) {
    const t = r && (r.updatedAt || r.createdAt);
    if (typeof t === 'string' && t > max) max = t;
  }
  return max || BASE_TS;
}

export class MockSyncServer {
  private tables: Record<string, any[]> = {
    reports: [], tasks: [], notes: [], tools: [], equipment: [], doors: [],
    locations: [], materials: [], tool_moves: []
  };

  /**
   * Set up Playwright route interception for the real sync endpoints.
   */
  async setup(page: Page): Promise<void> {
    // No service worker in tests: it would serve cached assets and confuse
    // route interception / offline mode. Abort registration.
    await page.route('**/sw.js', (route: Route) => route.abort().catch(() => undefined));

    await page.route('**/api/health', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', db: true, at: new Date().toISOString() })
      });
    });

    await page.route('**/api/sync/push', async (route: Route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }

      let mutations: any[] = [];
      try {
        const body = JSON.parse(request.postData() || '{}');
        if (Array.isArray(body.mutations)) mutations = body.mutations;
      } catch { /* corpo ilegível — nada é processado */ }

      const now = new Date().toISOString();
      const processedIds: string[] = [];
      const unprocessedIds: string[] = [];
      const processedTimes: Record<string, string> = {};

      for (const m of mutations) {
        if (!m || typeof m !== 'object') continue;
        const mutationId = String(m.id == null ? '' : m.id);
        if (!mutationId) { unprocessedIds.push(String(m?.id)); continue; }
        const tableName = TYPE_TO_TABLE[m.entityType];
        if (!tableName || !this.tables[tableName]) {
          unprocessedIds.push(mutationId);
          continue;
        }
        this.applyMutation(tableName, m, now);
        processedIds.push(mutationId);
        processedTimes[mutationId] = now;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          processedCount: processedIds.length,
          processedIds,
          processedTimes,
          unprocessedCount: unprocessedIds.length,
          unprocessedIds
        })
      });
    });

    await page.route(/\/api\/sync\/pull(\?.*)?$/, async (route: Route) => {
      const url = new URL(route.request().url());
      let since: Record<string, any> = {};
      const raw = url.searchParams.get('since') || '';
      if (raw) {
        try { since = JSON.parse(raw); } catch { since = {}; }
      }

      const out: Record<string, any[]> = {};
      const cursors: Record<string, { ts: string; id: string }> = {};

      for (const t of PULL_TABLES) {
        const prevTs = (since[t] && typeof since[t] === 'object' && typeof since[t].ts === 'string') ? since[t].ts : BASE_TS;
        const rows = (this.tables[t] || [])
          .filter((r) => r && r.deleted !== 1)
          .filter((r) => {
            const rowTs = r.updatedAt || r.createdAt || BASE_TS;
            return String(rowTs) > String(prevTs);
          });
        out[t] = rows;
        cursors[t] = { ts: rows.length ? maxTs(rows) : prevTs, id: '' };
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          hasMore: false,
          cursors,
          reports: out.reports || [],
          tasks: out.tasks || [],
          notes: out.notes || [],
          tools: out.tools || [],
          equipment: out.equipment || [],
          doors: out.doors || [],
          locations: out.locations || [],
          materials: out.materials || []
        })
      });
    });
  }

  private applyMutation(tableName: string, mutation: any, now: string): void {
    const payload = mutation.payload && typeof mutation.payload === 'object' ? mutation.payload : {};
    const entityId = mutation.entityId != null && mutation.entityId !== ''
      ? String(mutation.entityId)
      : (payload.id != null ? String(payload.id) : null);
    if (!entityId) return;

    const list = this.tables[tableName];
    if (!list) return;
    const idx = list.findIndex((r) => r && r.id === entityId);

    if (mutation.action === 'DELETE') {
      if (tableName === 'tool_moves') {
        if (idx >= 0) list.splice(idx, 1);
      } else if (idx >= 0) {
        list[idx] = { ...list[idx], deleted: 1, updatedAt: now };
      }
      return;
    }

    const row = {
      ...payload,
      id: entityId,
      createdAt: payload.createdAt || now,
      // O servidor real faz upsert e toca em updated_at = now. É ESSENCIAL
      // manter updatedAt == processedTimes: o syncEngine ancora o registo local
      // ao processedTimes e, se a linha do pull trouxer um updatedAt mais
      // antigo (o payload local), um isIncomingStale() a descarta e o cartão
      // nunca passa a "Sincronizado" (pulledCount fica 0).
      updatedAt: now,
      synced: 1,
      deleted: payload.deleted === undefined ? 0 : payload.deleted
    };

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...row };
    } else {
      list.push(row);
    }
  }

  getRemoteReports(): RemoteReport[] {
    return [...this.tables.reports];
  }

  getRemoteLocations(): RemoteLocation[] {
    return [...this.tables.locations];
  }

  getRemoteTable(name: string): any[] {
    return this.tables[name] ? [...this.tables[name]] : [];
  }

  seedReports(reports: RemoteReport[]): void {
    this.tables.reports = reports.map((r) => ({ ...r, deleted: r.deleted === undefined ? 0 : r.deleted }));
  }

  seedLocations(locations: RemoteLocation[]): void {
    this.tables.locations = locations.map((l) => ({ ...l, deleted: l.deleted === undefined ? 0 : l.deleted }));
  }

  reset(): void {
    this.tables = {
      reports: [], tasks: [], notes: [], tools: [], equipment: [], doors: [],
      locations: [], materials: [], tool_moves: []
    };
  }
}