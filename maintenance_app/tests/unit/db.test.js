import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EstadioMaintenanceDB,
  normalizePhotosAsync,
  getPhotoBlob,
  getPhotoDataUrl,
  getPhotoArrayBuffer
} from '../../src/db/db.js';

describe('Dexie DB Schema & Storage Engine (EstadioMaintenanceDB)', () => {
  let db;

  beforeEach(async () => {
    // Unique DB instance for each test using custom DB name
    const dbName = `test_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await db.delete();
      await db.close();
    }
  });

  it('should initialize database tables correctly', () => {
    expect(db.tables.map(t => t.name)).toEqual(
      expect.arrayContaining(['reports', 'locations', 'sync_queue'])
    );
  });

  describe('Reports Object Store', () => {
    it('should insert and fetch a report', async () => {
      const sampleReport = {
        id: 'rep-001',
        date: '2026-08-11T14:00:00Z',
        locationId: 'LOC_PITCH',
        locationName: 'Relvado Principal',
        description: 'Corte de relva e marcação de linhas',
        timeSpentMinutes: 90,
        photos: [],
        materials: 'Cortador de relva, Tinta branca',
        createdAt: '2026-08-11T14:00:00Z',
        updatedAt: '2026-08-11T14:00:00Z',
        synced: 0,
        deleted: 0
      };

      await db.reports.add(sampleReport);
      const fetched = await db.reports.get('rep-001');
      expect(fetched).toBeDefined();
      expect(fetched.description).toBe('Corte de relva e marcação de linhas');
      expect(fetched.synced).toBe(0);
    });

    it('should update a report', async () => {
      const sampleReport = {
        id: 'rep-002',
        date: '2026-08-11T15:00:00Z',
        locationId: 'LOC_STAND',
        locationName: 'Bancada Norte',
        description: 'Limpeza de assentos',
        timeSpentMinutes: 45,
        photos: [],
        createdAt: '2026-08-11T15:00:00Z',
        updatedAt: '2026-08-11T15:00:00Z',
        synced: 0,
        deleted: 0
      };

      await db.reports.add(sampleReport);
      await db.reports.update('rep-002', {
        description: 'Limpeza e reparação de assentos',
        synced: 1,
        updatedAt: '2026-08-11T16:00:00Z'
      });

      const updated = await db.reports.get('rep-002');
      expect(updated.description).toBe('Limpeza e reparação de assentos');
      expect(updated.synced).toBe(1);
    });

    it('should soft-delete and query active reports', async () => {
      await db.reports.bulkAdd([
        { id: 'rep-active', date: '2026-08-11', locationId: 'LOC_1', locationName: 'Balneários', description: 'Active', timeSpentMinutes: 30, photos: [], createdAt: '', updatedAt: '', synced: 0, deleted: 0 },
        { id: 'rep-deleted', date: '2026-08-11', locationId: 'LOC_2', locationName: 'Bancada', description: 'Deleted', timeSpentMinutes: 30, photos: [], createdAt: '', updatedAt: '', synced: 0, deleted: 1 }
      ]);

      const activeReports = await db.reports.where('deleted').equals(0).toArray();
      expect(activeReports.length).toBe(1);
      expect(activeReports[0].id).toBe('rep-active');
    });

    it('should store and retrieve reports with photos containing Blobs, dataURLs, and ArrayBuffers', async () => {
      const sampleDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
      const arrayBuffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]).buffer;
      const originalBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], { type: 'image/png' });

      const rawPhotos = [
        { id: 'p-dataurl', blobData: sampleDataUrl, type: 'before', createdAt: '2026-08-11T12:00:00Z' },
        { id: 'p-arraybuffer', blobData: arrayBuffer, mimeType: 'image/jpeg', type: 'work', createdAt: '2026-08-11T12:00:00Z' },
        { id: 'p-blob', blobData: originalBlob, type: 'after', createdAt: '2026-08-11T12:00:00Z' }
      ];

      // Normalize photos before saving for maximum cross-environment fidelity
      const normalizedPhotos = await normalizePhotosAsync(rawPhotos);

      const report = {
        id: 'rep-photos-multi',
        date: '2026-08-11T12:00:00Z',
        locationId: 'LOC_PITCH',
        locationName: 'Relvado Principal',
        description: 'Report with multi-format photo storage',
        timeSpentMinutes: 60,
        photos: normalizedPhotos,
        createdAt: '2026-08-11T12:00:00Z',
        updatedAt: '2026-08-11T12:00:00Z',
        synced: 0,
        deleted: 0
      };

      await db.reports.add(report);
      const fetched = await db.reports.get('rep-photos-multi');

      expect(fetched).toBeDefined();
      expect(fetched.photos).toHaveLength(3);

      // Verify DataURL photo extraction
      const dataUrlPhoto = fetched.photos[0];
      expect(getPhotoDataUrl(dataUrlPhoto)).toContain('data:image/jpeg;base64');
      const blobFromDataUrl = getPhotoBlob(dataUrlPhoto);
      expect(blobFromDataUrl).toBeInstanceOf(Blob);

      // Verify ArrayBuffer photo extraction
      const bufferPhoto = fetched.photos[1];
      const bufferFromPhoto = await getPhotoArrayBuffer(bufferPhoto);
      expect(bufferFromPhoto.byteLength).toBe(8);
      const blobFromBuffer = getPhotoBlob(bufferPhoto);
      expect(blobFromBuffer.size).toBe(8);

      // Verify Blob photo conversion extraction
      const blobPhoto = fetched.photos[2];
      const reconstructedBlob = getPhotoBlob(blobPhoto);
      expect(reconstructedBlob.size).toBe(4);
      expect(reconstructedBlob.type).toBe('image/png');
    });
  });

  describe('Locations Object Store', () => {
    it('should create and query stadium locations', async () => {
      const sampleLocation = {
        id: 'LOC_PITCH',
        name: 'Relvado Principal',
        description: 'Campo de jogo',
        isCustom: 0,
        createdAt: '2026-08-11T10:00:00Z',
        synced: 1
      };

      await db.locations.add(sampleLocation);
      const fetched = await db.locations.get('LOC_PITCH');
      expect(fetched).toBeDefined();
      expect(fetched.name).toBe('Relvado Principal');
    });

    it('should filter locations by isCustom', async () => {
      await db.locations.bulkAdd([
        { id: 'LOC_1', name: 'Relvado', isCustom: 0, createdAt: '2026-08-11', synced: 1 },
        { id: 'LOC_2', name: 'Zona VIP Nova', isCustom: 1, createdAt: '2026-08-11', synced: 0 }
      ]);

      const customLocations = await db.locations.where('isCustom').equals(1).toArray();
      expect(customLocations.length).toBe(1);
      expect(customLocations[0].name).toBe('Zona VIP Nova');
    });
  });

  describe('Sync Queue Object Store', () => {
    it('should enqueue, read, and delete sync items', async () => {
      const itemId = await db.sync_queue.add({
        entityType: 'report',
        entityId: 'rep-100',
        action: 'CREATE',
        payload: { id: 'rep-100', description: 'Test Queue' },
        timestamp: Date.now(),
        retryCount: 0
      });

      expect(itemId).toBeDefined();

      const queueItems = await db.sync_queue.toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0].entityId).toBe('rep-100');

      await db.sync_queue.delete(itemId);
      const afterDelete = await db.sync_queue.toArray();
      expect(afterDelete.length).toBe(0);
    });
  });
});
