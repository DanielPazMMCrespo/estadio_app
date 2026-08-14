import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EstadioMaintenanceDB } from '../../src/db/db.js';
import { LocationsRepository, DEFAULT_LOCATIONS, PREDEFINED_LOCATION_IDS } from '../../src/db/locationsRepo.js';
import { LocationModalComponent } from '../../src/ui/locationModal.js';

describe('M2 Challenger Empirical Stress Suite', () => {
  let db;
  let repo;
  let dbName;

  beforeEach(async () => {
    dbName = `TestDB_M2_Challenger_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
    repo = new LocationsRepository(db);
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    if (db) {
      await db.delete();
      db.close();
    }
    document.body.innerHTML = '';
  });

  describe('1. High-Volume & Concurrent Offline Location Creation', () => {
    it('handles 50 concurrent offline location creations with transaction consistency', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(repo.create({
          name: `Zona Stress ${i}`,
          description: `Descrição do local de teste ${i}`
        }));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      const locCount = await db.locations.count();
      const queueCount = await db.sync_queue.count();

      expect(locCount).toBe(50);
      expect(queueCount).toBe(50);

      // Verify every sync_queue record corresponds to a created location
      const queueItems = await db.sync_queue.toArray();
      const locItems = await db.locations.toArray();

      const locMap = new Map(locItems.map(l => [l.id, l]));

      for (const qItem of queueItems) {
        expect(qItem.entityType).toBe('location');
        expect(qItem.action).toBe('CREATE');
        expect(qItem.retryCount).toBe(0);
        expect(typeof qItem.timestamp).toBe('number');
        
        const loc = locMap.get(qItem.entityId);
        expect(loc).toBeDefined();
        expect(loc.synced).toBe(0);
        expect(loc.isCustom).toBe(true);
        expect(qItem.payload).toEqual(loc);
      }
    });

    it('maintains strict linear order of sync_queue auto-increment IDs during rapid sequential creation', async () => {
      const createdIds = [];
      for (let i = 0; i < 15; i++) {
        const item = await repo.create({ name: `Sequential Area ${i}` });
        createdIds.push(item.id);
      }

      const queueItems = await db.sync_queue.toArray();
      expect(queueItems).toHaveLength(15);

      for (let i = 0; i < 15; i++) {
        expect(queueItems[i].id).toBe(i + 1);
        expect(queueItems[i].entityId).toBe(createdIds[i]);
      }
    });
  });

  describe('2. Sync Queue State Transitions & Offline Recovery Scenarios', () => {
    it('transitions location synced state from 0 to 1 upon markSynced()', async () => {
      const loc = await repo.create({ name: `Camarote 10` });
      expect(loc.synced).toBe(0);

      // Verify sync queue has CREATE item
      let queueItems = await db.sync_queue.toArray();
      expect(queueItems).toHaveLength(1);
      expect(queueItems[0].entityId).toBe(loc.id);

      // Mark synced
      const updated = await repo.markSynced(loc.id);
      expect(updated).toBe(1);

      const dbLoc = await db.locations.get(loc.id);
      expect(dbLoc.synced).toBe(1);

      // Sync queue item remains intact until processed by sync engine
      queueItems = await db.sync_queue.toArray();
      expect(queueItems).toHaveLength(1);
    });

    it('verifies predefined mapping for standard stadium locations vs generated UUID for custom ones', async () => {
      const pitch = await repo.create({ name: 'Relvado Principal' });
      expect(pitch.id).toBe('LOC_PITCH');
      expect(pitch.isCustom).toBe(true); // create defaults isCustom to true unless specified

      const custom = await repo.create({ name: 'Sala de Imprensa Nova' });
      expect(custom.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('3. Edge Cases, Boundary Testing & Security Sanitization', () => {
    it('handles HTML / XSS strings and extremely long location names safely', async () => {
      const xssName = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      const longDesc = 'A'.repeat(5000);

      const loc = await repo.create({
        name: xssName,
        description: longDesc
      });

      expect(loc.name).toBe(xssName);

      const saved = await db.locations.get(loc.id);
      expect(saved.name).toBe(xssName);
      expect(saved.description).toHaveLength(5000);

      const modalContainer = document.createElement('div');
      document.body.appendChild(modalContainer);
      const modalComp = new LocationModalComponent(modalContainer, { locationsRepo: repo });
      await modalComp.open();

      const listEl = modalContainer.querySelector('#location-cards-list');
      // Verify HTML escaping in UI component rendering
      expect(listEl.innerHTML).not.toContain('<script>alert');
      expect(listEl.innerHTML).toContain('&lt;script&gt;alert');
    });

    it('trims leading and trailing whitespace from location names and descriptions', async () => {
      const loc = await repo.create({
        name: '   Portão 4 Norte   ',
        description: '   Acesso VIP   '
      });

      expect(loc.name).toBe('Portão 4 Norte');
      expect(loc.description).toBe('Acesso VIP');
    });

    it('correctly sorts Portuguese accented location names alphabetically in getAll()', async () => {
      await repo.create({ name: 'Balneários' });
      await repo.create({ name: 'Área VIP' });
      await repo.create({ name: 'Bancada Norte' });
      await repo.create({ name: 'Auditório' });

      const all = await repo.getAll();
      const names = all.map(l => l.name);

      expect(names).toEqual([
        'Área VIP',
        'Auditório',
        'Balneários',
        'Bancada Norte'
      ]);
    });
  });

  describe('4. UI Modal & Parent Select Dropdown Integration', () => {
    it('creates location via UI modal, updates parent select dropdown and triggers change event', async () => {
      // Setup mock parent form with select dropdown
      const form = document.createElement('form');
      const select = document.createElement('select');
      select.id = 'select-location';
      form.appendChild(select);
      document.body.appendChild(form);

      let changeEventFired = false;
      select.addEventListener('change', () => {
        changeEventFired = true;
      });

      const modalComp = new LocationModalComponent(document.body, { locationsRepo: repo });
      await modalComp.open({ expandForm: true });

      const nameInput = document.getElementById('input-location-name');
      const descInput = document.getElementById('input-location-desc');
      const saveBtn = document.getElementById('btn-save-location');

      nameInput.value = 'Camarote 102';
      descInput.value = 'Piso 2';

      await modalComp.saveCustomLocation();

      expect(changeEventFired).toBe(true);
      expect(select.options.length).toBeGreaterThan(0);
      
      const addedOpt = Array.from(select.options).find(opt => opt.textContent === 'Camarote 102');
      expect(addedOpt).toBeDefined();
      expect(select.value).toBe(addedOpt.value);

      // Verify stored in DB
      const locs = await repo.getAll();
      const found = locs.find(l => l.name === 'Camarote 102');
      expect(found).toBeDefined();
      expect(found.isCustom).toBe(true);

      // Verify sync queue entry
      const queue = await db.sync_queue.toArray();
      const queueEntry = queue.find(q => q.entityId === found.id);
      expect(queueEntry).toBeDefined();
      expect(queueEntry.action).toBe('CREATE');
    });
  });
});
