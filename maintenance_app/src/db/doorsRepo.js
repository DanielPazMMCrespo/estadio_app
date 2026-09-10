import { db as defaultDb } from './db.js';
import { DEFAULT_DOORS } from '../data/portas.js';

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

/** Lados do estádio que existem no chaveiro. Não há norte no Excel. */
export const DOOR_SIDES = ['nascente', 'poente', 'sul'];

/** Pisos usados pelo chaveiro, do mais baixo ao mais alto. */
export const DOOR_FLOORS = [-1, 0, 1, 2, 3, 4];

/** Tipos de porta, já normalizados (minúsculas, sem acentos). */
export const DOOR_TYPES = [
  'tecnica',
  'wc',
  'arrecadacao',
  'passagem',
  'persiana',
  'camarote',
  'posto_medico',
  'gabinete',
  'desportiva',
  'bar',
  'geral'
];

/**
 * Estados de uma porta. São os mesmos do equipamento de propósito: o técnico
 * já conhece estas quatro palavras do ecrã de Equipamento e não vale a pena
 * inventar um vocabulário novo para a mesma ideia.
 */
export const DOOR_STATUSES = ['ok', 'avariado', 'manutencao', 'abatido'];

/** Lado do Excel para o setor real de STADIUM_HIERARCHY. */
const SIDE_TO_SECTOR = {
  nascente: { sectorId: 'SEC_NASCENTE', sectorCode: 'LOC_EAST_STAND', sectorName: 'Bancada Nascente' },
  poente: { sectorId: 'SEC_POENTE', sectorCode: 'LOC_WEST_STAND', sectorName: 'Bancada Poente (Principal & VIP)' },
  sul: { sectorId: 'SEC_SOUTH', sectorCode: 'LOC_SOUTH_STAND', sectorName: 'Topo Sul' }
};

/** Combining diacritical marks range (U+0300..U+036F). */
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercases and strips diacritics so "arrecadacao" encontra "Arrecadação". */
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();
}

/**
 * Ordena portas pelo número, mas de forma humana: a porta 9 vem antes da 10,
 * e a "13a" vem logo a seguir à 13. Uma ordenação de texto punha a 10 antes
 * da 9 e o técnico perdia a porta na lista.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareDoorNumbers(a, b) {
  const na = parseInt(String(a || ''), 10);
  const nb = parseInt(String(b || ''), 10);
  if (Number.isNaN(na) && Number.isNaN(nb)) return String(a).localeCompare(String(b), 'pt');
  if (Number.isNaN(na)) return 1;
  if (Number.isNaN(nb)) return -1;
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'pt');
}

/**
 * DoorsRepository — o chaveiro do estádio.
 *
 * Cada mutação escreve também na sync_queue dentro da MESMA transação, tal
 * como os outros repositórios. Apagar é sempre suave (deleted = 1).
 */
export class DoorsRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Todas as portas por ordem de número.
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.doors.toArray();
    return items
      .filter(d => !d.deleted)
      .sort((a, b) => compareDoorNumbers(a.numero, b.numero));
  }

  /**
   * Uma porta pelo id interno.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.doors.get(id);
  }

  /**
   * Uma porta pelo número do chaveiro. Aceita "13" ou "13a".
   * @param {string|number} numero
   * @returns {Promise<Object|undefined>}
   */
  async getByNumero(numero) {
    const n = String(numero == null ? '' : numero).trim();
    if (!n) return undefined;
    const items = await this.db.doors.where('numero').equals(n).toArray();
    return items.find(d => !d.deleted);
  }

  /**
   * Portas de um setor (SEC_NASCENTE, SEC_POENTE, SEC_SOUTH).
   * @param {string} sectorId
   * @returns {Promise<Array>}
   */
  async getBySector(sectorId) {
    if (!sectorId) return [];
    const items = await this.db.doors.where('sectorId').equals(sectorId).toArray();
    return items
      .filter(d => !d.deleted)
      .sort((a, b) => compareDoorNumbers(a.numero, b.numero));
  }

  /**
   * Portas de um lado do estádio.
   * @param {string} lado
   * @returns {Promise<Array>}
   */
  async getBySide(lado) {
    if (!lado) return [];
    const items = await this.db.doors.where('lado').equals(String(lado).toLowerCase()).toArray();
    return items
      .filter(d => !d.deleted)
      .sort((a, b) => compareDoorNumbers(a.numero, b.numero));
  }

  /**
   * Portas de um piso.
   * @param {number} piso
   * @returns {Promise<Array>}
   */
  async getByFloor(piso) {
    const n = Number(piso);
    if (!Number.isFinite(n)) return [];
    const items = await this.db.doors.where('piso').equals(n).toArray();
    return items
      .filter(d => !d.deleted)
      .sort((a, b) => compareDoorNumbers(a.numero, b.numero));
  }

  /**
   * Portas que estão avariadas.
   * @returns {Promise<Array>}
   */
  async getBroken() {
    const items = await this.getAll();
    return items.filter(d => d.status === 'avariado');
  }

  /**
   * Cria uma porta nova. O técnico pode encontrar uma que não está no Excel.
   * @param {Object} data
   * @param {string} data.numero - obrigatório
   * @returns {Promise<Object>}
   */
  async create(data) {
    if (!data || !String(data.numero || '').trim()) {
      throw new Error('O número da porta é obrigatório');
    }

    const numero = String(data.numero).trim();
    const lado = DOOR_SIDES.includes(data.lado) ? data.lado : 'nascente';
    const setor = SIDE_TO_SECTOR[lado];
    const piso = Number.isFinite(Number(data.piso)) ? Number(data.piso) : 0;
    const descricao = data.descricao ? String(data.descricao).trim() : '';
    const id = data.id || generateUUID();
    const now = new Date().toISOString();

    const doorObj = {
      id,
      numero,
      numeroAntigo: data.numeroAntigo ? String(data.numeroAntigo).trim() : '',
      lado,
      piso,
      descricao,
      tipo: DOOR_TYPES.includes(data.tipo) ? data.tipo : 'geral',
      areaOriginal: data.areaOriginal ? String(data.areaOriginal).trim() : '',
      sectorId: setor.sectorId,
      sectorCode: setor.sectorCode,
      sectorName: setor.sectorName,
      nome: data.nome ? String(data.nome).trim() : ('Porta ' + numero + (descricao ? ' - ' + descricao : '')),
      status: DOOR_STATUSES.includes(data.status) ? data.status : 'ok',
      notas: data.notas ? String(data.notas).trim() : '',
      createdAt: data.createdAt || now,
      updatedAt: now,
      synced: 0,
      deleted: 0
    };

    await this.db.transaction('rw', [this.db.doors, this.db.sync_queue], async () => {
      await this.db.doors.put(doorObj);
      await this.db.sync_queue.add({
        entityType: 'door',
        entityId: id,
        action: 'CREATE',
        payload: doorObj,
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return doorObj;
  }

  /**
   * Atualiza uma porta.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async update(id, updates) {
    if (!id) throw new Error('O ID da porta é obrigatório');
    const existing = await this.db.doors.get(id);
    if (!existing) throw new Error(`Porta ${id} não encontrada`);

    const patch = { ...(updates || {}) };
    ['numero', 'numeroAntigo', 'descricao', 'nome', 'notas'].forEach(field => {
      if (patch[field] !== undefined) patch[field] = String(patch[field]).trim();
    });
    if (patch.tipo !== undefined && !DOOR_TYPES.includes(patch.tipo)) {
      delete patch.tipo;
    }
    if (patch.lado !== undefined) {
      if (!DOOR_SIDES.includes(patch.lado)) {
        delete patch.lado;
      } else {
        const setor = SIDE_TO_SECTOR[patch.lado];
        patch.sectorId = setor.sectorId;
        patch.sectorCode = setor.sectorCode;
        patch.sectorName = setor.sectorName;
      }
    }
    if (patch.piso !== undefined) {
      const n = Number(patch.piso);
      if (Number.isFinite(n)) patch.piso = n;
      else delete patch.piso;
    }
    if (patch.status !== undefined && !DOOR_STATUSES.includes(patch.status)) {
      throw new Error(`Estado de porta inválido: ${patch.status}`);
    }

    patch.updatedAt = new Date().toISOString();
    patch.synced = 0;

    const updated = { ...existing, ...patch };

    await this.db.transaction('rw', [this.db.doors, this.db.sync_queue], async () => {
      await this.db.doors.put(updated);
      await this.db.sync_queue.add({
        entityType: 'door',
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
   * Muda o estado de uma porta.
   * @param {string} id
   * @param {'ok'|'avariado'|'manutencao'|'abatido'} status
   * @returns {Promise<Object>}
   */
  async setStatus(id, status) {
    if (!DOOR_STATUSES.includes(status)) {
      throw new Error(`Estado de porta inválido: ${status}`);
    }
    return await this.update(id, { status });
  }

  /**
   * Apaga uma porta de forma suave (deleted = 1).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.doors, this.db.sync_queue], async () => {
      await this.db.doors.update(id, {
        deleted: 1,
        synced: 0,
        updatedAt: new Date().toISOString()
      });
      await this.db.sync_queue.add({
        entityType: 'door',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Procura por número, número antigo, descrição, tipo, lado ou setor.
   * Quem escreve só um número quer a porta com esse número no topo da lista.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const q = normalizeText(query);
    if (!q) return await this.getAll();

    const items = await this.getAll();
    const hits = items.filter(d =>
      normalizeText(d.numero).includes(q) ||
      normalizeText(d.numeroAntigo).includes(q) ||
      normalizeText(d.descricao).includes(q) ||
      normalizeText(d.areaOriginal).includes(q) ||
      normalizeText(d.tipo).includes(q) ||
      normalizeText(d.lado).includes(q) ||
      normalizeText(d.sectorName).includes(q)
    );

    return hits.sort((a, b) => {
      const exactA = normalizeText(a.numero) === q || normalizeText(a.numeroAntigo) === q;
      const exactB = normalizeText(b.numero) === q || normalizeText(b.numeroAntigo) === q;
      if (exactA !== exactB) return exactA ? -1 : 1;
      return compareDoorNumbers(a.numero, b.numero);
    });
  }

  /**
   * Marca uma porta como sincronizada.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.doors.update(id, { synced: 1 });
  }

  /**
   * Conta portas por lado, por piso e por estado. Serve o topo do ecrã.
   * @returns {Promise<Object>}
   */
  async getStats() {
    const items = await this.getAll();
    const porLado = {};
    const porPiso = {};
    const porEstado = {};
    for (const d of items) {
      porLado[d.lado] = (porLado[d.lado] || 0) + 1;
      porPiso[d.piso] = (porPiso[d.piso] || 0) + 1;
      porEstado[d.status] = (porEstado[d.status] || 0) + 1;
    }
    return { total: items.length, porLado, porPiso, porEstado };
  }

  /**
   * Semeia as 464 portas do chaveiro se a tabela estiver vazia.
   * Os ids são fixos, por isso correr isto duas vezes não duplica nada.
   * @returns {Promise<Array>}
   */
  async seedDefaults() {
    const count = await this.db.doors.count();
    if (count > 0) return await this.getAll();

    const now = new Date().toISOString();
    const items = DEFAULT_DOORS.map(d => ({
      id: d.id,
      numero: d.numero,
      numeroAntigo: d.numeroAntigo || '',
      lado: d.lado,
      piso: Number(d.piso),
      descricao: d.descricao || '',
      tipo: DOOR_TYPES.includes(d.tipo) ? d.tipo : 'geral',
      areaOriginal: d.areaOriginal || '',
      sectorId: d.sectorId,
      sectorCode: d.sectorCode,
      sectorName: d.sectorName,
      nome: d.nome,
      status: DOOR_STATUSES.includes(d.status) ? d.status : 'ok',
      notas: '',
      createdAt: now,
      updatedAt: now,
      synced: 1,
      deleted: 0
    }));

    await this.db.doors.bulkPut(items);
    return items;
  }
}

export const doorsRepo = new DoorsRepository();
