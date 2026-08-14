import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EstadioMaintenanceDB } from '../../src/db/db.js';
import { LocationsRepository, DEFAULT_LOCATIONS, PREDEFINED_LOCATION_IDS } from '../../src/db/locationsRepo.js';
import { LocationModalComponent } from '../../src/ui/locationModal.js';

describe('Challenger M2 Empirical Stress Harness', () => {
  let db;
  let repo;
  let dbName;

  beforeEach(async () => {
    dbName = `ChallengerDB_M2_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
    repo = new LocationsRepository(db);

    // Clean DOM
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    if (db) {
      await db.delete();
      db.close();
    }
    document.body.innerHTML = '';
  });

  describe('1. LocationsRepository Edge Cases & Input Validation', () => {
    it('rejects empty string, whitespace-only, null, or non-string names', async () => {
      await expect(repo.create({ name: '' })).rejects.toThrow('Location name is required');
      await expect(repo.create({ name: '    ' })).rejects.toThrow('Location name is required');
      await expect(repo.create({ name: '\t\n  \r ' })).rejects.toThrow('Location name is required');
      await expect(repo.create({ name: null })).rejects.toThrow();
      await expect(repo.create(null)).rejects.toThrow();
      await expect(repo.create({})).rejects.toThrow('Location name is required');
    });

    it('trims leading and trailing whitespace from name and description', async () => {
      const created = await repo.create({
        name: '   Bancada Central   ',
        description: '   Zona VIP reservada   '
      });

      expect(created.name).toBe('Bancada Central');
      expect(created.description).toBe('Zona VIP reservada');

      const retrieved = await repo.getById(created.id);
      expect(retrieved.name).toBe('Bancada Central');
      expect(retrieved.description).toBe('Zona VIP reservada');
    });

    it('handles special characters, HTML strings, SQL-like strings, and Emojis', async () => {
      const xssName = '<script>alert("XSS")</script>';
      const sqlDesc = "DROP TABLE locations; -- ' OR '1'='1";
      const emojiName = '🏟️ Relvado Sul 🔥';
      const unicodeDesc = 'Balneário das equipas — ⚽ #1 & 100% testado';

      const loc1 = await repo.create({ name: xssName, description: sqlDesc });
      const loc2 = await repo.create({ name: emojiName, description: unicodeDesc });

      expect(loc1.name).toBe(xssName);
      expect(loc1.description).toBe(sqlDesc);
      expect(loc2.name).toBe(emojiName);
      expect(loc2.description).toBe(unicodeDesc);

      const all = await repo.getAll();
      expect(all.some(l => l.name === xssName)).toBe(true);
      expect(all.some(l => l.name === emojiName)).toBe(true);
    });

    it('handles extremely long name and description (stress 5,000 chars)', async () => {
      const longName = 'A'.repeat(5000);
      const longDesc = 'B'.repeat(5000);

      const created = await repo.create({ name: longName, description: longDesc });
      expect(created.name.length).toBe(5000);
      expect(created.description.length).toBe(5000);

      const fetched = await repo.getById(created.id);
      expect(fetched.name).toBe(longName);
    });

    it('handles duplicate location names by assigning unique UUIDs when not predefined', async () => {
      const loc1 = await repo.create({ name: 'Zona de Imprensa' });
      const loc2 = await repo.create({ name: 'Zona de Imprensa' });

      expect(loc1.name).toBe('Zona de Imprensa');
      expect(loc2.name).toBe('Zona de Imprensa');
      expect(loc1.id).not.toBe(loc2.id);

      const all = await repo.getAll();
      const match = all.filter(l => l.name === 'Zona de Imprensa');
      expect(match).toHaveLength(2);

      const queueItems = await db.sync_queue.toArray();
      expect(queueItems.filter(q => q.payload.name === 'Zona de Imprensa')).toHaveLength(2);
    });

    it('sorts locations properly using Portuguese locale in getAll()', async () => {
      await repo.create({ name: 'Óbidos Stand' });
      await repo.create({ name: 'Água Sector' });
      await repo.create({ name: 'Balneários' });
      await repo.create({ name: 'Évora Lounge' });

      const all = await repo.getAll();
      const names = all.map(l => l.name);

      expect(names).toEqual([
        'Água Sector',
        'Balneários',
        'Évora Lounge',
        'Óbidos Stand'
      ]);
    });
  });

  describe('2. Rapid Concurrent Creation & Dexie Transaction Atomicity', () => {
    it('handles 50 concurrent creation promises without data loss or sync_queue desync', async () => {
      const createPromises = [];
      for (let i = 1; i <= 50; i++) {
        createPromises.push(repo.create({
          name: `Concurrent Location ${String(i).padStart(2, '0')}`,
          description: `Desc ${i}`
        }));
      }

      const results = await Promise.all(createPromises);
      expect(results).toHaveLength(50);

      const dbLocations = await db.locations.toArray();
      expect(dbLocations).toHaveLength(50);

      const syncQueue = await db.sync_queue.toArray();
      expect(syncQueue).toHaveLength(50);

      // Verify every sync_queue item has matching location entityId and action 'CREATE'
      const locIds = new Set(dbLocations.map(l => l.id));
      for (const queueItem of syncQueue) {
        expect(queueItem.entityType).toBe('location');
        expect(queueItem.action).toBe('CREATE');
        expect(locIds.has(queueItem.entityId)).toBe(true);
      }
    });

    it('maintains transactional integrity: rollback leaves no orphan sync_queue or location records', async () => {
      const initialLocCount = await db.locations.count();
      const initialQueueCount = await db.sync_queue.count();

      try {
        await db.transaction('rw', [db.locations, db.sync_queue], async () => {
          await db.locations.put({ id: 'tx-fail-1', name: 'Will Fail', createdAt: new Date().toISOString() });
          throw new Error('Simulated Transaction Failure');
        });
      } catch (err) {
        expect(err.message).toBe('Simulated Transaction Failure');
      }

      expect(await db.locations.count()).toBe(initialLocCount);
      expect(await db.sync_queue.count()).toBe(initialQueueCount);
    });
  });

  describe('3. LocationModalComponent UI & Filtering Stress', () => {
    let modalComponent;

    beforeEach(() => {
      document.body.innerHTML = `
        <select id="select-location">
          <option value="">Seleccione um local...</option>
        </select>
      `;

      modalComponent = new LocationModalComponent(document.body, { locationsRepo: repo });
    });

    it('escapes HTML strings safely when rendering cards in DOM', async () => {
      await repo.create({
        name: '<img src=x onerror=alert(1)>',
        description: '<script>window.hacked=true</script>'
      });

      await modalComponent.open();
      const listEl = document.getElementById('location-cards-list');
      expect(listEl).not.toBeNull();

      const htmlContent = listEl.innerHTML;
      expect(htmlContent).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(htmlContent).toContain('&lt;script&gt;window.hacked=true&lt;/script&gt;');
      expect(window.hacked).toBeUndefined();
    });

    it('filters location cards properly with query string including regex control characters', async () => {
      await repo.create({ name: 'Bancada Norte [VIP]', description: 'Setor A+ (VIP)' });
      await repo.create({ name: 'Relvado Principal', description: 'Campo principal' });

      await modalComponent.open();

      // Search with regex special characters: [, ], +, (, )
      modalComponent.filterLocations('norte [vip]');
      expect(modalComponent.filteredList).toHaveLength(1);
      expect(modalComponent.filteredList[0].name).toBe('Bancada Norte [VIP]');

      // Lowercased query 'a+'
      modalComponent.filterLocations('a+');
      expect(modalComponent.filteredList).toHaveLength(1);
      expect(modalComponent.filteredList[0].name).toBe('Bancada Norte [VIP]');
    });

    it('demonstrates filterLocations failure when query contains uppercase characters (bug finding)', async () => {
      await repo.create({ name: 'Bancada Norte [VIP]', description: 'Setor A+ (VIP)' });
      await modalComponent.open();

      // Calling filterLocations with uppercase 'A+' fails because filterLocations does not lowercase query argument internally
      modalComponent.filterLocations('A+');
      // Empirical evidence: returns 0 matches because 'bancada norte [vip]' is compared against un-lowercased 'A+'
      expect(modalComponent.filteredList.length).toBe(0);
    });

    it('filters location cards properly when search input fires input event with extra spaces', async () => {
      await repo.create({ name: 'Balneários' });
      await repo.create({ name: 'Bancada Sul' });

      await modalComponent.open();

      const searchInput = document.getElementById('input-search-location');
      expect(searchInput).not.toBeNull();

      // Dispatch input with extra whitespace
      searchInput.value = '   balneários   ';
      searchInput.dispatchEvent(new Event('input'));

      expect(modalComponent.filteredList).toHaveLength(1);
      expect(modalComponent.filteredList[0].name).toBe('Balneários');
    });

    it('updates parent select dropdown and dispatches change event upon custom location creation', async () => {
      let changeFired = false;
      const selectEl = document.getElementById('select-location');
      selectEl.addEventListener('change', () => {
        changeFired = true;
      });

      await modalComponent.open({ expandForm: true });

      const nameInput = document.getElementById('input-location-name');
      const descInput = document.getElementById('input-location-desc');

      nameInput.value = ' Sala de Imprensa ';
      descInput.value = ' Piso 2 ';

      await modalComponent.saveCustomLocation();

      expect(changeFired).toBe(true);
      expect(selectEl.value).toBeDefined();
      expect(selectEl.selectedOptions[0].textContent).toBe('Sala de Imprensa');

      // Verify stored in DB
      const dbLocations = await repo.getAll();
      expect(dbLocations.some(l => l.name === 'Sala de Imprensa')).toBe(true);
    });

    it('handles duplicate option creation gracefully on select element', async () => {
      const selectEl = document.getElementById('select-location');
      const loc = await repo.create({ name: 'Zona Mista' });

      modalComponent.selectLocation(loc);
      expect(selectEl.querySelectorAll(`option[value="${loc.id}"]`)).toHaveLength(1);

      modalComponent.selectLocation(loc);
      expect(selectEl.querySelectorAll(`option[value="${loc.id}"]`)).toHaveLength(1);
    });
  });
});
