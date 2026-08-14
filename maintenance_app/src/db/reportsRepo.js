import { db as defaultDb } from './db.js';
import { normalizePhotosAsync } from './db.js';

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
 * ReportsRepository manages Dexie CRUD operations for maintenance reports
 * and enqueues offline mutations to sync_queue.
 */
export class ReportsRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Returns all non-deleted reports sorted by date descending.
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.reports.toArray();
    return items
      .filter(r => !r.deleted || r.deleted === 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Gets a single report by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.reports.get(id);
  }

  /**
   * Returns reports from today only, sorted by date descending.
   * @returns {Promise<Array>}
   */
  async getToday() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const items = await this.db.reports
      .where('date')
      .between(startOfDay, endOfDay, true, false)
      .toArray();

    return items
      .filter(r => !r.deleted || r.deleted === 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Creates a new maintenance report and enqueues sync action.
   * @param {Object} reportData
   * @returns {Promise<Object>} The created report object
   */
  async create(reportData) {
    if (!reportData) throw new Error('Report data is required');
    if (!reportData.locationId) throw new Error('Location ID is required');
    if (!reportData.description || !String(reportData.description).trim()) {
      throw new Error('Description is required');
    }

    const id = reportData.id || generateUUID();
    const now = new Date().toISOString();

    let photos = [];
    if (Array.isArray(reportData.photos) && reportData.photos.length > 0) {
      photos = await normalizePhotosAsync(reportData.photos);
    }

    const reportObj = {
      id,
      date: reportData.date || now,
      locationId: reportData.locationId,
      locationName: reportData.locationName || '',
      sectorCode: reportData.sectorCode || reportData.locationId || '',
      priority: reportData.priority || 'medium', // 'critical' | 'medium' | 'low'
      status: reportData.status || 'pending', // 'pending' | 'in_progress' | 'resolved'
      description: String(reportData.description).trim(),
      timeSpent: Number(reportData.timeSpent) || 0,
      photos,
      materials: reportData.materials ? String(reportData.materials).trim() : '',
      audioBlob: reportData.audioBlob || null,
      audioDuration: Number(reportData.audioDuration) || 0,
      resolutionNotes: reportData.resolutionNotes ? String(reportData.resolutionNotes).trim() : '',
      resolvedAt: reportData.resolvedAt || (reportData.status === 'resolved' ? now : null),
      createdAt: now,
      updatedAt: now,
      synced: 0,
      deleted: 0
    };

    const syncQueueItem = {
      entityType: 'report',
      entityId: id,
      action: 'CREATE',
      payload: { ...reportObj, photos: [], audioBlob: null }, // Don't duplicate heavy blobs in queue
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.reports, this.db.sync_queue], async () => {
      await this.db.reports.put(reportObj);
      await this.db.sync_queue.add(syncQueueItem);
    });

    return reportObj;
  }

  /**
   * Updates an existing report by ID.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>} The updated report object
   */
  async update(id, updates) {
    if (!id) throw new Error('Report ID is required');

    const existing = await this.db.reports.get(id);
    if (!existing) throw new Error(`Report ${id} not found`);

    const now = new Date().toISOString();
    const mergedUpdates = { ...updates };

    if (Array.isArray(mergedUpdates.photos)) {
      mergedUpdates.photos = await normalizePhotosAsync(mergedUpdates.photos);
    }

    if (mergedUpdates.status === 'resolved' && !existing.resolvedAt && !mergedUpdates.resolvedAt) {
      mergedUpdates.resolvedAt = now;
    }

    mergedUpdates.updatedAt = now;
    mergedUpdates.synced = 0;

    const updatedReport = { ...existing, ...mergedUpdates };

    const syncQueueItem = {
      entityType: 'report',
      entityId: id,
      action: 'UPDATE',
      payload: { id, ...mergedUpdates, photos: undefined, audioBlob: undefined },
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.reports, this.db.sync_queue], async () => {
      await this.db.reports.put(updatedReport);
      await this.db.sync_queue.add(syncQueueItem);
    });

    return updatedReport;
  }

  /**
   * Fast status toggle helper (e.g. pending -> in_progress -> resolved)
   * @param {string} id 
   * @param {'pending'|'in_progress'|'resolved'} newStatus 
   * @param {string} [notes] 
   * @returns {Promise<Object>}
   */
  async setStatus(id, newStatus, notes = '') {
    const updates = { status: newStatus };
    if (notes) updates.resolutionNotes = notes;
    if (newStatus === 'resolved') updates.resolvedAt = new Date().toISOString();
    return await this.update(id, updates);
  }

  /**
   * Soft-deletes a report by setting deleted=1.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;

    const syncQueueItem = {
      entityType: 'report',
      entityId: id,
      action: 'DELETE',
      payload: { id },
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.reports, this.db.sync_queue], async () => {
      await this.db.reports.update(id, { deleted: 1, synced: 0, updatedAt: new Date().toISOString() });
      await this.db.sync_queue.add(syncQueueItem);
    });
  }

  /**
   * Hard-deletes a report from the database.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async hardDelete(id) {
    if (!id) return;
    await this.db.reports.delete(id);
  }

  /**
   * Gets the count of reports that haven't been synced.
   * @returns {Promise<number>}
   */
  async getUnsyncedCount() {
    const items = await this.db.reports.where('synced').equals(0).toArray();
    return items.filter(r => !r.deleted || r.deleted === 0).length;
  }

  /**
   * Marks a report as synced.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.reports.update(id, { synced: 1 });
  }
}

export const reportsRepo = new ReportsRepository();
