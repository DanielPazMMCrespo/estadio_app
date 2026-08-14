import Dexie from 'dexie';

/**
 * @typedef {Object} PhotoItem
 * @property {string} id - Unique photo identifier
 * @property {Blob|ArrayBuffer|Uint8Array|string} blobData - Canvas compressed JPEG blob, ArrayBuffer, Uint8Array, or dataURL
 * @property {string} [url] - Optional alternative reference for blobData
 * @property {string} type - Photo type: 'before' | 'after' | 'work'
 * @property {string} [mimeType] - MIME type, defaults to 'image/jpeg'
 * @property {string} createdAt - ISO 8601 creation timestamp
 */

/**
 * Helper to check if a value is a Blob or File (cross-realm safe).
 */
function isBlob(val) {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof Blob || val.constructor?.name === 'Blob' || val.constructor?.name === 'File') {
    return true;
  }
  return typeof val.size === 'number' && typeof val.type === 'string' && typeof val.slice === 'function' && typeof val.byteLength !== 'number';
}

/**
 * Helper to check if a value is an ArrayBuffer (cross-realm safe).
 */
function isArrayBuffer(val) {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof ArrayBuffer || Object.prototype.toString.call(val) === '[object ArrayBuffer]') {
    return true;
  }
  return typeof val.byteLength === 'number' && typeof val.slice === 'function' && !ArrayBuffer.isView(val);
}

/**
 * Helper to check if a value is a TypedArray view (cross-realm safe).
 */
function isTypedArray(val) {
  if (!val || typeof val !== 'object') return false;
  return ArrayBuffer.isView(val) || (!!val.buffer && isArrayBuffer(val.buffer));
}

/**
 * Helper to convert Blob to ArrayBuffer across test harnesses and browser runtimes.
 */
async function blobToArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === 'function') {
    try {
      const ab = await blob.arrayBuffer();
      if (ab && ab.byteLength !== undefined) return ab;
    } catch (e) {
      // Fallback to FileReader
    }
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result || new ArrayBuffer(0));
        };
        reader.onerror = () => resolve(new ArrayBuffer(0));
        reader.readAsArrayBuffer(blob);
      } catch (e) {
        resolve(new ArrayBuffer(0));
      }
    });
  }
  return new ArrayBuffer(0);
}

/**
 * Normalizes a PhotoItem synchronously.
 * Captures mimeType and converts ArrayBuffers/TypedArrays to Uint8Array for IDB clone fidelity.
 *
 * @param {PhotoItem} photo
 * @returns {PhotoItem}
 */
export function normalizePhotoItemSync(photo) {
  if (!photo) return photo;
  const data = photo.blobData !== undefined ? photo.blobData : photo.url;
  const mimeType = photo.mimeType || (data && typeof data === 'object' && data.type) || 'image/jpeg';

  let blobData = data;
  if (isArrayBuffer(blobData)) {
    blobData = new Uint8Array(blobData);
  } else if (isTypedArray(blobData) && !(blobData instanceof Uint8Array)) {
    blobData = new Uint8Array(blobData.buffer, blobData.byteOffset, blobData.byteLength);
  }

  return {
    ...photo,
    blobData,
    mimeType
  };
}

/**
 * Normalizes a PhotoItem asynchronously.
 * Converts input Blob/File/ArrayBuffer objects to Uint8Array so they survive
 * structured cloning in fake-indexeddb and browser IDB engines with 100% fidelity.
 *
 * @param {PhotoItem} photo
 * @returns {Promise<PhotoItem>}
 */
export async function normalizePhotoItemAsync(photo) {
  if (!photo) return photo;
  const data = photo.blobData !== undefined ? photo.blobData : photo.url;
  if (data === undefined || data === null) return photo;

  const mimeType = photo.mimeType || (typeof data === 'object' && data.type) || 'image/jpeg';
  let normalizedData = data;

  if (isBlob(data)) {
    try {
      const ab = await blobToArrayBuffer(data);
      normalizedData = new Uint8Array(ab);
    } catch (err) {
      // Keep original data on failure
    }
  } else if (isArrayBuffer(data)) {
    normalizedData = new Uint8Array(data);
  } else if (isTypedArray(data) && !(data instanceof Uint8Array)) {
    normalizedData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  return {
    ...photo,
    blobData: normalizedData,
    mimeType
  };
}

/**
 * Normalizes an array of PhotoItems asynchronously.
 *
 * @param {PhotoItem[]} photos
 * @returns {Promise<PhotoItem[]>}
 */
export async function normalizePhotosAsync(photos) {
  if (!Array.isArray(photos)) return [];
  return Promise.all(photos.map(p => normalizePhotoItemAsync(p)));
}

/**
 * Safely extracts a native Blob from a PhotoItem regardless of whether blobData/url
 * is stored as a Uint8Array, ArrayBuffer, dataURL string, or Blob.
 *
 * @param {PhotoItem} photo
 * @returns {Blob}
 */
export function getPhotoBlob(photo) {
  if (!photo) {
    return new Blob([], { type: 'image/jpeg' });
  }

  const data = photo.blobData !== undefined ? photo.blobData : photo.url;
  const mimeType = photo.mimeType || (data && typeof data === 'object' && data.type) || 'image/jpeg';

  if (data === undefined || data === null) {
    return new Blob([], { type: mimeType });
  }

  // 1. Functional Blob or File object with valid size
  if (isBlob(data)) {
    if (typeof data.size === 'number' && data.size >= 0) {
      return data;
    }
  }

  // 2. TypedArray or Object with numeric length/properties from structured clone
  if (isTypedArray(data) || (data && typeof data.byteLength === 'number' && data.buffer)) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
    return new Blob([bytes], { type: mimeType });
  }

  // 3. ArrayBuffer
  if (isArrayBuffer(data)) {
    return new Blob([data], { type: mimeType });
  }

  // 4. Object with array-like indexed properties from fake-indexeddb clone (e.g. {0: 255, 1: 216, length: 8})
  if (data && typeof data === 'object' && typeof data.length === 'number') {
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data[i];
    }
    return new Blob([bytes], { type: mimeType });
  }

  // 5. Base64 dataURL string or plain Base64 string
  if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const parts = data.split(',');
      const match = parts[0].match(/:(.*?);/);
      const type = match ? match[1] : mimeType;
      const base64Str = parts[1] || '';
      try {
        const binaryStr = atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new Blob([bytes], { type });
      } catch (e) {
        return new Blob([data], { type });
      }
    } else {
      try {
        const binaryStr = atob(data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
      } catch (e) {
        return new Blob([data], { type: mimeType });
      }
    }
  }

  // Fallback for empty or unrecognized objects ({})
  return new Blob([], { type: mimeType });
}

/**
 * Safely extracts a Base64 dataURL string (data:image/jpeg;base64,...) from a PhotoItem.
 *
 * @param {PhotoItem} photo
 * @returns {string}
 */
export function getPhotoDataUrl(photo) {
  if (!photo) return '';
  const data = photo.blobData !== undefined ? photo.blobData : photo.url;
  if (data === undefined || data === null) return '';

  const mimeType = photo.mimeType || 'image/jpeg';

  if (typeof data === 'string') {
    if (data.startsWith('data:')) return data;
    return `data:${mimeType};base64,${data}`;
  }

  if (isArrayBuffer(data) || isTypedArray(data) || (data && typeof data === 'object' && typeof data.length === 'number')) {
    let bytes;
    if (data instanceof Uint8Array) {
      bytes = data;
    } else if (isTypedArray(data) || isArrayBuffer(data)) {
      bytes = new Uint8Array(isArrayBuffer(data) ? data : data.buffer);
    } else {
      bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        bytes[i] = data[i];
      }
    }
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  }

  return '';
}

/**
 * Safely extracts an ArrayBuffer from a PhotoItem.
 *
 * @param {PhotoItem} photo
 * @returns {Promise<ArrayBuffer>}
 */
export async function getPhotoArrayBuffer(photo) {
  if (!photo) return new ArrayBuffer(0);
  const data = photo.blobData !== undefined ? photo.blobData : photo.url;
  if (data === undefined || data === null) return new ArrayBuffer(0);

  if (isArrayBuffer(data)) return data;
  if (isTypedArray(data)) return data.buffer;

  if (data && typeof data === 'object' && typeof data.length === 'number') {
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data[i];
    }
    return bytes.buffer;
  }

  const blob = getPhotoBlob(photo);
  if (blob && typeof blob.arrayBuffer === 'function') {
    return await blob.arrayBuffer();
  }
  return new ArrayBuffer(0);
}

/**
 * Dexie Database Class for Estádio Municipal de Leiria Maintenance PWA
 */
export class EstadioMaintenanceDB extends Dexie {
  constructor(dbName = 'EstadioMaintenanceDB') {
    super(dbName);

    // Schema Version 1 Definition
    this.version(1).stores({
      reports: 'id, date, locationId, locationName, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount'
    });

    // Schema Version 2 — adds materials table
    this.version(2).stores({
      reports: 'id, date, locationId, locationName, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      materials: 'id, name, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount'
    });

    // Schema Version 3 — adds priority, status and sectorCode indexing
    this.version(3).stores({
      reports: 'id, date, locationId, locationName, priority, status, sectorCode, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      materials: 'id, name, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount'
    });

    // Schema Version 4 — adds tasks, notes, tools, tool_moves and equipment.
    // Existing stores are re-declared unchanged so Dexie keeps all v3 data intact.
    this.version(4).stores({
      reports: 'id, date, locationId, locationName, priority, status, sectorCode, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      materials: 'id, name, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount',
      // Tarefas para hoje/amanhã
      tasks: 'id, dueDate, locationId, equipmentId, done, priority, recurring, createdAt, updatedAt, synced, deleted, [done+dueDate]',
      // Notas soltas (texto, áudio, fotos)
      notes: 'id, pinned, locationId, createdAt, updatedAt, synced, deleted',
      // Stock de ferramentas
      tools: 'id, name, locationId, qty, minQty, createdAt, updatedAt, synced, deleted',
      // Movimentos de stock de ferramentas
      tool_moves: '++id, toolId, reportId, at, synced',
      // Registo de equipamento instalado no estádio
      equipment: 'id, name, category, locationId, status, serial, createdAt, updatedAt, synced, deleted'
    });

    // Object store table handles
    this.reports = this.table('reports');
    this.locations = this.table('locations');
    this.materials = this.table('materials');
    this.sync_queue = this.table('sync_queue');
    this.tasks = this.table('tasks');
    this.notes = this.table('notes');
    this.tools = this.table('tools');
    this.tool_moves = this.table('tool_moves');
    this.equipment = this.table('equipment');

    // Dexie table hooks for photo normalization
    this.reports.hook('creating', (primKey, obj, trans) => {
      if (obj && Array.isArray(obj.photos)) {
        obj.photos = obj.photos.map(normalizePhotoItemSync);
      }
    });

    this.reports.hook('updating', (mods, primKey, obj, trans) => {
      if (mods && Array.isArray(mods.photos)) {
        mods.photos = mods.photos.map(normalizePhotoItemSync);
      } else if (obj && Array.isArray(obj.photos)) {
        obj.photos = obj.photos.map(normalizePhotoItemSync);
      }
    });
  }
}

// Alias class for backwards compatibility/flexibility
export const EstadioDatabase = EstadioMaintenanceDB;

/** Single DB instance export */
export const db = new EstadioMaintenanceDB();

