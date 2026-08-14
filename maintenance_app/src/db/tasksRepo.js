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

/** Prioridades aceites numa tarefa. */
export const TASK_PRIORITIES = ['critical', 'medium', 'low'];

/** Padrões de recorrência aceites. */
export const TASK_RECURRENCES = [null, 'daily', 'weekly', 'monthly'];

/**
 * Converts a Date (or now) to a local calendar day string 'YYYY-MM-DD'.
 * Usa SEMPRE o dia local do utilizador — nunca UTC — para que uma tarefa
 * criada às 23:30 em Lisboa continue a ser "hoje".
 *
 * @param {Date} [date]
 * @returns {string} ISO date (só o dia), ex. '2026-08-14'
 */
export function toLocalDateISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Local calendar day for today.
 * @returns {string}
 */
export function todayISO() {
  return toLocalDateISO(new Date());
}

/**
 * Local calendar day for tomorrow (day arithmetic done on local components,
 * pelo que atravessa mudanças de hora / fim de mês sem erro).
 * @returns {string}
 */
export function tomorrowISO() {
  const now = new Date();
  return toLocalDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}

/**
 * Adds days/weeks/months to an ISO date-only string, using local calendar math.
 * @param {string} dateISO - 'YYYY-MM-DD'
 * @param {'daily'|'weekly'|'monthly'} recurring
 * @returns {string} the next ISO date-only string
 */
export function nextRecurrenceDate(dateISO, recurring) {
  const parts = String(dateISO || '').slice(0, 10).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return tomorrowISO();
  }
  if (recurring === 'weekly') return toLocalDateISO(new Date(y, m, d + 7));
  if (recurring === 'monthly') return toLocalDateISO(new Date(y, m + 1, d));
  return toLocalDateISO(new Date(y, m, d + 1));
}

/**
 * Normalizes any accepted date input to an ISO date-only string.
 * @param {string|Date} [value]
 * @returns {string}
 */
function normalizeDueDate(value) {
  if (!value) return todayISO();
  if (value instanceof Date) return toLocalDateISO(value);
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return toLocalDateISO(parsed);
  return todayISO();
}

/**
 * TasksRepository manages Dexie CRUD for maintenance tasks (hoje / amanhã)
 * and enqueues every mutation to sync_queue inside the same transaction.
 */
export class TasksRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Returns all non-deleted tasks, undone first, then by dueDate then priority.
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.tasks.toArray();
    return items.filter(t => !t.deleted).sort(compareTasks);
  }

  /**
   * Gets a single task by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.tasks.get(id);
  }

  /**
   * Returns all non-deleted tasks due on a given local calendar day.
   * @param {string|Date} dateISO - 'YYYY-MM-DD' or a Date
   * @returns {Promise<Array>}
   */
  async getForDate(dateISO) {
    const day = normalizeDueDate(dateISO);
    const items = await this.db.tasks.where('dueDate').equals(day).toArray();
    return items.filter(t => !t.deleted).sort(compareTasks);
  }

  /**
   * Tasks due today (local day).
   * @returns {Promise<Array>}
   */
  async getToday() {
    return await this.getForDate(todayISO());
  }

  /**
   * Tasks due tomorrow (local day).
   * @returns {Promise<Array>}
   */
  async getTomorrow() {
    return await this.getForDate(tomorrowISO());
  }

  /**
   * Undone tasks whose dueDate is strictly before today (local day).
   * @returns {Promise<Array>}
   */
  async getOverdue() {
    const today = todayISO();
    const items = await this.db.tasks.toArray();
    return items
      .filter(t => !t.deleted && !t.done && t.dueDate && String(t.dueDate).slice(0, 10) < today)
      .sort(compareTasks);
  }

  /**
   * Creates a task and enqueues a CREATE sync action.
   * @param {Object} data
   * @param {string} data.title - obrigatório
   * @param {string} [data.notes]
   * @param {string|Date} [data.dueDate] - por omissão, hoje
   * @param {string} [data.locationId]
   * @param {string} [data.locationName]
   * @param {string} [data.equipmentId]
   * @param {string} [data.priority] - 'critical'|'medium'|'low'
   * @param {null|'daily'|'weekly'|'monthly'} [data.recurring]
   * @returns {Promise<Object>} The created task
   */
  async create(data) {
    if (!data || !data.title || !String(data.title).trim()) {
      throw new Error('O título da tarefa é obrigatório');
    }

    const id = data.id || generateUUID();
    const now = new Date().toISOString();
    const recurring = TASK_RECURRENCES.includes(data.recurring) ? (data.recurring || null) : null;

    const taskObj = {
      id,
      title: String(data.title).trim(),
      notes: data.notes ? String(data.notes).trim() : '',
      dueDate: normalizeDueDate(data.dueDate),
      locationId: data.locationId || '',
      locationName: data.locationName || '',
      equipmentId: data.equipmentId || '',
      done: data.done ? 1 : 0,
      doneAt: data.doneAt || null,
      priority: TASK_PRIORITIES.includes(data.priority) ? data.priority : 'medium',
      recurring,
      createdAt: data.createdAt || now,
      updatedAt: now,
      synced: 0,
      deleted: 0
    };

    await this.db.transaction('rw', [this.db.tasks, this.db.sync_queue], async () => {
      await this.db.tasks.put(taskObj);
      await this.db.sync_queue.add({
        entityType: 'task',
        entityId: id,
        action: 'CREATE',
        payload: taskObj,
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return taskObj;
  }

  /**
   * Updates a task by ID and enqueues an UPDATE sync action.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>} The updated task
   */
  async update(id, updates) {
    if (!id) throw new Error('O ID da tarefa é obrigatório');
    const existing = await this.db.tasks.get(id);
    if (!existing) throw new Error(`Tarefa ${id} não encontrada`);

    const patch = { ...(updates || {}) };
    if (patch.title !== undefined) patch.title = String(patch.title).trim();
    if (patch.notes !== undefined) patch.notes = String(patch.notes).trim();
    if (patch.dueDate !== undefined) patch.dueDate = normalizeDueDate(patch.dueDate);
    if (patch.done !== undefined) patch.done = patch.done ? 1 : 0;
    if (patch.priority !== undefined && !TASK_PRIORITIES.includes(patch.priority)) delete patch.priority;
    if (patch.recurring !== undefined && !TASK_RECURRENCES.includes(patch.recurring)) delete patch.recurring;

    patch.updatedAt = new Date().toISOString();
    patch.synced = 0;

    const updated = { ...existing, ...patch };

    await this.db.transaction('rw', [this.db.tasks, this.db.sync_queue], async () => {
      await this.db.tasks.put(updated);
      await this.db.sync_queue.add({
        entityType: 'task',
        entityId: id,
        action: 'UPDATE',
        payload: { id, ...patch },
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return updated;
  }

  /**
   * Toggles the done flag of a task. When a recurring task is marked done,
   * the next occurrence is created automatically in the same transaction.
   *
   * @param {string} id
   * @returns {Promise<{task: Object, nextTask: Object|null}>}
   */
  async toggleDone(id) {
    if (!id) throw new Error('O ID da tarefa é obrigatório');
    const existing = await this.db.tasks.get(id);
    if (!existing) throw new Error(`Tarefa ${id} não encontrada`);

    const now = new Date().toISOString();
    const nowDone = existing.done ? 0 : 1;

    const updated = {
      ...existing,
      done: nowDone,
      doneAt: nowDone ? now : null,
      updatedAt: now,
      synced: 0
    };

    let nextTask = null;
    if (nowDone && existing.recurring) {
      nextTask = {
        id: generateUUID(),
        title: existing.title,
        notes: existing.notes || '',
        dueDate: nextRecurrenceDate(existing.dueDate, existing.recurring),
        locationId: existing.locationId || '',
        locationName: existing.locationName || '',
        equipmentId: existing.equipmentId || '',
        done: 0,
        doneAt: null,
        priority: existing.priority || 'medium',
        recurring: existing.recurring,
        createdAt: now,
        updatedAt: now,
        synced: 0,
        deleted: 0
      };
    }

    await this.db.transaction('rw', [this.db.tasks, this.db.sync_queue], async () => {
      await this.db.tasks.put(updated);
      await this.db.sync_queue.add({
        entityType: 'task',
        entityId: id,
        action: 'UPDATE',
        payload: { id, done: updated.done, doneAt: updated.doneAt, updatedAt: now },
        timestamp: Date.now(),
        retryCount: 0
      });
      if (nextTask) {
        await this.db.tasks.put(nextTask);
        await this.db.sync_queue.add({
          entityType: 'task',
          entityId: nextTask.id,
          action: 'CREATE',
          payload: nextTask,
          timestamp: Date.now(),
          retryCount: 0
        });
      }
    });

    return { task: updated, nextTask };
  }

  /**
   * Pushes a task's dueDate to tomorrow (local day).
   * @param {string} id
   * @returns {Promise<Object>} The updated task
   */
  async moveToTomorrow(id) {
    return await this.update(id, { dueDate: tomorrowISO() });
  }

  /**
   * Soft-deletes a task (deleted=1) and enqueues a DELETE sync action.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.tasks, this.db.sync_queue], async () => {
      await this.db.tasks.update(id, {
        deleted: 1,
        synced: 0,
        updatedAt: new Date().toISOString()
      });
      await this.db.sync_queue.add({
        entityType: 'task',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Marks a task as synced.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.tasks.update(id, { synced: 1 });
  }
}

/** Sort helper: undone first, earliest dueDate first, then critical first. */
function compareTasks(a, b) {
  if ((a.done ? 1 : 0) !== (b.done ? 1 : 0)) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
  const da = String(a.dueDate || '');
  const dbb = String(b.dueDate || '');
  if (da !== dbb) return da < dbb ? -1 : 1;
  const rank = { critical: 0, medium: 1, low: 2 };
  const ra = rank[a.priority] !== undefined ? rank[a.priority] : 1;
  const rb = rank[b.priority] !== undefined ? rank[b.priority] : 1;
  if (ra !== rb) return ra - rb;
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

export const tasksRepo = new TasksRepository();
