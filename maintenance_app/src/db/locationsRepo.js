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
 * Map of standard stadium location names to fixed ID keys expected by E2E tests and cloud sync.
 */
export const PREDEFINED_LOCATION_IDS = {
  'Relvado Principal': 'LOC_PITCH',
  'Balneários': 'LOC_CHANGING',
  'Bancada Norte': 'LOC_NORTH_STAND',
  'Bancada Nascente': 'LOC_EAST_STAND',
  'Bancada Poente': 'LOC_WEST_STAND',
  'Bancada Sul': 'LOC_SOUTH_STAND'
};

/**
 * Hierarchical structure template for Estádio Municipal de Leiria.
 */
export const STADIUM_HIERARCHY = [
  {
    id: 'SEC_POENTE',
    code: 'LOC_WEST_STAND',
    name: 'Bancada Poente (Principal & VIP)',
    description: 'Bancada coberta, camarotes, tribuna e áreas nobres',
    icon: 'poente',
    rooms: [
      { id: 'LOC_WEST_VIP', name: 'Tribuna VIP & Presidencial', description: 'Lugares de honra e lounge VIP' },
      { id: 'LOC_WEST_BOXES', name: 'Camarotes Poente (1 a 12)', description: 'Camarotes corporativos piso 2' },
      { id: 'LOC_WEST_PRESS', name: 'Sala de Imprensa & Auditório', description: 'Bancada de imprensa e cabines de transmissão' },
      { id: 'LOC_WEST_BARS', name: 'Bares & Restauração Poente', description: 'Áreas de apoio e cafetaria' },
      { id: 'LOC_WEST_BATH', name: 'Sanitários Poente (Piso 0 e 1)', description: 'Sanitários públicos e acessíveis' },
      { id: 'LOC_WEST_LIFTS', name: 'Elevadores & Acessos Poente', description: 'Caixas de elevador e escadas de emergência' }
    ]
  },
  {
    id: 'SEC_NASCENTE',
    code: 'LOC_EAST_STAND',
    name: 'Bancada Nascente',
    description: 'Bancada este com bancada geral e portas de acesso',
    icon: 'nascente',
    rooms: [
      { id: 'LOC_EAST_STAND', name: 'Bancada Geral Nascente', description: 'Setores 10 a 18' },
      { id: 'LOC_EAST_GATES', name: 'Portões 1 a 4 & Torniquetes', description: 'Acessos e controlo de bilhética' },
      { id: 'LOC_EAST_BARS', name: 'Bares Nascente', description: 'Quiosques de apoio' },
      { id: 'LOC_EAST_BATH', name: 'Sanitários Nascente', description: 'Sanitários masculinos e femininos' }
    ]
  },
  {
    id: 'SEC_NORTH',
    code: 'LOC_NORTH_STAND',
    name: 'Topo Norte',
    description: 'Bancada norte orientada ao Castelo de Leiria',
    icon: 'norte',
    rooms: [
      { id: 'LOC_NORTH_STAND', name: 'Bancada Norte / Setor Visitante', description: 'Setor de segurança para adeptos visitantes' },
      { id: 'LOC_NORTH_FIRSTAID', name: 'Posto Médico & Primeiros Socorros', description: 'Gabinete de saúde e enfermagem norte' },
      { id: 'LOC_NORTH_STORAGE', name: 'Arrecadação de Material Desportivo', description: 'Armazém de cones, barreiras e material' },
      { id: 'LOC_NORTH_GATES', name: 'Torniquetes & Portão Norte', description: 'Entrada visitantes e portão de emergência' }
    ]
  },
  {
    id: 'SEC_SOUTH',
    code: 'LOC_SOUTH_STAND',
    name: 'Topo Sul',
    description: 'Bancada sul e áreas de apoio',
    icon: 'sul',
    rooms: [
      { id: 'LOC_SOUTH_STAND', name: 'Bancada Sul (Claque)', description: 'Setor de adeptos da casa' },
      { id: 'LOC_SOUTH_TICKETS', name: 'Bilheteiras Centrais Sul', description: 'Postos de venda e apoio ao sócio' },
      { id: 'LOC_SOUTH_POLICE', name: 'Posto Policial / Sala de Segurança', description: 'Monitorização CCTV e posto de comando' }
    ]
  },
  {
    id: 'SEC_PITCH',
    code: 'LOC_PITCH',
    name: 'Relvado & Pista de Atletismo',
    description: 'Terreno de jogo principal e pista tartan',
    icon: 'relvado',
    rooms: [
      { id: 'LOC_PITCH', name: 'Relvado Principal', description: 'Campo principal de jogo' },
      { id: 'LOC_PITCH_IRRIGATION', name: 'Sistema de Rega & Aspersores', description: 'Válvulas e aspersores embutidos' },
      { id: 'LOC_PITCH_BENCHES', name: 'Bancos de Suplentes & Quarto Árbitro', description: 'Assentos técnicos e proteção' },
      { id: 'LOC_PITCH_TRACK', name: 'Pista de Atletismo & Fosso', description: 'Pista de 8 corredores e canaletas' },
      { id: 'LOC_PITCH_GOALS', name: 'Balizas & Banderolas de Canto', description: 'Redes, postes e estruturas de apoio' }
    ]
  },
  {
    id: 'SEC_TECH',
    code: 'LOC_CHANGING',
    name: 'Balneários & Zonas Técnicas',
    description: 'Coração técnico do estádio, caldeiras e balneários',
    icon: 'tecnica',
    rooms: [
      { id: 'LOC_CHANGING_MAIN', name: 'Balneário Principal (Equipa da Casa)', description: 'Cabines, chuveiros, jacuzzi e massagens' },
      { id: 'LOC_CHANGING_VISITOR', name: 'Balneário Visitante', description: 'Vestiários e duches de visita' },
      { id: 'LOC_CHANGING_REFS', name: 'Balneário de Árbitros & Delegados', description: 'Vestiário de arbitragem' },
      { id: 'LOC_TECH_PUMPS', name: 'Sala de Bombas & Caldeiras', description: 'Aquecimento central e bombagem de água' },
      { id: 'LOC_TECH_ELEC', name: 'Quadro Elétrico Geral (QEG)', description: 'Distribuição de energia e disjuntores' },
      { id: 'LOC_TECH_IT', name: 'Bastidor IT & Sala de Servidores', description: 'Redes, fibra ótica e comutadores' },
      { id: 'LOC_TECH_DOPING', name: 'Sala de Controlo Antidoping', description: 'Gabinete médico de controlo' }
    ]
  },
  {
    id: 'SEC_EXTERIOR',
    code: 'LOC_EXTERIOR',
    name: 'Exterior, Portões & Apoio',
    description: 'Perímetro exterior, geradores e infraestrutura geral',
    icon: 'exterior',
    rooms: [
      { id: 'LOC_EXT_GENERATOR', name: 'Grupo Gerador de Emergência', description: 'Gerador diesel de socorro' },
      { id: 'LOC_EXT_PT', name: 'Posto de Transformação (PT)', description: 'Média/baixa tensão' },
      { id: 'LOC_EXT_LIGHTS', name: 'Torres de Iluminação do Estádio', description: '4 torres de projetores LED' },
      { id: 'LOC_EXT_PARKING', name: 'Parque de Estacionamento & Cargas', description: 'Cais de descargas e estacionamento autocarros' }
    ]
  }
];

/**
 * Standard flat list of all default rooms for initial database seeding.
 */
export const DEFAULT_LOCATIONS = STADIUM_HIERARCHY.flatMap(sec => 
  sec.rooms.map(r => ({
    id: r.id,
    name: r.name,
    sectorId: sec.id,
    sectorName: sec.name,
    description: r.description || '',
    isCustom: false,
    synced: 1
  }))
);

/**
 * LocationsRepository manages Dexie CRUD operations for stadium locations
 * and enqueues offline mutations to sync_queue.
 */
export class LocationsRepository {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
  }

  /**
   * Returns all non-deleted Location objects sorted by name (ascending).
   * @returns {Promise<Array>}
   */
  async getAll() {
    const items = await this.db.locations.toArray();
    return items
      .filter(loc => !loc.deleted || loc.deleted === 0)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
  }

  /**
   * Returns all locations grouped by Sector dynamically from the database.
   * @returns {Promise<Array>}
   */
  async getGroupedBySector() {
    const allLocations = await this.getAll();

    // Map base sectors
    const sectorMap = new Map();
    STADIUM_HIERARCHY.forEach(sec => {
      sectorMap.set(sec.name, {
        id: sec.id,
        code: sec.code,
        name: sec.name,
        description: sec.description,
        icon: sec.icon,
        rooms: []
      });
    });

    // Populate rooms into matching sector or create custom sector group
    allLocations.forEach(loc => {
      const secName = loc.sectorName || 'Outras Instalações & Setores';
      if (!sectorMap.has(secName)) {
        sectorMap.set(secName, {
          id: loc.sectorId || 'SEC_CUSTOM',
          code: loc.sectorId || 'LOC_CUSTOM',
          name: secName,
          description: 'Setor personalizado',
          icon: 'exterior',
          rooms: []
        });
      }
      sectorMap.get(secName).rooms.push(loc);
    });

    // Return only sectors with rooms or all base sectors
    return Array.from(sectorMap.values());
  }

  /**
   * Gets a location by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    if (!id) return undefined;
    return await this.db.locations.get(id);
  }

  /**
   * Creates a Location object, saves to Dexie `locations` store,
   * and enqueues a `CREATE` action item to `sync_queue`.
   *
   * @param {Object} locationData
   * @returns {Promise<Object>} The created Location object
   */
  async create(locationData) {
    if (!locationData || !locationData.name || !String(locationData.name).trim()) {
      throw new Error('Location name is required');
    }

    const name = String(locationData.name).trim();
    const id = locationData.id || PREDEFINED_LOCATION_IDS[name] || generateUUID();
    const description = locationData.description ? String(locationData.description).trim() : '';
    const sectorId = locationData.sectorId || 'SEC_CUSTOM';
    const sectorName = locationData.sectorName || 'Outras Instalações & Setores';
    const isCustom = locationData.isCustom !== undefined ? Boolean(locationData.isCustom) : true;
    const createdAt = locationData.createdAt || new Date().toISOString();
    const synced = locationData.synced !== undefined ? Number(locationData.synced) : 0;

    const locationObj = {
      id,
      name,
      sectorId,
      sectorName,
      description,
      isCustom,
      createdAt,
      synced,
      deleted: 0
    };

    const syncQueueItem = {
      entityType: 'location',
      entityId: id,
      action: 'CREATE',
      payload: locationObj,
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.locations, this.db.sync_queue], async () => {
      await this.db.locations.put(locationObj);
      await this.db.sync_queue.add(syncQueueItem);
    });

    return locationObj;
  }

  /**
   * Seeds initial stadium locations if local store is empty or needs hierarchy update.
   *
   * @param {Array<string|Object>} [defaultList]
   * @returns {Promise<Array>} List of seeded location objects
   */
  async seedDefaults(defaultList = DEFAULT_LOCATIONS) {
    const count = await this.db.locations.count();
    if (count > 0) {
      return await this.getAll();
    }

    const listToSeed = Array.isArray(defaultList) && defaultList.length > 0 ? defaultList : DEFAULT_LOCATIONS;

    const itemsToInsert = listToSeed.map(item => {
      if (typeof item === 'string') {
        const name = item.trim();
        const id = PREDEFINED_LOCATION_IDS[name] || generateUUID();
        return {
          id,
          name,
          sectorId: 'SEC_CUSTOM',
          sectorName: 'Geral',
          description: '',
          isCustom: false,
          createdAt: new Date().toISOString(),
          synced: 1,
          deleted: 0
        };
      } else {
        const name = (item.name || '').trim();
        const id = item.id || PREDEFINED_LOCATION_IDS[name] || generateUUID();
        return {
          id,
          name,
          sectorId: item.sectorId || 'SEC_CUSTOM',
          sectorName: item.sectorName || 'Geral',
          description: item.description ? String(item.description).trim() : '',
          isCustom: item.isCustom !== undefined ? Boolean(item.isCustom) : false,
          createdAt: item.createdAt || new Date().toISOString(),
          synced: item.synced !== undefined ? Number(item.synced) : 1,
          deleted: 0
        };
      }
    });

    await this.db.locations.bulkPut(itemsToInsert);
    return itemsToInsert;
  }

  /**
   * Updates a location by ID.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async update(id, updates) {
    if (!id) throw new Error('Location ID is required');
    const existing = await this.db.locations.get(id);
    if (!existing) throw new Error(`Location ${id} not found`);

    const updated = {
      ...existing,
      name: updates.name ? String(updates.name).trim() : existing.name,
      description: updates.description !== undefined ? String(updates.description).trim() : existing.description,
      sectorId: updates.sectorId !== undefined ? updates.sectorId : existing.sectorId,
      sectorName: updates.sectorName !== undefined ? updates.sectorName : existing.sectorName,
      synced: 0,
      updatedAt: new Date().toISOString()
    };

    const syncItem = {
      entityType: 'location',
      entityId: id,
      action: 'UPDATE',
      payload: { id, name: updated.name, description: updated.description, sectorName: updated.sectorName },
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.transaction('rw', [this.db.locations, this.db.sync_queue], async () => {
      await this.db.locations.put(updated);
      await this.db.sync_queue.add(syncItem);
    });

    return updated;
  }

  /**
   * Removes a location by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    if (!id) return;
    await this.db.transaction('rw', [this.db.locations, this.db.sync_queue], async () => {
      await this.db.locations.delete(id);
      await this.db.sync_queue.add({
        entityType: 'location',
        entityId: id,
        action: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Updates local `synced` flag to 1.
   * @param {string} id
   * @returns {Promise<number>}
   */
  async markSynced(id) {
    if (!id) return 0;
    return await this.db.locations.update(id, { synced: 1 });
  }
}

export const locationsRepo = new LocationsRepository();
