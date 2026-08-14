import { db as defaultDb } from './db.js';

/**
 * Cross-environment UUID v4 generator.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Default materials/tools to seed.
 */
export const DEFAULT_MATERIALS = [
  { id: 'MAT_PAINT', name: 'Tinta de Marcação', synced: 1 },
  { id: 'MAT_WRENCH', name: 'Chave Inglesa', synced: 1 },
  { id: 'MAT_SCREWDRIVER', name: 'Chave de Fendas', synced: 1 },
  { id: 'MAT_TAPE', name: 'Fita Isoladora', synced: 1 },
  { id: 'MAT_SILICONE', name: 'Silicone', synced: 1 },
];

/**
 * MaterialsRepository manages CRUD for materials and tools.
 */
export class MaterialsRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  async getAll() {
    const items = await this.db.materials.toArray();
    return items
      .filter(m => !m.deleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  async getById(id) {
    if (!id) return undefined;
    return await this.db.materials.get(id);
  }

  async create(data) {
    if (!data || !data.name || !String(data.name).trim()) {
      throw new Error('Material name is required');
    }
    const id = data.id || generateUUID();
    const obj = {
      id,
      name: String(data.name).trim(),
      createdAt: data.createdAt || new Date().toISOString(),
      synced: data.synced !== undefined ? Number(data.synced) : 0
    };

    const syncItem = {
      entityType: 'material',
      entityId: id,
      action: 'CREATE',
      payload: obj,
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.materials, this.db.sync_queue], async () => {
      await this.db.materials.put(obj);
      await this.db.sync_queue.add(syncItem);
    });

    return obj;
  }

  async update(id, updates) {
    if (!id) throw new Error('Material ID is required');
    const existing = await this.db.materials.get(id);
    if (!existing) throw new Error(`Material ${id} not found`);

    const updated = {
      ...existing,
      name: updates.name ? String(updates.name).trim() : existing.name,
      synced: 0
    };

    const syncItem = {
      entityType: 'material',
      entityId: id,
      action: 'UPDATE',
      payload: { id, name: updated.name },
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.materials, this.db.sync_queue], async () => {
      await this.db.materials.put(updated);
      await this.db.sync_queue.add(syncItem);
    });

    return updated;
  }

  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.materials, this.db.sync_queue], async () => {
      await this.db.materials.delete(id);
      await this.db.sync_queue.add({
        entityType: 'material',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  async seedDefaults() {
    const count = await this.db.materials.count();
    if (count > 0) return await this.getAll();
    await this.db.materials.bulkPut(DEFAULT_MATERIALS.map(m => ({
      ...m,
      createdAt: new Date().toISOString()
    })));
    return DEFAULT_MATERIALS;
  }
}

export const materialsRepo = new MaterialsRepository();
