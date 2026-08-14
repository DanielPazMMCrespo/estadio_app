import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EstadioMaintenanceDB,
  normalizePhotoItemSync,
  normalizePhotoItemAsync,
  normalizePhotosAsync,
  getPhotoBlob,
  getPhotoDataUrl,
  getPhotoArrayBuffer
} from '../../src/db/db.js';
import fs from 'fs';
import path from 'path';

describe('Challenger 2 (m1_4) — Empirical Service Worker & Storage Stress Test Suite', () => {
  let db;

  beforeEach(async () => {
    const dbName = `challenger_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await db.delete();
      await db.close();
    }
  });

  describe('Part 1: Service Worker (public/sw.js) Verification & Event Simulation', () => {
    const swPath = path.resolve('public/sw.js');

    it('verifies public/sw.js exists and has correct cache name and static assets', () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const content = fs.readFileSync(swPath, 'utf8');

      expect(content).toContain("CACHE_NAME = 'estadio-shell-v1'");
      expect(content).toContain("'/index.html'");
      expect(content).toContain("'/manifest.webmanifest'");
      expect(content).toContain("'/favicon.ico'");
      expect(content).toContain("'/icons/icon-192.png'");
      expect(content).toContain("'/icons/icon-512.png'");
    });

    it('simulates SW install event with Promise.allSettled asset precaching resilience', async () => {
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toMatch(/addEventListener\(['"]install['"]/);
      expect(swContent).toContain('Promise.allSettled');
      expect(swContent).toContain('self.skipWaiting()');

      // Mock Cache Storage API
      const storedMap = new Map();
      const mockCache = {
        put: vi.fn(async (request, response) => {
          storedMap.set(typeof request === 'string' ? request : request.url, response);
        })
      };

      const mockCaches = {
        open: vi.fn(async () => mockCache)
      };

      // Mock fetch that fails for one specific asset
      const mockFetch = vi.fn(async (url) => {
        if (url === '/missing-asset.png') {
          return { ok: false, status: 404 };
        }
        return { ok: true, status: 200, clone: () => ({ ok: true, status: 200 }) };
      });

      const assetsToPrecache = ['/', '/index.html', '/missing-asset.png', '/favicon.ico'];
      await Promise.allSettled(
        assetsToPrecache.map(async (asset) => {
          try {
            const res = await mockFetch(asset);
            if (res.ok) {
              const cache = await mockCaches.open('estadio-shell-v1');
              await cache.put(asset, res);
            }
          } catch (e) {
            // handle error
          }
        })
      );

      expect(storedMap.size).toBe(3);
      expect(storedMap.has('/')).toBe(true);
      expect(storedMap.has('/missing-asset.png')).toBe(false);
    });

    it('simulates SW activate event cache cleanup for obsolete caches', async () => {
      const existingCaches = new Map([
        ['estadio-shell-v1', {}],
        ['estadio-shell-v0', {}],
        ['legacy-cache-2025', {}]
      ]);

      const deletedCaches = [];
      const mockCaches = {
        keys: vi.fn(async () => Array.from(existingCaches.keys())),
        delete: vi.fn(async (name) => {
          deletedCaches.push(name);
          existingCaches.delete(name);
          return true;
        })
      };

      const currentCacheName = 'estadio-shell-v1';
      const cacheNames = await mockCaches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== currentCacheName) {
            return mockCaches.delete(cacheName);
          }
        })
      );

      expect(deletedCaches).toEqual(['estadio-shell-v0', 'legacy-cache-2025']);
      expect(existingCaches.has('estadio-shell-v1')).toBe(true);
    });

    it('simulates SW fetch event SWR behavior and navigation fallback', async () => {
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toMatch(/addEventListener\(['"]fetch['"]/);
      expect(swContent).toContain("event.request.method !== 'GET'");
      expect(swContent).toContain("!url.protocol.startsWith('http')");
      expect(swContent).toContain("event.request.mode === 'navigate'");
      expect(swContent).toContain("'/index.html'");

      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/reports/new',
        mode: 'navigate'
      };

      const mockCacheMap = new Map([
        ['/index.html', { status: 200, body: '<html>App Shell</html>' }],
        ['http://localhost/index.html', { status: 200, body: '<html>App Shell</html>' }]
      ]);

      const cacheMatch = async (req) => {
        const key = typeof req === 'string' ? req : req.url;
        return mockCacheMap.get(key) || null;
      };

      const networkFetch = vi.fn(async () => {
        throw new Error('Failed to fetch (offline)');
      });

      let response;
      const cached = await cacheMatch(mockRequest);
      if (cached) {
        response = cached;
      } else {
        try {
          response = await networkFetch();
        } catch (err) {
          if (mockRequest.mode === 'navigate' && !cached) {
            response = (await cacheMatch('/index.html')) || (await cacheMatch('/'));
          }
        }
      }

      expect(response).toBeDefined();
      expect(response.body).toBe('<html>App Shell</html>');
    });
  });

  describe('Part 2: Dexie DB Schema & Photo/UTF-8 Stress Testing', () => {
    it('handles high volume bulk operations: 1000 reports, 500 locations, 1000 queue items', async () => {
      const startTime = Date.now();

      // 1. Bulk reports
      const reports = [];
      for (let i = 0; i < 1000; i++) {
        reports.push({
          id: `rep-bulk-${i}`,
          date: new Date(1770000000000 + i * 1000).toISOString(),
          locationId: `LOC_${i % 10}`,
          locationName: `Localização ${i % 10} — Estádio Municipal`,
          description: `Relatório de manutenção #${i} (Substituição de lâmpadas & pintura)`,
          timeSpentMinutes: 15 + (i % 120),
          photos: [],
          materials: i % 2 === 0 ? 'Tinta azul, Escada' : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: i % 2 === 0 ? 0 : 1, // i % 2 === 0 -> unsynced (500 unsynced)
          deleted: i % 20 === 0 ? 1 : 0 // i % 20 === 0 -> deleted (50 deleted, all are even -> unsynced)
        });
      }
      await db.reports.bulkAdd(reports);

      // 2. Bulk locations
      const locations = [];
      for (let i = 0; i < 500; i++) {
        locations.push({
          id: `LOC_${i}`,
          name: `Zona de Manutenção ${i} — Leiria`,
          description: `Descrição detalhada da zona ${i}`,
          isCustom: i >= 50 ? 1 : 0,
          createdAt: new Date().toISOString(),
          synced: i % 3 === 0 ? 1 : 0
        });
      }
      await db.locations.bulkAdd(locations);

      // 3. Bulk sync_queue
      const syncItems = [];
      for (let i = 0; i < 1000; i++) {
        syncItems.push({
          entityType: i % 2 === 0 ? 'report' : 'location',
          entityId: i % 2 === 0 ? `rep-bulk-${i}` : `LOC_${i % 500}`,
          action: i % 3 === 0 ? 'CREATE' : (i % 3 === 1 ? 'UPDATE' : 'DELETE'),
          payload: { id: i },
          timestamp: Date.now() + i,
          retryCount: i % 5
        });
      }
      await db.sync_queue.bulkAdd(syncItems);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(10000); // completed within 10s

      // Verify counts
      expect(await db.reports.count()).toBe(1000);
      expect(await db.locations.count()).toBe(500);
      expect(await db.sync_queue.count()).toBe(1000);

      // Indexed queries
      const activeUnsyncedReports = await db.reports
        .where('synced').equals(0)
        .filter(r => r.deleted === 0)
        .toArray();
      expect(activeUnsyncedReports.length).toBe(450); // 500 unsynced minus 50 deleted unsynced

      const customLocations = await db.locations.where('isCustom').equals(1).toArray();
      expect(customLocations.length).toBe(450);

      const reportSyncQueue = await db.sync_queue.where('entityType').equals('report').toArray();
      expect(reportSyncQueue.length).toBe(500);
    });

    it('handles Portuguese UTF-8 strings with accents, diacritics, special symbols, and emojis', async () => {
      const portugueseReport = {
        id: 'rep-pt-utf8',
        date: '2026-08-11T16:00:00Z',
        locationId: 'LOC_BALNEARIOS',
        locationName: 'Balneários dos Árbitros & Baliza Norte — Estádio Municipal de Leiria',
        description: 'Ação de manutenção preventiva, reparação das instalações elétricas, substituição de lâmpadas LED, desinfeção dos chuveiros e verificação da pressão de água. ⚽🚿⚡🔧 (Tudo concluído sem complicações!)',
        timeSpentMinutes: 105,
        photos: [],
        materials: 'Detergente industrial, Chave de fendas, Lâmpadas 20W, Fita isoladora',
        createdAt: '2026-08-11T16:00:00Z',
        updatedAt: '2026-08-11T16:00:00Z',
        synced: 0,
        deleted: 0
      };

      await db.reports.add(portugueseReport);

      const fetched = await db.reports.get('rep-pt-utf8');
      expect(fetched).toBeDefined();
      expect(fetched.locationName).toBe('Balneários dos Árbitros & Baliza Norte — Estádio Municipal de Leiria');
      expect(fetched.locationName).toContain('Árbitros');
      expect(fetched.description).toContain('instalações elétricas');
      expect(fetched.description).toContain('⚽🚿⚡🔧');
      expect(fetched.materials).toContain('Fita isoladora');

      // Query by indexed locationName
      const queried = await db.reports.where('locationName').equals('Balneários dos Árbitros & Baliza Norte — Estádio Municipal de Leiria').toArray();
      expect(queried.length).toBe(1);
    });

    it('thoroughly tests photo storage normalization and extraction helpers', async () => {
      // 1. Base64 DataURL
      const validDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
      const photo1 = { id: 'p1', blobData: validDataUrl, type: 'before', mimeType: 'image/jpeg', createdAt: '2026-08-11' };

      // 2. Uint8Array
      const uint8 = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic header
      const photo2 = { id: 'p2', blobData: uint8, type: 'work', mimeType: 'image/png', createdAt: '2026-08-11' };

      // 3. ArrayBuffer
      const ab = new Uint8Array([255, 216, 255, 224]).buffer;
      const photo3 = { id: 'p3', blobData: ab, type: 'after', mimeType: 'image/jpeg', createdAt: '2026-08-11' };

      // 4. Native Blob
      const blob = new Blob(['sample-binary-content'], { type: 'image/jpeg' });
      const photo4 = { id: 'p4', blobData: blob, type: 'work', createdAt: '2026-08-11' };

      // Normalize synchronously
      const norm1 = normalizePhotoItemSync(photo1);
      const norm2 = normalizePhotoItemSync(photo2);
      const norm3 = normalizePhotoItemSync(photo3);
      const norm4 = normalizePhotoItemSync(photo4);

      expect(norm1.mimeType).toBe('image/jpeg');
      expect(norm2.blobData).toBeInstanceOf(Uint8Array);
      expect(norm3.blobData).toBeInstanceOf(Uint8Array);

      // Normalize asynchronously
      const asyncNormPhotos = await normalizePhotosAsync([photo1, photo2, photo3, photo4]);
      expect(asyncNormPhotos).toHaveLength(4);
      expect(asyncNormPhotos[3].blobData).toBeInstanceOf(Uint8Array); // Blob converted to Uint8Array for IDB clone stability

      // Store in Dexie DB via table hook
      const report = {
        id: 'rep-photo-stress',
        date: '2026-08-11T12:00:00Z',
        locationId: 'LOC_1',
        locationName: 'Loc 1',
        description: 'Photo test',
        timeSpentMinutes: 30,
        photos: [photo1, photo2, photo3, photo4],
        createdAt: '2026-08-11T12:00:00Z',
        updatedAt: '2026-08-11T12:00:00Z',
        synced: 0,
        deleted: 0
      };

      await db.reports.add(report);

      const fetchedReport = await db.reports.get('rep-photo-stress');
      expect(fetchedReport.photos).toHaveLength(4);

      // Test getPhotoDataUrl
      expect(getPhotoDataUrl(fetchedReport.photos[0])).toContain('data:image/jpeg;base64');
      expect(getPhotoDataUrl(fetchedReport.photos[1])).toContain('data:image/png;base64');

      // Test getPhotoBlob
      const extractedBlob1 = getPhotoBlob(fetchedReport.photos[0]);
      expect(extractedBlob1).toBeInstanceOf(Blob);
      expect(extractedBlob1.type).toBe('image/jpeg');

      const extractedBlob2 = getPhotoBlob(fetchedReport.photos[1]);
      expect(extractedBlob2).toBeInstanceOf(Blob);
      expect(extractedBlob2.type).toBe('image/png');

      // Test getPhotoArrayBuffer
      const extractedAb = await getPhotoArrayBuffer(fetchedReport.photos[2]);
      expect(extractedAb.byteLength).toBe(4);
    });

    it('handles edge cases in getPhotoBlob, getPhotoDataUrl, getPhotoArrayBuffer', async () => {
      // Null / undefined inputs
      expect(getPhotoBlob(null)).toBeInstanceOf(Blob);
      expect(getPhotoDataUrl(null)).toBe('');
      expect((await getPhotoArrayBuffer(null)).byteLength).toBe(0);

      // Empty object
      expect(getPhotoBlob({})).toBeInstanceOf(Blob);
      expect(getPhotoDataUrl({})).toBe('');

      // Plain base64 string without data prefix
      const plainBase64Photo = { blobData: 'SGVsbG8gV29ybGQ=', mimeType: 'image/jpeg' };
      expect(getPhotoDataUrl(plainBase64Photo)).toBe('data:image/jpeg;base64,SGVsbG8gV29ybGQ=');
      const blobFromPlainBase64 = getPhotoBlob(plainBase64Photo);
      expect(blobFromPlainBase64.size).toBe(11); // "Hello World" length = 11

      // Array-like object from cloned struct
      const arrayLikePhoto = { blobData: { 0: 65, 1: 66, 2: 67, length: 3 }, mimeType: 'text/plain' };
      const blobFromArrayLike = getPhotoBlob(arrayLikePhoto);
      expect(blobFromArrayLike.size).toBe(3);
      expect(getPhotoDataUrl(arrayLikePhoto)).toContain('data:text/plain;base64');
    });
  });
});
