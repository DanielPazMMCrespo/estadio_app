import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EstadioMaintenanceDB } from '../../src/db/db.js';

describe('Empirical Stress Testing — EstadioMaintenanceDB Schema & Storage Engine', () => {
  let db;

  beforeEach(async () => {
    const dbName = `stress_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await db.delete();
      await db.close();
    }
  });

  // 1. Storage of Photo data and special Portuguese UTF-8 characters
  it('should store and retrieve photo DataURL / ArrayBuffer objects and special Portuguese UTF-8 characters', async () => {
    const sampleDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...';

    const photoReport = {
      id: 'rep-blob-001',
      date: new Date().toISOString(),
      locationId: 'LOC_PITCH',
      locationName: 'Relvado Principal — Estádio Leiria',
      description: 'Manutenção do relvado com inspeção técnica de irrigação & marcações (Ação Concluída com Sucesso: ⚽ 🏟️)',
      timeSpentMinutes: 120,
      photos: [
        { id: 'img-1', blobData: sampleDataUrl, type: 'before', createdAt: new Date().toISOString() },
        { id: 'img-2', blobData: sampleDataUrl, type: 'after', createdAt: new Date().toISOString() }
      ],
      materials: 'Substrato orgânico, tinta ecológica branca',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: 0,
      deleted: 0
    };

    await db.reports.add(photoReport);

    const fetched = await db.reports.get('rep-blob-001');
    expect(fetched).toBeDefined();
    expect(fetched.description).toContain('⚽ 🏟️');
    expect(fetched.photos.length).toBe(2);
    expect(fetched.photos[0].blobData).toBe(sampleDataUrl);
  });

  // 2. High-volume bulk insertion and indexed querying
  it('should handle high-volume bulk insertion (500 reports) and maintain index lookup performance', async () => {
    const reports = [];
    const now = Date.now();

    for (let i = 0; i < 500; i++) {
      reports.push({
        id: `bulk-rep-${i}`,
        date: new Date(now - i * 3600000).toISOString(),
        locationId: i % 2 === 0 ? 'LOC_PITCH' : 'LOC_STAND',
        locationName: i % 2 === 0 ? 'Relvado' : 'Bancada',
        description: `Bulk report item #${i}`,
        timeSpentMinutes: (i % 60) + 15,
        photos: [],
        createdAt: new Date(now - i * 3600000).toISOString(),
        updatedAt: new Date(now - i * 3600000).toISOString(),
        synced: i % 3 === 0 ? 1 : 0,
        deleted: i % 10 === 0 ? 1 : 0
      });
    }

    await db.reports.bulkAdd(reports);

    const totalCount = await db.reports.count();
    expect(totalCount).toBe(500);

    // Query active un-synced reports using compound filter/indexing
    const unsyncedActive = await db.reports
      .where('synced').equals(0)
      .filter(r => r.deleted === 0)
      .toArray();

    expect(unsyncedActive.length).toBeGreaterThan(0);

    // Query by indexed locationId
    const pitchReports = await db.reports.where('locationId').equals('LOC_PITCH').toArray();
    expect(pitchReports.length).toBe(250);
  });

  // 3. Sync Queue Auto-Increment Key & Ordering
  it('should auto-increment sync_queue IDs sequentially and maintain FIFO order', async () => {
    const items = [
      { entityType: 'report', entityId: 'r-1', action: 'CREATE', payload: {}, timestamp: 100, retryCount: 0 },
      { entityType: 'location', entityId: 'l-1', action: 'CREATE', payload: {}, timestamp: 200, retryCount: 0 },
      { entityType: 'report', entityId: 'r-1', action: 'UPDATE', payload: {}, timestamp: 300, retryCount: 0 }
    ];

    for (const item of items) {
      await db.sync_queue.add(item);
    }

    const queue = await db.sync_queue.orderBy('id').toArray();
    expect(queue.length).toBe(3);
    expect(queue[0].id).toBe(1);
    expect(queue[1].id).toBe(2);
    expect(queue[2].id).toBe(3);
    expect(queue[0].entityId).toBe('r-1');
    expect(queue[2].action).toBe('UPDATE');
  });

  // 4. Index verification for all schema fields
  it('should have working indices on all declared indexed fields across stores', async () => {
    // Insert dummy records for each store
    await db.reports.add({
      id: 'idx-r1',
      date: '2026-08-11T12:00:00Z',
      locationId: 'LOC_TEST',
      locationName: 'Zona Teste',
      createdAt: '2026-08-11T12:00:00Z',
      updatedAt: '2026-08-11T12:00:00Z',
      synced: 1,
      deleted: 0
    });

    await db.locations.add({
      id: 'LOC_TEST',
      name: 'Zona Teste',
      isCustom: 1,
      createdAt: '2026-08-11T12:00:00Z',
      synced: 0
    });

    await db.sync_queue.add({
      entityType: 'report',
      entityId: 'idx-r1',
      action: 'DELETE',
      payload: {},
      timestamp: 123456789,
      retryCount: 2
    });

    // Test indexed field queries
    expect((await db.reports.where('date').equals('2026-08-11T12:00:00Z').toArray()).length).toBe(1);
    expect((await db.reports.where('locationId').equals('LOC_TEST').toArray()).length).toBe(1);
    expect((await db.reports.where('locationName').equals('Zona Teste').toArray()).length).toBe(1);
    expect((await db.reports.where('createdAt').equals('2026-08-11T12:00:00Z').toArray()).length).toBe(1);
    expect((await db.reports.where('updatedAt').equals('2026-08-11T12:00:00Z').toArray()).length).toBe(1);

    expect((await db.locations.where('name').equals('Zona Teste').toArray()).length).toBe(1);
    expect((await db.locations.where('isCustom').equals(1).toArray()).length).toBe(1);
    expect((await db.locations.where('synced').equals(0).toArray()).length).toBe(1);

    expect((await db.sync_queue.where('entityType').equals('report').toArray()).length).toBe(1);
    expect((await db.sync_queue.where('entityId').equals('idx-r1').toArray()).length).toBe(1);
    expect((await db.sync_queue.where('action').equals('DELETE').toArray()).length).toBe(1);
    expect((await db.sync_queue.where('retryCount').equals(2).toArray()).length).toBe(1);
  });

  // 5. Transaction atomicity test
  it('should rollback Dexie transaction if an error occurs mid-operation', async () => {
    try {
      await db.transaction('rw', [db.reports, db.sync_queue], async () => {
        await db.reports.add({
          id: 'txn-1',
          date: '2026-08-11',
          locationId: 'L1',
          locationName: 'Norte',
          description: 'Txn item',
          timeSpentMinutes: 10,
          photos: [],
          createdAt: '',
          updatedAt: '',
          synced: 0,
          deleted: 0
        });

        // Intentional error inside transaction
        throw new Error('Transaction abort simulation');
      });
    } catch (err) {
      expect(err.message).toBe('Transaction abort simulation');
    }

    const reportInDb = await db.reports.get('txn-1');
    expect(reportInDb).toBeUndefined(); // Rolled back!
  });
});
