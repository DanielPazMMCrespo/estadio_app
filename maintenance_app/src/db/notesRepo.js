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
 * NotesRepository manages Dexie CRUD for free-form notes (texto, áudio, fotos)
 * and enqueues every mutation to sync_queue inside the same transaction.
 */
export class NotesRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Returns all non-deleted notes: pinned first, then most recent first.
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.notes.toArray();
    return items.filter(n => !n.deleted).sort(compareNotes);
  }

  /**
   * Gets a single note by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.notes.get(id);
  }

  /**
   * Creates a note. Only the body is required.
   * @param {Object} data
   * @param {string} data.body - corpo da nota (obrigatório)
   * @param {Blob|Uint8Array|string} [data.audioBlob]
   * @param {number} [data.audioDuration]
   * @param {string[]} [data.photoIds]
   * @param {string} [data.locationId]
   * @param {string} [data.locationName]
   * @param {boolean|number} [data.pinned]
   * @returns {Promise<Object>} The created note
   */
  async create(data) {
    if (!data || !data.body || !String(data.body).trim()) {
      throw new Error('O corpo da nota é obrigatório');
    }

    const id = data.id || generateUUID();
    const now = new Date().toISOString();

    const noteObj = {
      id,
      body: String(data.body).trim(),
      audioBlob: data.audioBlob || null,
      audioDuration: Number(data.audioDuration) || 0,
      photoIds: Array.isArray(data.photoIds) ? data.photoIds.slice() : [],
      locationId: data.locationId || '',
      locationName: data.locationName || '',
      pinned: data.pinned ? 1 : 0,
      createdAt: data.createdAt || now,
      updatedAt: now,
      synced: 0,
      deleted: 0
    };

    await this.db.transaction('rw', [this.db.notes, this.db.sync_queue], async () => {
      await this.db.notes.put(noteObj);
      await this.db.sync_queue.add({
        entityType: 'note',
        entityId: id,
        action: 'CREATE',
        payload: { ...noteObj, audioBlob: null }, // não duplicar blobs pesados na fila
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return noteObj;
  }

  /**
   * Updates a note by ID.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>} The updated note
   */
  async update(id, updates) {
    if (!id) throw new Error('O ID da nota é obrigatório');
    const existing = await this.db.notes.get(id);
    if (!existing) throw new Error(`Nota ${id} não encontrada`);

    const patch = { ...(updates || {}) };
    if (patch.body !== undefined) {
      const body = String(patch.body).trim();
      if (!body) throw new Error('O corpo da nota é obrigatório');
      patch.body = body;
    }
    if (patch.pinned !== undefined) patch.pinned = patch.pinned ? 1 : 0;
    if (patch.photoIds !== undefined) {
      patch.photoIds = Array.isArray(patch.photoIds) ? patch.photoIds.slice() : [];
    }
    if (patch.audioDuration !== undefined) patch.audioDuration = Number(patch.audioDuration) || 0;

    patch.updatedAt = new Date().toISOString();
    patch.synced = 0;

    const updated = { ...existing, ...patch };

    await this.db.transaction('rw', [this.db.notes, this.db.sync_queue], async () => {
      await this.db.notes.put(updated);
      await this.db.sync_queue.add({
        entityType: 'note',
        entityId: id,
        action: 'UPDATE',
        payload: { id, ...patch, audioBlob: undefined },
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return updated;
  }

  /**
   * Toggles the pinned flag of a note.
   * @param {string} id
   * @returns {Promise<Object>} The updated note
   */
  async togglePinned(id) {
    if (!id) throw new Error('O ID da nota é obrigatório');
    const existing = await this.db.notes.get(id);
    if (!existing) throw new Error(`Nota ${id} não encontrada`);
    return await this.update(id, { pinned: existing.pinned ? 0 : 1 });
  }

  /**
   * Soft-deletes a note (deleted=1).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.notes, this.db.sync_queue], async () => {
      await this.db.notes.update(id, {
        deleted: 1,
        synced: 0,
        updatedAt: new Date().toISOString()
      });
      await this.db.sync_queue.add({
        entityType: 'note',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Case/accent-insensitive search over body and location name.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const q = normalizeText(query);
    if (!q) return await this.getAll();
    const items = await this.getAll();
    return items.filter(n =>
      normalizeText(n.body).includes(q) || normalizeText(n.locationName).includes(q)
    );
  }

  /**
   * Marks a note as synced.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.notes.update(id, { synced: 1 });
  }
}

/** Sort helper: pinned first, then newest first. */
function compareNotes(a, b) {
  const pa = a.pinned ? 1 : 0;
  const pb = b.pinned ? 1 : 0;
  if (pa !== pb) return pb - pa;
  const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return tb - ta;
}

/** Combining diacritical marks range (U+0300..U+036F). */
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercases and strips diacritics so "Balneario" encontra "Balneário". */
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();
}

export const notesRepo = new NotesRepository();
