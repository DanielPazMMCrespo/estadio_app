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

/** Unidades de medida aceites no stock. */
export const TOOL_UNITS = ['un', 'm', 'kg', 'L', 'cx'];

/**
 * Stock inicial plausível de ferramentas e consumíveis do estádio.
 * Os cinco primeiros reaproveitam os nomes/IDs de DEFAULT_MATERIALS
 * (src/db/materialsRepo.js) para que as duas listas falem a mesma língua.
 */
export const DEFAULT_TOOLS = [
  // --- Reaproveitados de DEFAULT_MATERIALS ---
  { id: 'TOOL_PAINT', name: 'Tinta de Marcação', unit: 'L', qty: 24, minQty: 6, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Tinta branca para linhas do relvado' },
  { id: 'TOOL_WRENCH', name: 'Chave Inglesa', unit: 'un', qty: 4, minQty: 2, locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', notes: 'Jogo ajustável 6" a 12"' },
  { id: 'TOOL_SCREWDRIVER', name: 'Chave de Fendas', unit: 'un', qty: 8, minQty: 3, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: 'Fendas e Philips, cabo isolado 1000V' },
  { id: 'TOOL_TAPE', name: 'Fita Isoladora', unit: 'un', qty: 15, minQty: 5, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: 'Rolos 19mm preta' },
  { id: 'TOOL_SILICONE', name: 'Silicone', unit: 'un', qty: 10, minQty: 4, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Cartuchos transparentes 280ml' },

  // --- Iluminação ---
  { id: 'TOOL_LAMP_LED', name: 'Lâmpada de Projetor LED 400W', unit: 'un', qty: 6, minQty: 2, locationId: 'LOC_EXT_LIGHTS', locationName: 'Torres de Iluminação do Estádio', notes: 'Sobressalentes das 4 torres' },
  { id: 'TOOL_LAMP_E27', name: 'Lâmpada LED E27 15W', unit: 'un', qty: 40, minQty: 12, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Corredores e sanitários' },
  { id: 'TOOL_FLOOD_DRIVER', name: 'Driver de Projetor LED', unit: 'un', qty: 3, minQty: 1, locationId: 'LOC_EXT_LIGHTS', locationName: 'Torres de Iluminação do Estádio', notes: '' },

  // --- Rega e água ---
  { id: 'TOOL_SPRINKLER', name: 'Aspersor de Rega Retrátil', unit: 'un', qty: 9, minQty: 3, locationId: 'LOC_PITCH_IRRIGATION', locationName: 'Sistema de Rega & Aspersores', notes: 'Modelo de setor ajustável' },
  { id: 'TOOL_SOLENOID', name: 'Eletroválvula de Rega 24V', unit: 'un', qty: 5, minQty: 2, locationId: 'LOC_PITCH_IRRIGATION', locationName: 'Sistema de Rega & Aspersores', notes: '' },
  { id: 'TOOL_SEAL', name: 'Vedante de Roscas (teflon)', unit: 'un', qty: 12, minQty: 4, locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', notes: 'Rolos PTFE 12mm' },
  { id: 'TOOL_HOSE', name: 'Mangueira de Rega', unit: 'm', qty: 60, minQty: 20, locationId: 'LOC_PITCH_IRRIGATION', locationName: 'Sistema de Rega & Aspersores', notes: 'Reforçada 3/4"' },
  { id: 'TOOL_PVC_GLUE', name: 'Cola de PVC', unit: 'un', qty: 4, minQty: 2, locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', notes: '' },

  // --- Elétrico ---
  { id: 'TOOL_BREAKER', name: 'Disjuntor 16A Bipolar', unit: 'un', qty: 7, minQty: 3, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: 'Curva C' },
  { id: 'TOOL_BREAKER_DIFF', name: 'Diferencial 40A 30mA', unit: 'un', qty: 3, minQty: 1, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: '' },
  { id: 'TOOL_CABLE', name: 'Cabo Elétrico 3x2,5mm²', unit: 'm', qty: 120, minQty: 30, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: 'Rolo VV 3G2,5' },
  { id: 'TOOL_TERMINALS', name: 'Terminais e Abraçadeiras', unit: 'cx', qty: 5, minQty: 2, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: 'Caixas mistas' },
  { id: 'TOOL_MULTIMETER', name: 'Multímetro Digital', unit: 'un', qty: 2, minQty: 1, locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', notes: '' },

  // --- Relvado e desporto ---
  { id: 'TOOL_PITCH_BRUSH', name: 'Escova de Relvado', unit: 'un', qty: 3, minQty: 1, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Escova de arrasto para relva sintética' },
  { id: 'TOOL_GOAL_NET', name: 'Rede de Baliza', unit: 'un', qty: 4, minQty: 2, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Reserva para balizas principais' },
  { id: 'TOOL_GRASS_SEED', name: 'Semente de Relva', unit: 'kg', qty: 50, minQty: 15, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Mistura de ressemeadura' },
  { id: 'TOOL_FERTILIZER', name: 'Fertilizante de Relvado', unit: 'kg', qty: 75, minQty: 25, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'NPK 20-5-10' },

  // --- Diversos / segurança ---
  { id: 'TOOL_GLOVES', name: 'Luvas de Proteção', unit: 'un', qty: 20, minQty: 8, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Pares, tamanho 9 e 10' },
  { id: 'TOOL_DRILL_BITS', name: 'Brocas para Betão', unit: 'cx', qty: 3, minQty: 1, locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', notes: 'Jogo 5 a 12mm' },
  { id: 'TOOL_DIESEL', name: 'Gasóleo para Gerador', unit: 'L', qty: 200, minQty: 80, locationId: 'LOC_EXT_GENERATOR', locationName: 'Grupo Gerador de Emergência', notes: 'Depósito de apoio' }
];

/**
 * ToolsRepository manages the tool/consumable stock and its movement ledger.
 * Cada mutação escreve também na sync_queue dentro da MESMA transação.
 */
export class ToolsRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Returns all non-deleted tools sorted by name (pt collation).
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.tools.toArray();
    return items
      .filter(t => !t.deleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  /**
   * Gets a single tool by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.tools.get(id);
  }

  /**
   * Creates a tool stock entry.
   * @param {Object} data
   * @param {string} data.name - obrigatório
   * @param {'un'|'m'|'kg'|'L'|'cx'} [data.unit]
   * @param {number} [data.qty]
   * @param {number} [data.minQty]
   * @param {string} [data.locationId]
   * @param {string} [data.locationName]
   * @param {string} [data.notes]
   * @returns {Promise<Object>} The created tool
   */
  async create(data) {
    if (!data || !data.name || !String(data.name).trim()) {
      throw new Error('O nome da ferramenta é obrigatório');
    }

    const id = data.id || generateUUID();
    const now = new Date().toISOString();

    const toolObj = {
      id,
      name: String(data.name).trim(),
      unit: TOOL_UNITS.includes(data.unit) ? data.unit : 'un',
      qty: toQty(data.qty, 0),
      minQty: toQty(data.minQty, 0),
      locationId: data.locationId || '',
      locationName: data.locationName || '',
      notes: data.notes ? String(data.notes).trim() : '',
      createdAt: data.createdAt || now,
      updatedAt: now,
      synced: 0,
      deleted: 0
    };

    await this.db.transaction('rw', [this.db.tools, this.db.sync_queue], async () => {
      await this.db.tools.put(toolObj);
      await this.db.sync_queue.add({
        entityType: 'tool',
        entityId: id,
        action: 'CREATE',
        payload: toolObj,
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return toolObj;
  }

  /**
   * Updates a tool by ID. Para mexer no stock usa take()/restock().
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>} The updated tool
   */
  async update(id, updates) {
    if (!id) throw new Error('O ID da ferramenta é obrigatório');
    const existing = await this.db.tools.get(id);
    if (!existing) throw new Error(`Ferramenta ${id} não encontrada`);

    const patch = { ...(updates || {}) };
    if (patch.name !== undefined) patch.name = String(patch.name).trim();
    if (patch.notes !== undefined) patch.notes = String(patch.notes).trim();
    if (patch.unit !== undefined && !TOOL_UNITS.includes(patch.unit)) delete patch.unit;
    if (patch.qty !== undefined) {
      const q = toQty(patch.qty, existing.qty);
      if (q < 0) throw new Error('A quantidade em stock não pode ser negativa');
      patch.qty = q;
    }
    if (patch.minQty !== undefined) patch.minQty = Math.max(0, toQty(patch.minQty, existing.minQty));

    patch.updatedAt = new Date().toISOString();
    patch.synced = 0;

    const updated = { ...existing, ...patch };

    await this.db.transaction('rw', [this.db.tools, this.db.sync_queue], async () => {
      await this.db.tools.put(updated);
      await this.db.sync_queue.add({
        entityType: 'tool',
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
   * Soft-deletes a tool (deleted=1).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.tools, this.db.sync_queue], async () => {
      await this.db.tools.update(id, {
        deleted: 1,
        synced: 0,
        updatedAt: new Date().toISOString()
      });
      await this.db.sync_queue.add({
        entityType: 'tool',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Takes `amount` units out of stock atomically (read-and-write in one transaction)
   * and writes the corresponding tool_moves ledger line.
   * Nunca deixa o stock negativo — lança Error em português.
   *
   * @param {string} toolId
   * @param {number} amount - quantidade positiva a retirar
   * @param {string} [reason] - motivo do consumo
   * @param {string} [reportId] - avaria onde foi gasta
   * @returns {Promise<{tool: Object, move: Object}>}
   */
  async take(toolId, amount, reason = '', reportId = null) {
    return await this.#applyMove(toolId, -Math.abs(toQty(amount, 0)), reason, reportId, 'TAKE');
  }

  /**
   * Puts `amount` units back into stock atomically and writes the ledger line.
   * @param {string} toolId
   * @param {number} amount - quantidade positiva a repor
   * @param {string} [reason]
   * @returns {Promise<{tool: Object, move: Object}>}
   */
  async restock(toolId, amount, reason = '') {
    return await this.#applyMove(toolId, Math.abs(toQty(amount, 0)), reason, null, 'RESTOCK');
  }

  /**
   * Atomic stock mutation shared by take() and restock().
   * @param {string} toolId
   * @param {number} delta
   * @param {string} reason
   * @param {string|null} reportId
   * @param {'TAKE'|'RESTOCK'} action
   * @returns {Promise<{tool: Object, move: Object}>}
   */
  async #applyMove(toolId, delta, reason, reportId, action) {
    if (!toolId) throw new Error('O ID da ferramenta é obrigatório');
    if (!Number.isFinite(delta) || delta === 0) {
      throw new Error('A quantidade tem de ser um número maior do que zero');
    }

    const now = new Date().toISOString();
    let resultTool = null;
    let resultMove = null;

    await this.db.transaction(
      'rw',
      [this.db.tools, this.db.tool_moves, this.db.sync_queue],
      async () => {
        const existing = await this.db.tools.get(toolId);
        if (!existing) throw new Error(`Ferramenta ${toolId} não encontrada`);

        const before = toQty(existing.qty, 0);
        const qtyAfter = roundQty(before + delta);

        if (qtyAfter < 0) {
          throw new Error(
            `Stock insuficiente de "${existing.name}": existem ${before} ${existing.unit || 'un'} e foram pedidos ${Math.abs(delta)} ${existing.unit || 'un'}`
          );
        }

        const updatedTool = {
          ...existing,
          qty: qtyAfter,
          updatedAt: now,
          synced: 0
        };

        const move = {
          toolId,
          delta,
          qtyAfter,
          reason: reason ? String(reason).trim() : '',
          reportId: reportId || null,
          at: now,
          synced: 0
        };

        await this.db.tools.put(updatedTool);
        const moveId = await this.db.tool_moves.add(move);
        move.id = moveId;

        await this.db.sync_queue.add({
          entityType: 'tool_move',
          entityId: String(moveId),
          action,
          payload: { ...move, toolName: existing.name },
          timestamp: Date.now(),
          retryCount: 0
        });

        resultTool = updatedTool;
        resultMove = move;
      }
    );

    return { tool: resultTool, move: resultMove };
  }

  /**
   * Tools at or below their minimum quantity (aviso de stock baixo).
   * @returns {Promise<Array>}
   */
  async getLowStock() {
    const items = await this.getAll();
    return items
      .filter(t => toQty(t.qty, 0) <= toQty(t.minQty, 0))
      .sort((a, b) => (toQty(a.qty, 0) - toQty(a.minQty, 0)) - (toQty(b.qty, 0) - toQty(b.minQty, 0)));
  }

  /**
   * Movement history for a tool, most recent first.
   * @param {string} toolId
   * @param {number} [limit=50]
   * @returns {Promise<Array>}
   */
  async getMoves(toolId, limit = 50) {
    if (!toolId) return [];
    const moves = await this.db.tool_moves.where('toolId').equals(toolId).toArray();
    moves.sort((a, b) => {
      const diff = new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime();
      if (diff !== 0) return diff;
      return (b.id || 0) - (a.id || 0);
    });
    const max = Number(limit);
    return Number.isFinite(max) && max > 0 ? moves.slice(0, max) : moves;
  }

  /**
   * Marks a tool as synced.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.tools.update(id, { synced: 1 });
  }

  /**
   * Seeds the default stadium tool stock if the table is empty.
   * @returns {Promise<Array>} The tools present after seeding
   */
  async seedDefaults() {
    const count = await this.db.tools.count();
    if (count > 0) return await this.getAll();

    const now = new Date().toISOString();
    const items = DEFAULT_TOOLS.map(t => ({
      id: t.id,
      name: t.name,
      unit: TOOL_UNITS.includes(t.unit) ? t.unit : 'un',
      qty: toQty(t.qty, 0),
      minQty: toQty(t.minQty, 0),
      locationId: t.locationId || '',
      locationName: t.locationName || '',
      notes: t.notes || '',
      createdAt: now,
      updatedAt: now,
      synced: 1,
      deleted: 0
    }));

    await this.db.tools.bulkPut(items);
    return items;
  }
}

/** Coerces a value to a finite number, falling back to `fallback`. */
function toQty(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback) || 0;
}

/** Rounds to 3 decimals to kill floating point dust on m/kg/L quantities. */
function roundQty(value) {
  return Math.round(value * 1000) / 1000;
}

export const toolsRepo = new ToolsRepository();
