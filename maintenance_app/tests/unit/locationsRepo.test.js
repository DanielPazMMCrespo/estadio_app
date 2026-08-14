import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EstadioMaintenanceDB } from '../../src/db/db.js';
import { LocationsRepository, DEFAULT_LOCATIONS, PREDEFINED_LOCATION_IDS } from '../../src/db/locationsRepo.js';

describe('LocationsRepository Unit Tests', () => {
  let db;
  let repo;
  let dbName;

  beforeEach(async () => {
    dbName = `TestDB_Locations_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
    repo = new LocationsRepository(db);
  });

  afterEach(async () => {
    if (db) {
      await db.delete();
      db.close();
    }
  });

  describe('seedDefaults()', () => {
    it('seeds default stadium locations when local store is empty', async () => {
      const initialCount = await db.locations.count();
      expect(initialCount).toBe(0);

      const seeded = await repo.seedDefaults();
      expect(seeded.length).toBeGreaterThan(0);

      const count = await db.locations.count();
      expect(count).toBe(seeded.length);

      const pitch = await db.locations.get('LOC_PITCH');
      expect(pitch).toBeDefined();
      expect(pitch.name).toBe('Relvado Principal');
      expect(pitch.synced).toBe(1);
      expect(pitch.isCustom).toBe(false);
    });

    it('is idempotent and does not duplicate records on subsequent calls', async () => {
      await repo.seedDefaults();
      const count1 = await db.locations.count();

      await repo.seedDefaults();
      const count2 = await db.locations.count();

      expect(count1).toBe(count2);
    });

    it('seeds custom string list of location names cleanly', async () => {
      const customList = ['Bancada Nascente', 'Bancada Sul'];
      const seeded = await repo.seedDefaults(customList);

      expect(seeded).toHaveLength(2);
      expect(seeded[0].name).toBe('Bancada Nascente');
      expect(seeded[0].id).toBe(PREDEFINED_LOCATION_IDS['Bancada Nascente']);
      expect(seeded[1].name).toBe('Bancada Sul');
      expect(seeded[1].id).toBe(PREDEFINED_LOCATION_IDS['Bancada Sul']);
    });
  });

  describe('getAll()', () => {
    it('returns empty array when store is empty', async () => {
      const result = await repo.getAll();
      expect(result).toEqual([]);
    });

    it('returns non-deleted locations sorted alphabetically by name ASC', async () => {
      await repo.create({ id: 'loc-c', name: 'Bancada Sul', isCustom: true });
      await repo.create({ id: 'loc-a', name: 'Balneários', isCustom: false });
      await repo.create({ id: 'loc-b', name: 'Relvado Principal', isCustom: false });

      const locations = await repo.getAll();
      expect(locations.map(l => l.name)).toEqual([
        'Balneários',
        'Bancada Sul',
        'Relvado Principal'
      ]);
    });

    it('filters out soft-deleted locations', async () => {
      await repo.create({ id: 'loc-1', name: 'Zona Ativa', isCustom: true });
      await db.locations.put({
        id: 'loc-2',
        name: 'Zona Apagada',
        isCustom: true,
        deleted: 1,
        synced: 0,
        createdAt: new Date().toISOString()
      });

      const locations = await repo.getAll();
      expect(locations).toHaveLength(1);
      expect(locations[0].name).toBe('Zona Ativa');
    });
  });

  describe('create()', () => {
    it('throws an error if location name is missing or empty', async () => {
      await expect(repo.create({})).rejects.toThrow('Location name is required');
      await expect(repo.create({ name: '   ' })).rejects.toThrow('Location name is required');
    });

    it('creates a custom location and enqueues CREATE action in sync_queue', async () => {
      const created = await repo.create({
        name: 'Camarote Presidencial',
        description: 'Zona VIP superior'
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Camarote Presidencial');
      expect(created.description).toBe('Zona VIP superior');
      expect(created.isCustom).toBe(true);
      expect(created.synced).toBe(0);

      // Verify persistence in Dexie locations store
      const dbLocation = await db.locations.get(created.id);
      expect(dbLocation).toBeDefined();
      expect(dbLocation.name).toBe('Camarote Presidencial');

      // Verify item enqueued in sync_queue
      const syncItems = await db.sync_queue.toArray();
      expect(syncItems).toHaveLength(1);

      const queueItem = syncItems[0];
      expect(queueItem.entityType).toBe('location');
      expect(queueItem.entityId).toBe(created.id);
      expect(queueItem.action).toBe('CREATE');
      expect(queueItem.payload).toEqual(created);
    });
  });

  describe('markSynced()', () => {
    it('updates synced flag to 1 for an existing location', async () => {
      const created = await repo.create({
        name: 'Túnel de Acesso Sul',
        isCustom: true
      });

      expect(created.synced).toBe(0);

      const updatedCount = await repo.markSynced(created.id);
      expect(updatedCount).toBe(1);

      const syncedLoc = await db.locations.get(created.id);
      expect(syncedLoc.synced).toBe(1);
    });

    it('returns 0 if id is missing or invalid', async () => {
      const res = await repo.markSynced('');
      expect(res).toBe(0);
    });
  });
});
