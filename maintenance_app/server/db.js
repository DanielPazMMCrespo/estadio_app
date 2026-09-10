import pg from 'pg';
const { Pool } = pg;

let pool = null;
let isInitialized = false;

export function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Erro inesperado no pool:', err.message);
    });
  }
  return pool;
}

/**
 * Inicializa e cria as tabelas caso não existam
 */
export async function initDatabase() {
  const p = getPool();
  if (!p) {
    console.warn('[PostgreSQL] DATABASE_URL não definida. O servidor continuará em modo PWA offline/local.');
    return false;
  }

  try {
    const client = await p.connect();
    try {
      console.log('[PostgreSQL] Conectado à base de dados. A verificar tabelas...');

      await client.query(`
        -- Tabela de Localizações
        CREATE TABLE IF NOT EXISTS locations (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          number VARCHAR(12) DEFAULT '',
          is_custom BOOLEAN DEFAULT FALSE,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Relatórios e Avarias
        CREATE TABLE IF NOT EXISTS reports (
          id VARCHAR(100) PRIMARY KEY,
          date TIMESTAMPTZ,
          location_id VARCHAR(100),
          location_name VARCHAR(255),
          priority VARCHAR(50),
          status VARCHAR(50),
          sector_code VARCHAR(50),
          description TEXT,
          time_spent_minutes INTEGER DEFAULT 0,
          photos JSONB DEFAULT '[]'::jsonb,
          materials TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Materiais
        CREATE TABLE IF NOT EXISTS materials (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Tarefas
        CREATE TABLE IF NOT EXISTS tasks (
          id VARCHAR(100) PRIMARY KEY,
          title VARCHAR(255),
          description TEXT,
          due_date VARCHAR(50),
          location_id VARCHAR(100),
          equipment_id VARCHAR(100),
          done SMALLINT DEFAULT 0,
          priority VARCHAR(50),
          recurring VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Notas
        CREATE TABLE IF NOT EXISTS notes (
          id VARCHAR(100) PRIMARY KEY,
          title VARCHAR(255),
          content TEXT,
          pinned SMALLINT DEFAULT 0,
          location_id VARCHAR(100),
          audio_blob TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Ferramentas
        CREATE TABLE IF NOT EXISTS tools (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          location_id VARCHAR(100),
          qty INTEGER DEFAULT 0,
          min_qty INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Movimentos de Ferramentas
        CREATE TABLE IF NOT EXISTS tool_moves (
          id SERIAL PRIMARY KEY,
          tool_id VARCHAR(100),
          report_id VARCHAR(100),
          technician VARCHAR(100),
          action VARCHAR(50),
          delta INTEGER DEFAULT 0,
          at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- Tabela de Equipamentos
        CREATE TABLE IF NOT EXISTS equipment (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100),
          location_id VARCHAR(100),
          status VARCHAR(50),
          serial VARCHAR(100),
          qr_code VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Tabela de Portas (o chaveiro do estádio)
        CREATE TABLE IF NOT EXISTS doors (
          id VARCHAR(100) PRIMARY KEY,
          numero VARCHAR(20) NOT NULL,
          numero_antigo VARCHAR(20),
          lado VARCHAR(20),
          piso SMALLINT,
          descricao TEXT,
          tipo VARCHAR(40),
          area_original VARCHAR(60),
          sector_id VARCHAR(100),
          sector_code VARCHAR(100),
          sector_name VARCHAR(255),
          nome VARCHAR(255),
          status VARCHAR(50),
          notas TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted SMALLINT DEFAULT 0
        );

        -- Colunas em falta no sync (só acrescentam, nunca apagam nem renomeiam).
        -- Sem elas, o push perdia os campos e o pull apagava-os nos telemóveis.
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS equipment_id VARCHAR(100);
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS door_id VARCHAR(100);
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS author VARCHAR(255) DEFAULT '';
        ALTER TABLE tools ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'un';
        ALTER TABLE tools ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT '';
        ALTER TABLE tools ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE tools ALTER COLUMN qty TYPE NUMERIC USING qty::numeric;
        ALTER TABLE tools ALTER COLUMN min_qty TYPE NUMERIC USING min_qty::numeric;
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brand VARCHAR(255) DEFAULT '';
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model VARCHAR(255) DEFAULT '';
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT '';
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ;
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS warranty_until TIMESTAMPTZ;
        ALTER TABLE notes ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT '';
        ALTER TABLE notes ADD COLUMN IF NOT EXISTS photo_ids JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE notes ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT 0;
        ALTER TABLE tool_moves ADD COLUMN IF NOT EXISTS client_ref VARCHAR(100);
        ALTER TABLE tool_moves ADD COLUMN IF NOT EXISTS reason TEXT;
        ALTER TABLE tool_moves ADD COLUMN IF NOT EXISTS qty_after NUMERIC;
        ALTER TABLE tool_moves ALTER COLUMN delta TYPE NUMERIC USING delta::numeric;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_moves_client_ref ON tool_moves(client_ref);

        -- Campos que o cliente tem e que o sync antes perdia: tarefas (notas,
        -- conclusão, local), localizações (setor) e relatórios (nomes do
        -- equipamento/porta, só para leitura no overview, além dos IDs).
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT '';
        ALTER TABLE locations ADD COLUMN IF NOT EXISTS sector_id VARCHAR(100) DEFAULT '';
        ALTER TABLE locations ADD COLUMN IF NOT EXISTS sector_name VARCHAR(255) DEFAULT '';
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS equipment_name VARCHAR(255) DEFAULT '';
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS door_numero VARCHAR(20) DEFAULT '';

        -- Índices para buscas rápidas de sincronização
        CREATE INDEX IF NOT EXISTS idx_materials_updated ON materials(updated_at);
        CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_tools_updated ON tools(updated_at);
        CREATE INDEX IF NOT EXISTS idx_equipment_updated ON equipment(updated_at);
        CREATE INDEX IF NOT EXISTS idx_doors_updated ON doors(updated_at);
        CREATE INDEX IF NOT EXISTS idx_doors_numero ON doors(numero);
        ALTER TABLE locations ADD COLUMN IF NOT EXISTS number VARCHAR(12) DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_locations_updated ON locations(updated_at);
      `);

      console.log('[PostgreSQL] Tabelas e índices verificados/criados com sucesso.');
      isInitialized = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[PostgreSQL] Erro ao inicializar tabelas:', err.message);
    return false;
  }
}

/**
 * O relógio do cliente não é autoridade: aceita o passado (edição offline
 * legítima, que chega depois mas aconteceu antes) e corta o futuro
 * (relógio errado ou forjado) pelo relógio do servidor. Sem isto, um
 * updatedAt de 2099 ganhava sempre o Last-Write-Wins.
 */
export function clampUpdatedAt(value, nowIso) {
  const t = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(t)) return nowIso;
  const n = Date.parse(nowIso);
  if (!Number.isFinite(n)) return nowIso;
  return t > n ? nowIso : new Date(t).toISOString();
}

const _px = {
  keep: (v) => v,
  str: (v) => (v === undefined || v === null ? '' : String(v)),
  strNow: (v, now) => (v ? v : now),
  nullstr: (v) => (v === undefined || v === null || v === '' ? null : String(v)),
  int: (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; },
  int01: (v) => (v ? 1 : 0),
  bool: (v) => Boolean(v),
  json: (v) => JSON.stringify(Array.isArray(v) ? v : []),
};

function _pxCol(spec) { return Array.isArray(spec) ? spec[0] : spec; }
function _pxKind(spec) { return Array.isArray(spec) ? spec[1] : 'keep'; }

// payloadKey -> coluna (ou [coluna, transformação]). Quando dois payloadKeys
// mapeiam a mesma coluna (timeSpent/timeSpentMinutes, body/content), ganha o
// primeiro presente — o nome canónico do cliente vai sempre primeiro.
const PUSH_ENTITIES = {
  reports: { table: 'reports', fields: {
    date: ['date', 'strNow'], locationId: ['location_id', 'nullstr'],
    locationName: ['location_name', 'str'], priority: ['priority', 'str'],
    status: ['status', 'str'], sectorCode: ['sector_code', 'str'],
    description: ['description', 'str'], timeSpent: ['time_spent_minutes', 'int'],
    timeSpentMinutes: ['time_spent_minutes', 'int'], photos: ['photos', 'json'],
    materials: ['materials', 'str'], resolutionNotes: ['resolution_notes', 'str'],
    resolvedAt: ['resolved_at', 'nullstr'], equipmentId: ['equipment_id', 'nullstr'],
    equipmentName: ['equipment_name', 'str'], doorId: ['door_id', 'nullstr'],
    doorNumero: ['door_numero', 'str'], author: ['author', 'str'], deleted: ['deleted', 'int01'],
  }, defaults: { priority: 'medium', status: 'pending', description: '', time_spent_minutes: 0, photos: '[]', location_name: '', sector_code: '', materials: '', author: '', deleted: 0, created_at: (now) => now } },
  tasks: { table: 'tasks', fields: {
    title: ['title', 'str'], description: ['description', 'str'],
    notes: ['notes', 'str'], dueDate: ['due_date', 'str'], doneAt: ['done_at', 'nullstr'],
    locationId: ['location_id', 'nullstr'], locationName: ['location_name', 'str'],
    equipmentId: ['equipment_id', 'nullstr'], done: ['done', 'int01'],
    priority: ['priority', 'str'], recurring: ['recurring', 'nullstr'],
    deleted: ['deleted', 'int01'],
  }, defaults: { title: '', description: '', notes: '', due_date: '', priority: 'medium', location_name: '', deleted: 0, created_at: (now) => now } },
  notes: { table: 'notes', fields: {
    body: ['content', 'str'], content: ['content', 'str'], title: ['title', 'str'],
    pinned: ['pinned', 'int01'], locationId: ['location_id', 'nullstr'],
    locationName: ['location_name', 'str'], audioBlob: ['audio_blob', 'keep'],
    audioDuration: ['audio_duration', 'int'], photoIds: ['photo_ids', 'json'],
    deleted: ['deleted', 'int01'],
  }, defaults: { title: '', content: '', pinned: 0, photo_ids: '[]', audio_duration: 0, deleted: 0, created_at: (now) => now } },
  tools: { table: 'tools', fields: {
    name: ['name', 'str'], unit: ['unit', 'str'], locationId: ['location_id', 'nullstr'],
    locationName: ['location_name', 'str'], qty: ['qty', 'int'],
    minQty: ['min_qty', 'int'], notes: ['notes', 'str'], deleted: ['deleted', 'int01'],
  }, defaults: { name: '', unit: 'un', qty: 0, min_qty: 0, location_name: '', notes: '', deleted: 0, created_at: (now) => now } },
  equipment: { table: 'equipment', fields: {
    name: ['name', 'str'], category: ['category', 'str'],
    locationId: ['location_id', 'nullstr'], locationName: ['location_name', 'str'],
    brand: ['brand', 'str'], model: ['model', 'str'], serial: ['serial', 'str'],
    installedAt: ['installed_at', 'nullstr'], warrantyUntil: ['warranty_until', 'nullstr'],
    status: ['status', 'str'], notes: ['notes', 'str'], qrCode: ['qr_code', 'str'],
    deleted: ['deleted', 'int01'],
  }, defaults: { name: '', category: '', status: 'ok', location_name: '', brand: '', model: '', serial: '', notes: '', qr_code: '', deleted: 0, created_at: (now) => now } },
  locations: { table: 'locations', fields: {
    name: ['name', 'str'], number: ['number', 'str'],
    sectorId: ['sector_id', 'str'], sectorName: ['sector_name', 'str'],
    isCustom: ['is_custom', 'bool'], description: ['description', 'str'],
    deleted: ['deleted', 'int01'],
  }, defaults: { name: '', number: '', sector_id: '', sector_name: '', is_custom: false, description: '', deleted: 0, created_at: (now) => now } },
  doors: { table: 'doors', fields: {
    numero: ['numero', 'str'], numeroAntigo: ['numero_antigo', 'str'], lado: ['lado', 'str'],
    piso: ['piso', 'int'], descricao: ['descricao', 'str'], tipo: ['tipo', 'str'],
    areaOriginal: ['area_original', 'str'], sectorId: ['sector_id', 'nullstr'],
    sectorCode: ['sector_code', 'nullstr'], sectorName: ['sector_name', 'str'],
    nome: ['nome', 'str'], status: ['status', 'str'], notas: ['notas', 'str'],
    deleted: ['deleted', 'int01'],
  }, defaults: { numero: '', numero_antigo: '', lado: '', piso: 0, descricao: '', tipo: 'geral', area_original: '', sector_name: '', nome: '', status: 'ok', notas: '', deleted: 0, created_at: (now) => now } },
  materials: { table: 'materials', fields: {
    name: ['name', 'str'], deleted: ['deleted', 'int01'],
  }, defaults: { name: '', deleted: 0, created_at: (now) => now } },
};

/**
 * UPSERT parcial seguro: só toca nas colunas que o payload TRAZ. Um toggle
 * de estado (payload só com status) nunca apaga nome/descrição no servidor.
 * Colunas em falta num INSERT levam o default da entidade; created_at nunca
 * é reescrito num UPDATE. Nomes de tabelas/colunas vêm do mapa fixo acima,
 * nunca do pedido — sem risco de SQL injection.
 * @returns {Promise<boolean|string>} true se DELETE tratado; a string do
 * updated_at GRAVADO se UPSERT (já clampado pelo relógio do servidor).
 */
async function pushEntity(client, entity, entityId, action, payload, now) {
  const cfg = PUSH_ENTITIES[entity];
  if (!cfg) return false;
  const data = payload || {};
  if (action === 'DELETE') {
    await client.query(
      `UPDATE ${cfg.table} SET deleted = 1, updated_at = $1 WHERE id = $2`,
      [now, entityId]
    );
    return true;
  }
  const updatedAt = clampUpdatedAt(data.updatedAt, now);
  const cols = [];
  const vals = [];
  const seen = new Set();
  for (const [pkey, spec] of Object.entries(cfg.fields)) {
    if (data[pkey] === undefined) continue;
    const col = _pxCol(spec);
    if (seen.has(col)) continue;
    seen.add(col);
    cols.push(col);
    vals.push(_px[_pxKind(spec)](data[pkey], now));
  }
  const setCols = cols.filter((c) => c !== 'created_at');
  const insCols = [...cols];
  const insVals = [...vals];
  for (const [col, def] of Object.entries(cfg.defaults || {})) {
    if (seen.has(col)) continue;
    insCols.push(col);
    insVals.push(typeof def === 'function' ? def(now) : def);
  }
  insCols.push('updated_at');
  insVals.push(updatedAt);
  const values = [entityId, ...insVals];
  const ph = insVals.map((_, i) => `$${i + 2}`).join(', ');
  const setClause = [...setCols.map((c) => `${c} = EXCLUDED.${c}`), 'updated_at = EXCLUDED.updated_at'].join(', ');
  await client.query(
    `INSERT INTO ${cfg.table} (id, ${insCols.join(', ')}) VALUES ($1, ${ph}) ` +
    `ON CONFLICT (id) DO UPDATE SET ${setClause} ` +
    `WHERE ${cfg.table}.updated_at IS NULL OR EXCLUDED.updated_at >= ${cfg.table}.updated_at`,
    values
  );
  return updatedAt;
}

/**
 * Linha do diário de stock: append-only e idempotente. O client_ref é o id
 * do item na sync_queue (único por movimento): se o push for repetido
 * depois de um COMMIT sem drenar a fila, o ON CONFLICT ignora a repetição
 * em vez de duplicar o histórico. O stock atual vive em tools.qty (LWW,
 * como o resto) e é atualizado com a quantidade absoluta do técnico.
 * @returns {Promise<boolean>} true se tratado
 */
async function pushToolMove(client, item, payload, now) {
  const data = payload || {};
  if (!data.toolId) return false;
  const delta = Number(data.delta);
  const qtyAfter = Number(data.qtyAfter);
  const ref = String(item && item.id !== undefined && item.id !== null
    ? item.id
    : `${data.toolId}:${data.at || now}`);
  await client.query(
    `INSERT INTO tool_moves (tool_id, report_id, technician, action, delta, qty_after, reason, at, client_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (client_ref) DO NOTHING`,
    [
      String(data.toolId),
      data.reportId || null,
      String(data.technician || data.author || ''),
      String(data.action || ''),
      Number.isFinite(delta) ? delta : 0,
      Number.isFinite(qtyAfter) ? qtyAfter : null,
      data.reason ? String(data.reason) : null,
      data.at || now,
      ref,
    ]
  );
  if (Number.isFinite(qtyAfter)) {
    await client.query(
      `UPDATE tools SET qty = $1, updated_at = $2 WHERE id = $3`,
      [qtyAfter, now, String(data.toolId)]
    );
  }
  return true;
}

/**
 * Processa um lote de mutações da sync_queue (Push)
 */
export async function processSyncPush(mutations, poolOverride = null) {
  const p = poolOverride || getPool();
  if (!p) throw new Error('Base de dados não disponível');

  const client = await p.connect();
  const processed = [];
  // Itens que o servidor não conseguiu tratar (tipo desconhecido, sem
  // identificador, movimento sem ferramenta). Nunca entram em processedIds:
  // ficam na sync_queue do técnico — confirmar era apagá-los para sempre.
  const unprocessed = [];

  try {
    await client.query('BEGIN');
    let savepointSeq = 0;
    // processedTimes: id do item (da sync_queue) -> updated_at GRAVADO no
    // servidor. Permite ao cliente re-ancorar o relógio local (ver fix do
    // clock futuro) sem esperar pelo pull seguinte.
    const processedTimes = {};

    for (const item of mutations) {
      const { entityType, entityId, action, payload } = item || {};
      const now = new Date().toISOString();
      const key = (item && item.id !== undefined && item.id !== null) ? item.id : entityId;
      const savepoint = `sp_${++savepointSeq}`;

      // Sem identificador não há como confirmar em segurança: fica na fila.
      if (entityId === undefined || entityId === null || entityId === '') {
        unprocessed.push(key);
        continue;
      }

      // SAVEPOINT por item: um registo inválido/duplicado nunca deve
      // reverter o lote inteiro e encravar a fila do técnico para sempre.
      await client.query(`SAVEPOINT ${savepoint}`);
      let handled = false;
      let storedAt = null;

      try {
        if (entityType === 'report' || entityType === 'reports') {
          handled = await pushEntity(client, 'reports', entityId, action, payload, now);
        } else if (entityType === 'task' || entityType === 'tasks') {
          handled = await pushEntity(client, 'tasks', entityId, action, payload, now);
        } else if (entityType === 'note' || entityType === 'notes') {
          handled = await pushEntity(client, 'notes', entityId, action, payload, now);
        } else if (entityType === 'tool' || entityType === 'tools') {
          handled = await pushEntity(client, 'tools', entityId, action, payload, now);
        } else if (entityType === 'location' || entityType === 'locations') {
          handled = await pushEntity(client, 'locations', entityId, action, payload, now);
        } else if (entityType === 'door') {
          handled = await pushEntity(client, 'doors', entityId, action, payload, now);
        } else if (entityType === 'equipment') {
          handled = await pushEntity(client, 'equipment', entityId, action, payload, now);
        } else if (entityType === 'tool_move') {
          handled = await pushToolMove(client, item, payload, now);
        } else if (entityType === 'material' || entityType === 'materials') {
          handled = await pushEntity(client, 'materials', entityId, action, payload, now);
        } else {
          handled = false;
        }
        if (typeof handled === 'string') storedAt = handled;
        if (handled) processedTimes[key] = storedAt;
      } catch (err) {
        // Aceitos já gravados (linhas do savepoint anterior) ficam; o item
        // problemático volta para a fila do técnico para novo diagnóstico.
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        handled = false;
        console.warn(`[db] item ${entityType}/${entityId} falhou isolado:`, err && err.message ? err.message : err);
      } finally {
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      }

      if (handled) processed.push(key);
      else unprocessed.push(key);
    }

    await client.query('COMMIT');
    return { success: true, processedCount: processed.length, processedIds: processed, processedTimes, unprocessedCount: unprocessed.length, unprocessedIds: unprocessed };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Puxa alterações ocorridas desde um cursor (Pull), em lotes.
 *
 * Cursor POR TABELA: o antigo cursor global era o maior updated_at de TODAS
 * as tabelas, o que podia saltar linhas (ex.: 1200 relatórios + 1 tarefa com
 * timestamp mais novo no lote 1 fazia o cursor saltar para o da tarefa e
 * perdiam-se os relatórios 1001-1200). Cada tabela traz o seu próprio cursor,
 * e o `since` aceita o mapa {tabela: {ts, id}} (ou um ISO simples de versões
 * antigas). Usa-se o par (updated_at, id) para nunca repetir nem saltar linhas
 * com o MESMO timestamp no limite do lote.
 */
const PULL_LIMIT = 1000;
// Semântica do protocolo antigo: "estritamente maior que o ISO recebido".
// id = máximo (ordenação de texto) ⇒ nada com o mesmo ts é repetido.
const LEGACY_CURSOR_ID = '\uffff';

function parseSinceCursors(raw) {
  if (!raw) return null;
  const str = String(raw);
  if (!str.startsWith('{')) {
    // Protocolo antigo: um único ISO valia para todas as tabelas com a
    // semântica "estritamente maior que ts". id = máximo preserva isso na
    // comparação composta (updated_at, id) > (ts, id).
    const d = new Date(Number(str) || str);
    if (Number.isNaN(d.getTime())) {
      const err = new Error('Parâmetro "since" inválido');
      err.status = 400;
      throw err;
    }
    const out = {};
    for (const table of ['reports', 'tasks', 'notes', 'tools', 'equipment', 'locations', 'doors', 'materials']) {
      out[table] = { ts: d.toISOString(), id: LEGACY_CURSOR_ID };
    }
    return out;
  }
  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch {
    const err = new Error('Parâmetro "since" inválido');
    err.status = 400;
    throw err;
  }
  if (!parsed || typeof parsed !== 'object') {
    const err = new Error('Parâmetro "since" inválido');
    err.status = 400;
    throw err;
  }
  const out = {};
  for (const table of ['reports', 'tasks', 'notes', 'tools', 'equipment', 'locations', 'doors', 'materials']) {
    const c = parsed[table];
    let ts = (c && c.ts) || '1970-01-01T00:00:00Z';
    let id = (c && c.id) || '';
    const d = new Date(Number(ts) || ts);
    if (Number.isNaN(d.getTime())) {
      const err = new Error(`Cursor inválido para ${table}`);
      err.status = 400;
      throw err;
    }
    out[table] = { ts: d.toISOString(), id: String(id) };
  }
  return out;
}

export async function getSyncPull(sinceTimestamp) {
  const p = getPool();
  if (!p) throw new Error('Base de dados não disponível');

  const cursors = parseSinceCursors(sinceTimestamp) || {};
  const cursor = (t) => cursors[t] || { ts: '1970-01-01T00:00:00Z', id: '' };

  const [repRes, taskRes, noteRes, toolRes, equipRes, locRes, doorRes, matRes] = await Promise.all([
    p.query('SELECT * FROM reports WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('reports').ts, cursor('reports').id, PULL_LIMIT]),
    p.query('SELECT * FROM tasks WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('tasks').ts, cursor('tasks').id, PULL_LIMIT]),
    p.query('SELECT * FROM notes WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('notes').ts, cursor('notes').id, PULL_LIMIT]),
    p.query('SELECT * FROM tools WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('tools').ts, cursor('tools').id, PULL_LIMIT]),
    p.query('SELECT * FROM equipment WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('equipment').ts, cursor('equipment').id, PULL_LIMIT]),
    p.query('SELECT * FROM locations WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('locations').ts, cursor('locations').id, PULL_LIMIT]),
    p.query('SELECT * FROM doors WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('doors').ts, cursor('doors').id, PULL_LIMIT]),
    p.query('SELECT * FROM materials WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at ASC, id ASC LIMIT $3', [cursor('materials').ts, cursor('materials').id, PULL_LIMIT])
  ]);

  // Transformar snake_case para camelCase
  const reports = repRes.rows.map(r => ({
    id: r.id,
    date: r.date?.toISOString ? r.date.toISOString() : r.date,
    locationId: r.location_id,
    locationName: r.location_name,
    priority: r.priority,
    status: r.status,
    sectorCode: r.sector_code,
    description: r.description,
    timeSpent: r.time_spent_minutes,
    timeSpentMinutes: r.time_spent_minutes,
    photos: r.photos,
    materials: r.materials,
    equipmentId: r.equipment_id || '',
    equipmentName: r.equipment_name || '',
    doorId: r.door_id || '',
    doorNumero: r.door_numero || '',
    author: r.author || '',
    resolutionNotes: r.resolution_notes || '',
    resolvedAt: r.resolved_at ? (r.resolved_at.toISOString ? r.resolved_at.toISOString() : r.resolved_at) : null,
    createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at,
    deleted: r.deleted,
    synced: 1
  }));

  const tasks = taskRes.rows.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    notes: t.notes || '',
    dueDate: t.due_date,
    doneAt: t.done_at ? (t.done_at.toISOString ? t.done_at.toISOString() : t.done_at) : null,
    locationId: t.location_id,
    locationName: t.location_name || '',
    equipmentId: t.equipment_id,
    done: t.done,
    priority: t.priority,
    recurring: t.recurring,
    createdAt: t.created_at?.toISOString ? t.created_at.toISOString() : t.created_at,
    updatedAt: t.updated_at?.toISOString ? t.updated_at.toISOString() : t.updated_at,
    deleted: t.deleted,
    synced: 1
  }));

  const notes = noteRes.rows.map(n => ({
    id: n.id,
    title: n.title,
    body: n.content,
    content: n.content,
    pinned: n.pinned,
    locationId: n.location_id,
    locationName: n.location_name || '',
    audioBlob: n.audio_blob,
    audioDuration: n.audio_duration || 0,
    photoIds: n.photo_ids || [],
    createdAt: n.created_at?.toISOString ? n.created_at.toISOString() : n.created_at,
    updatedAt: n.updated_at?.toISOString ? n.updated_at.toISOString() : n.updated_at,
    deleted: n.deleted,
    synced: 1
  }));

  const tools = toolRes.rows.map(tl => ({
    id: tl.id,
    name: tl.name,
    unit: tl.unit || 'un',
    locationId: tl.location_id,
    locationName: tl.location_name || '',
    qty: tl.qty,
    minQty: tl.min_qty,
    notes: tl.notes || '',
    createdAt: tl.created_at?.toISOString ? tl.created_at.toISOString() : tl.created_at,
    updatedAt: tl.updated_at?.toISOString ? tl.updated_at.toISOString() : tl.updated_at,
    deleted: tl.deleted,
    synced: 1
  }));

  const equipment = equipRes.rows.map(e => ({
    id: e.id,
    name: e.name,
    category: e.category,
    locationId: e.location_id,
    locationName: e.location_name || '',
    brand: e.brand || '',
    model: e.model || '',
    status: e.status,
    serial: e.serial,
    installedAt: e.installed_at ? (e.installed_at.toISOString ? e.installed_at.toISOString() : e.installed_at) : null,
    warrantyUntil: e.warranty_until ? (e.warranty_until.toISOString ? e.warranty_until.toISOString() : e.warranty_until) : null,
    notes: e.notes || '',
    qrCode: e.qr_code,
    createdAt: e.created_at?.toISOString ? e.created_at.toISOString() : e.created_at,
    updatedAt: e.updated_at?.toISOString ? e.updated_at.toISOString() : e.updated_at,
    deleted: e.deleted,
    synced: 1
  }));

  const doors = doorRes.rows.map(d => ({
    id: d.id,
    numero: d.numero,
    numeroAntigo: d.numero_antigo || '',
    lado: d.lado,
    piso: d.piso,
    descricao: d.descricao || '',
    tipo: d.tipo,
    areaOriginal: d.area_original || '',
    sectorId: d.sector_id,
    sectorCode: d.sector_code,
    sectorName: d.sector_name,
    nome: d.nome,
    status: d.status,
    notas: d.notas || '',
    createdAt: d.created_at?.toISOString ? d.created_at.toISOString() : d.created_at,
    updatedAt: d.updated_at?.toISOString ? d.updated_at.toISOString() : d.updated_at,
    deleted: d.deleted,
    synced: 1
  }));

  const locations = locRes.rows.map(l => ({
    id: l.id,
    name: l.name,
    number: l.number || '',
    sectorId: l.sector_id || '',
    sectorName: l.sector_name || '',
    isCustom: l.is_custom,
    description: l.description,
    createdAt: l.created_at?.toISOString ? l.created_at.toISOString() : l.created_at,
    updatedAt: l.updated_at?.toISOString ? l.updated_at.toISOString() : l.updated_at,
    deleted: l.deleted,
    synced: 1
  }));

  // tool_moves NÃO entra no pull de propósito: os ids locais (++id Dexie)
  // colidiriam com os SERIAL do servidor e apagavam o diário do técnico.
  // O histórico de movimentos vive no servidor; o stock atual viaja em tools.
  const materials = matRes.rows.map(m => ({
    id: m.id,
    name: m.name,
    createdAt: m.created_at?.toISOString ? m.created_at.toISOString() : m.created_at,
    updatedAt: m.updated_at?.toISOString ? m.updated_at.toISOString() : m.updated_at,
    deleted: m.deleted,
    synced: 1
  }));

  // Cursor POR TABELA: a última linha (updated_at, id) de cada lote. Tabela
  // vazia mantém o cursor que veio (não avançar à toa). hasMore só é true
  // quando alguma tabela encheu o teto — o cliente pede o resto POR TABELA.
  const tables = { reports: repRes, tasks: taskRes, notes: noteRes, tools: toolRes,
    equipment: equipRes, locations: locRes, doors: doorRes, materials: matRes };
  const newCursors = {};
  for (const [table, res] of Object.entries(tables)) {
    if (res.rows.length === 0) {
      newCursors[table] = cursor(table);
      continue;
    }
    const last = res.rows[res.rows.length - 1];
    const iso = last.updated_at?.toISOString ? last.updated_at.toISOString() : last.updated_at;
    newCursors[table] = { ts: iso, id: String(last.id) };
  }
  const hasMore = Object.values(tables).some((r) => r.rows.length >= PULL_LIMIT);

  // Compat: timestamp global = maior updated_at do lote (para registos antigos
  // e para o ecrã de sincronização). O avanço real é por tabela (cursors).
  const allRows = [...repRes.rows, ...taskRes.rows, ...noteRes.rows, ...toolRes.rows,
    ...equipRes.rows, ...locRes.rows, ...doorRes.rows, ...matRes.rows];
  let batchMax = '1970-01-01T00:00:00Z';
  for (const row of allRows) {
    const t = row.updated_at;
    const iso = t && t.toISOString ? t.toISOString() : t;
    if (iso && iso > batchMax) batchMax = iso;
  }

  return {
    timestamp: batchMax,
    cursors: newCursors,
    hasMore,
    reports,
    tasks,
    notes,
    tools,
    equipment,
    locations,
    doors,
    materials
  };
}
