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

/** Categorias de equipamento aceites. */
export const EQUIPMENT_CATEGORIES = [
  'iluminacao',
  'rega',
  'eletrico',
  'agua',
  'avac',
  'seguranca',
  'desporto',
  'outro'
];

/** Estados aceites de um equipamento. */
export const EQUIPMENT_STATUSES = ['ok', 'avariado', 'manutencao', 'abatido'];

/**
 * Registo de ativos instalados no Estádio Municipal de Leiria.
 * Os locationId referem-se aos IDs reais de STADIUM_HIERARCHY (locationsRepo.js).
 */
export const DEFAULT_EQUIPMENT = [
  // --- Iluminação ---
  { id: 'EQ_TOWER_NW', name: 'Torre de Iluminação Noroeste', category: 'iluminacao', locationId: 'LOC_EXT_LIGHTS', locationName: 'Torres de Iluminação do Estádio', brand: 'Philips', model: 'OptiVision LED gen3', serial: 'TRW-NW-0148', installedAt: '2019-07-15', warrantyUntil: '2029-07-15', status: 'ok', notes: '36 projetores LED, 1400 lux' },
  { id: 'EQ_TOWER_NE', name: 'Torre de Iluminação Nordeste', category: 'iluminacao', locationId: 'LOC_EXT_LIGHTS', locationName: 'Torres de Iluminação do Estádio', brand: 'Philips', model: 'OptiVision LED gen3', serial: 'TRW-NE-0149', installedAt: '2019-07-15', warrantyUntil: '2029-07-15', status: 'ok', notes: '36 projetores LED' },
  { id: 'EQ_TOWER_SW', name: 'Torre de Iluminação Sudoeste', category: 'iluminacao', locationId: 'LOC_EXT_LIGHTS', locationName: 'Torres de Iluminação do Estádio', brand: 'Philips', model: 'OptiVision LED gen3', serial: 'TRW-SW-0150', installedAt: '2019-07-15', warrantyUntil: '2029-07-15', status: 'manutencao', notes: '2 projetores fundidos no setor inferior' },
  { id: 'EQ_TOWER_SE', name: 'Torre de Iluminação Sudeste', category: 'iluminacao', locationId: 'LOC_EXT_LIGHTS', locationName: 'Torres de Iluminação do Estádio', brand: 'Philips', model: 'OptiVision LED gen3', serial: 'TRW-SE-0151', installedAt: '2019-07-15', warrantyUntil: '2029-07-15', status: 'ok', notes: '' },
  { id: 'EQ_LIGHT_EMERG_W', name: 'Iluminação de Emergência Poente', category: 'iluminacao', locationId: 'LOC_WEST_LIFTS', locationName: 'Elevadores & Acessos Poente', brand: 'Legrand', model: 'URA One', serial: 'URA-W-2210', installedAt: '2021-03-02', warrantyUntil: '2026-03-02', status: 'ok', notes: 'Blocos autónomos das escadas de emergência' },

  // --- Rega ---
  { id: 'EQ_IRRIG_CTRL', name: 'Central de Comando de Rega', category: 'rega', locationId: 'LOC_PITCH_IRRIGATION', locationName: 'Sistema de Rega & Aspersores', brand: 'Rain Bird', model: 'ESP-LXME2', serial: 'RB-LX-77120', installedAt: '2020-05-18', warrantyUntil: '2027-05-18', status: 'ok', notes: '12 setores programáveis' },
  { id: 'EQ_IRRIG_RING', name: 'Anel de Aspersores do Relvado', category: 'rega', locationId: 'LOC_PITCH_IRRIGATION', locationName: 'Sistema de Rega & Aspersores', brand: 'Rain Bird', model: 'Eagle 700 Series', serial: 'RB-EG-3341', installedAt: '2020-05-18', warrantyUntil: '2027-05-18', status: 'avariado', notes: 'Aspersor 7 do canto norte não retrai' },
  { id: 'EQ_IRRIG_PUMP', name: 'Bomba de Pressurização de Rega', category: 'rega', locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', brand: 'Grundfos', model: 'CR 15-4', serial: 'GR-CR-90881', installedAt: '2018-09-04', warrantyUntil: '2024-09-04', status: 'ok', notes: 'Fora de garantia' },
  { id: 'EQ_IRRIG_TANK', name: 'Reservatório de Água de Rega', category: 'rega', locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', brand: 'Roth', model: 'Tank 30m3', serial: 'RT-TK-0031', installedAt: '2018-09-04', warrantyUntil: '2028-09-04', status: 'ok', notes: 'Capacidade 30 m³' },

  // --- Elétrico ---
  { id: 'EQ_QEG', name: 'Quadro Elétrico Geral', category: 'eletrico', locationId: 'LOC_TECH_ELEC', locationName: 'Quadro Elétrico Geral (QEG)', brand: 'Schneider Electric', model: 'Prisma P', serial: 'SE-PR-55012', installedAt: '2017-11-20', warrantyUntil: '2027-11-20', status: 'ok', notes: 'Distribuição principal de baixa tensão' },
  { id: 'EQ_GENERATOR', name: 'Grupo Gerador Diesel 250 kVA', category: 'eletrico', locationId: 'LOC_EXT_GENERATOR', locationName: 'Grupo Gerador de Emergência', brand: 'Caterpillar', model: 'DE250 GC', serial: 'CAT-DE-11907', installedAt: '2019-02-11', warrantyUntil: '2029-02-11', status: 'ok', notes: 'Ensaio mensal em carga' },
  { id: 'EQ_TRANSFORMER', name: 'Posto de Transformação 630 kVA', category: 'eletrico', locationId: 'LOC_EXT_PT', locationName: 'Posto de Transformação (PT)', brand: 'Efacec', model: 'PTD 630', serial: 'EF-PT-40233', installedAt: '2017-10-05', warrantyUntil: '2032-10-05', status: 'ok', notes: 'Média/baixa tensão, acesso restrito' },
  { id: 'EQ_UPS_IT', name: 'UPS do Bastidor IT', category: 'eletrico', locationId: 'LOC_TECH_IT', locationName: 'Bastidor IT & Sala de Servidores', brand: 'APC', model: 'Smart-UPS SRT 5000', serial: 'APC-SRT-88410', installedAt: '2022-01-14', warrantyUntil: '2027-01-14', status: 'ok', notes: 'Autonomia 25 min' },
  { id: 'EQ_SCOREBOARD', name: 'Marcador Eletrónico LED', category: 'eletrico', locationId: 'LOC_NORTH_STAND', locationName: 'Bancada Norte / Setor Visitante', brand: 'Daktronics', model: 'ProAd 6mm', serial: 'DK-PA-70551', installedAt: '2021-08-30', warrantyUntil: '2026-08-30', status: 'ok', notes: 'Painel 8x4 m' },

  // --- Água / AVAC ---
  { id: 'EQ_BOILER_MAIN', name: 'Caldeira de Água Quente Sanitária', category: 'avac', locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', brand: 'Vaillant', model: 'ecoTEC plus VU 466', serial: 'VL-ET-66203', installedAt: '2020-10-22', warrantyUntil: '2026-10-22', status: 'ok', notes: 'Serve balneários principais' },
  { id: 'EQ_HEATPUMP_CHANGING', name: 'Bomba de Calor dos Balneários', category: 'avac', locationId: 'LOC_CHANGING_MAIN', locationName: 'Balneário Principal (Equipa da Casa)', brand: 'Daikin', model: 'Altherma 3 H HT', serial: 'DK-AL-31288', installedAt: '2022-06-08', warrantyUntil: '2027-06-08', status: 'ok', notes: '' },
  { id: 'EQ_AC_PRESS', name: 'Ar Condicionado da Sala de Imprensa', category: 'avac', locationId: 'LOC_WEST_PRESS', locationName: 'Sala de Imprensa & Auditório', brand: 'Mitsubishi Electric', model: 'PUHZ-ZRP100', serial: 'ME-ZRP-20874', installedAt: '2021-04-19', warrantyUntil: '2026-04-19', status: 'manutencao', notes: 'Filtros a substituir' },
  { id: 'EQ_WATER_BOOSTER', name: 'Central Hidropressora de Água Potável', category: 'agua', locationId: 'LOC_TECH_PUMPS', locationName: 'Sala de Bombas & Caldeiras', brand: 'Grundfos', model: 'Hydro MPC-E', serial: 'GR-HM-45219', installedAt: '2018-09-04', warrantyUntil: '2025-09-04', status: 'ok', notes: '' },
  { id: 'EQ_SHOWERS_VISITOR', name: 'Coluna de Duches do Balneário Visitante', category: 'agua', locationId: 'LOC_CHANGING_VISITOR', locationName: 'Balneário Visitante', brand: 'Geberit', model: 'Piave', serial: 'GB-PV-13340', installedAt: '2020-11-03', warrantyUntil: '2025-11-03', status: 'avariado', notes: 'Torneira 3 com fuga contínua' },
  { id: 'EQ_DRAIN_TRACK', name: 'Canaletas de Drenagem da Pista', category: 'agua', locationId: 'LOC_PITCH_TRACK', locationName: 'Pista de Atletismo & Fosso', brand: 'ACO', model: 'Drain Multiline', serial: 'ACO-DM-00992', installedAt: '2019-06-01', warrantyUntil: '2029-06-01', status: 'ok', notes: 'Limpeza semestral' },

  // --- Segurança ---
  { id: 'EQ_CCTV_SYSTEM', name: 'Sistema CCTV do Estádio', category: 'seguranca', locationId: 'LOC_SOUTH_POLICE', locationName: 'Posto Policial / Sala de Segurança', brand: 'Hikvision', model: 'DS-96128NI-I24', serial: 'HK-NVR-77401', installedAt: '2021-07-12', warrantyUntil: '2026-07-12', status: 'ok', notes: '48 câmaras, gravação 30 dias' },
  { id: 'EQ_TURNSTILES_EAST', name: 'Torniquetes Nascente (Portões 1 a 4)', category: 'seguranca', locationId: 'LOC_EAST_GATES', locationName: 'Portões 1 a 4 & Torniquetes', brand: 'Gunnebo', model: 'SpeedStile FLs', serial: 'GN-SS-51120', installedAt: '2021-07-12', warrantyUntil: '2026-07-12', status: 'ok', notes: '16 vias de acesso' },
  { id: 'EQ_FIRE_PANEL', name: 'Central de Deteção de Incêndios', category: 'seguranca', locationId: 'LOC_SOUTH_POLICE', locationName: 'Posto Policial / Sala de Segurança', brand: 'Siemens', model: 'Cerberus FIT', serial: 'SI-CF-30117', installedAt: '2020-02-27', warrantyUntil: '2030-02-27', status: 'ok', notes: 'Inspeção anual obrigatória' },
  { id: 'EQ_PA_SYSTEM', name: 'Sistema de Som e Evacuação (PA/VA)', category: 'seguranca', locationId: 'LOC_SOUTH_POLICE', locationName: 'Posto Policial / Sala de Segurança', brand: 'Bosch', model: 'Praesensa', serial: 'BO-PR-64890', installedAt: '2022-03-15', warrantyUntil: '2027-03-15', status: 'ok', notes: 'Anúncios e evacuação por zonas' },
  { id: 'EQ_LIFT_WEST', name: 'Elevador Poente (Tribuna)', category: 'seguranca', locationId: 'LOC_WEST_LIFTS', locationName: 'Elevadores & Acessos Poente', brand: 'Otis', model: 'Gen2 Comfort', serial: 'OT-G2-19956', installedAt: '2018-12-10', warrantyUntil: '2028-12-10', status: 'ok', notes: 'Inspeção periódica obrigatória' },

  // --- Desporto ---
  { id: 'EQ_GOAL_NORTH', name: 'Baliza Norte do Relvado Principal', category: 'desporto', locationId: 'LOC_PITCH_GOALS', locationName: 'Balizas & Banderolas de Canto', brand: 'Harrod Sport', model: 'Socketed Steel', serial: 'HS-GN-1001', installedAt: '2019-08-01', warrantyUntil: '2029-08-01', status: 'ok', notes: '' },
  { id: 'EQ_GOAL_SOUTH', name: 'Baliza Sul do Relvado Principal', category: 'desporto', locationId: 'LOC_PITCH_GOALS', locationName: 'Balizas & Banderolas de Canto', brand: 'Harrod Sport', model: 'Socketed Steel', serial: 'HS-GS-1002', installedAt: '2019-08-01', warrantyUntil: '2029-08-01', status: 'ok', notes: 'Rede substituída em 2025' },
  { id: 'EQ_MOWER', name: 'Cortador de Relva Autopropulsionado', category: 'desporto', locationId: 'LOC_NORTH_STORAGE', locationName: 'Arrecadação de Material Desportivo', brand: 'John Deere', model: '2653B PrecisionCut', serial: 'JD-2653-40711', installedAt: '2021-05-06', warrantyUntil: '2026-05-06', status: 'ok', notes: 'Revisão às 250 h' },
  { id: 'EQ_BENCHES', name: 'Bancos de Suplentes Cobertos', category: 'desporto', locationId: 'LOC_PITCH_BENCHES', locationName: 'Bancos de Suplentes & Quarto Árbitro', brand: 'Sport Court', model: 'Shelter Pro 16', serial: 'SC-SP-77012', installedAt: '2020-01-30', warrantyUntil: '2025-01-30', status: 'ok', notes: '2 unidades de 16 lugares' },
  { id: 'EQ_MEDICAL_KIT', name: 'Equipamento do Posto Médico', category: 'outro', locationId: 'LOC_NORTH_FIRSTAID', locationName: 'Posto Médico & Primeiros Socorros', brand: 'Philips', model: 'HeartStart FRx (DAE)', serial: 'PH-FRX-88123', installedAt: '2022-09-20', warrantyUntil: '2030-09-20', status: 'ok', notes: 'Elétrodos com validade a controlar' }
];

/**
 * EquipmentRepository manages the installed-asset register of the stadium.
 * Cada mutação escreve também na sync_queue dentro da MESMA transação.
 */
export class EquipmentRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Returns all non-deleted equipment sorted by name (pt collation).
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.equipment.toArray();
    return items
      .filter(e => !e.deleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  /**
   * Gets a single equipment record by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.equipment.get(id);
  }

  /**
   * Equipment installed at a given location.
   * @param {string} locationId
   * @returns {Promise<Array>}
   */
  async getByLocation(locationId) {
    if (!locationId) return [];
    const items = await this.db.equipment.where('locationId').equals(locationId).toArray();
    return items
      .filter(e => !e.deleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  /**
   * Equipment of a given category.
   * @param {string} category
   * @returns {Promise<Array>}
   */
  async getByCategory(category) {
    if (!category) return [];
    const items = await this.db.equipment.where('category').equals(category).toArray();
    return items
      .filter(e => !e.deleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  /**
   * Equipment currently flagged as broken (status 'avariado').
   * @returns {Promise<Array>}
   */
  async getBroken() {
    const items = await this.db.equipment.where('status').equals('avariado').toArray();
    return items
      .filter(e => !e.deleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  /**
   * Creates an equipment record.
   * @param {Object} data
   * @param {string} data.name - obrigatório
   * @param {string} [data.category]
   * @param {string} [data.locationId]
   * @param {string} [data.locationName]
   * @param {string} [data.brand]
   * @param {string} [data.model]
   * @param {string} [data.serial]
   * @param {string} [data.installedAt]
   * @param {string} [data.warrantyUntil]
   * @param {string} [data.status]
   * @param {string} [data.notes]
   * @returns {Promise<Object>} The created equipment
   */
  async create(data) {
    if (!data || !data.name || !String(data.name).trim()) {
      throw new Error('O nome do equipamento é obrigatório');
    }

    const id = data.id || generateUUID();
    const now = new Date().toISOString();

    const equipmentObj = {
      id,
      name: String(data.name).trim(),
      category: EQUIPMENT_CATEGORIES.includes(data.category) ? data.category : 'outro',
      locationId: data.locationId || '',
      locationName: data.locationName || '',
      brand: data.brand ? String(data.brand).trim() : '',
      model: data.model ? String(data.model).trim() : '',
      serial: data.serial ? String(data.serial).trim() : '',
      installedAt: data.installedAt || null,
      warrantyUntil: data.warrantyUntil || null,
      status: EQUIPMENT_STATUSES.includes(data.status) ? data.status : 'ok',
      notes: data.notes ? String(data.notes).trim() : '',
      createdAt: data.createdAt || now,
      updatedAt: now,
      synced: 0,
      deleted: 0
    };

    await this.db.transaction('rw', [this.db.equipment, this.db.sync_queue], async () => {
      await this.db.equipment.put(equipmentObj);
      await this.db.sync_queue.add({
        entityType: 'equipment',
        entityId: id,
        action: 'CREATE',
        payload: equipmentObj,
        timestamp: Date.now(),
        retryCount: 0
      });
    });

    return equipmentObj;
  }

  /**
   * Updates an equipment record by ID.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>} The updated equipment
   */
  async update(id, updates) {
    if (!id) throw new Error('O ID do equipamento é obrigatório');
    const existing = await this.db.equipment.get(id);
    if (!existing) throw new Error(`Equipamento ${id} não encontrado`);

    const patch = { ...(updates || {}) };
    ['name', 'brand', 'model', 'serial', 'notes'].forEach(field => {
      if (patch[field] !== undefined) patch[field] = String(patch[field]).trim();
    });
    if (patch.category !== undefined && !EQUIPMENT_CATEGORIES.includes(patch.category)) {
      delete patch.category;
    }
    if (patch.status !== undefined && !EQUIPMENT_STATUSES.includes(patch.status)) {
      throw new Error(`Estado de equipamento inválido: ${patch.status}`);
    }

    patch.updatedAt = new Date().toISOString();
    patch.synced = 0;

    const updated = { ...existing, ...patch };

    await this.db.transaction('rw', [this.db.equipment, this.db.sync_queue], async () => {
      await this.db.equipment.put(updated);
      await this.db.sync_queue.add({
        entityType: 'equipment',
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
   * Sets the operational status of an equipment record.
   * @param {string} id
   * @param {'ok'|'avariado'|'manutencao'|'abatido'} status
   * @returns {Promise<Object>} The updated equipment
   */
  async setStatus(id, status) {
    if (!EQUIPMENT_STATUSES.includes(status)) {
      throw new Error(`Estado de equipamento inválido: ${status}`);
    }
    return await this.update(id, { status });
  }

  /**
   * Soft-deletes an equipment record (deleted=1).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.equipment, this.db.sync_queue], async () => {
      await this.db.equipment.update(id, {
        deleted: 1,
        synced: 0,
        updatedAt: new Date().toISOString()
      });
      await this.db.sync_queue.add({
        entityType: 'equipment',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Case/accent-insensitive search over name, brand, model, serial and location.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const q = normalizeText(query);
    if (!q) return await this.getAll();
    const items = await this.getAll();
    return items.filter(e =>
      normalizeText(e.name).includes(q) ||
      normalizeText(e.brand).includes(q) ||
      normalizeText(e.model).includes(q) ||
      normalizeText(e.serial).includes(q) ||
      normalizeText(e.locationName).includes(q)
    );
  }

  /**
   * Marks an equipment record as synced.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.equipment.update(id, { synced: 1 });
  }

  /**
   * Seeds the real stadium asset register if the table is empty.
   * @returns {Promise<Array>} The equipment present after seeding
   */
  async seedDefaults() {
    const count = await this.db.equipment.count();
    if (count > 0) return await this.getAll();

    const now = new Date().toISOString();
    const items = DEFAULT_EQUIPMENT.map(e => ({
      id: e.id,
      name: e.name,
      category: EQUIPMENT_CATEGORIES.includes(e.category) ? e.category : 'outro',
      locationId: e.locationId || '',
      locationName: e.locationName || '',
      brand: e.brand || '',
      model: e.model || '',
      serial: e.serial || '',
      installedAt: e.installedAt || null,
      warrantyUntil: e.warrantyUntil || null,
      status: EQUIPMENT_STATUSES.includes(e.status) ? e.status : 'ok',
      notes: e.notes || '',
      createdAt: now,
      updatedAt: now,
      synced: 1,
      deleted: 0
    }));

    await this.db.equipment.bulkPut(items);
    return items;
  }
}

/** Combining diacritical marks range (U+0300..U+036F). */
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercases and strips diacritics so "iluminacao" encontra "Iluminação". */
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();
}

export const equipmentRepo = new EquipmentRepository();
