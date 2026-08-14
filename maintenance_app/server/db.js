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

        -- Índices para buscas rápidas de sincronização
        CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_tools_updated ON tools(updated_at);
        CREATE INDEX IF NOT EXISTS idx_equipment_updated ON equipment(updated_at);
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
 * Processa um lote de mutações da sync_queue (Push)
 */
export async function processSyncPush(mutations) {
  const p = getPool();
  if (!p) throw new Error('Base de dados não disponível');

  const client = await p.connect();
  const processed = [];

  try {
    await client.query('BEGIN');

    for (const item of mutations) {
      const { entityType, entityId, action, payload } = item;
      const now = new Date().toISOString();

      if (entityType === 'report' || entityType === 'reports') {
        if (action === 'DELETE') {
          await client.query(
            `UPDATE reports SET deleted = 1, updated_at = $1 WHERE id = $2`,
            [now, entityId]
          );
        } else {
          const {
            date, locationId, locationName, priority, status,
            sectorCode, description, timeSpentMinutes, photos,
            materials, createdAt, updatedAt, deleted
          } = payload || {};

          await client.query(`
            INSERT INTO reports (id, date, location_id, location_name, priority, status, sector_code, description, time_spent_minutes, photos, materials, created_at, updated_at, deleted)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
              date = EXCLUDED.date,
              location_id = EXCLUDED.location_id,
              location_name = EXCLUDED.location_name,
              priority = EXCLUDED.priority,
              status = EXCLUDED.status,
              sector_code = EXCLUDED.sector_code,
              description = EXCLUDED.description,
              time_spent_minutes = EXCLUDED.time_spent_minutes,
              photos = EXCLUDED.photos,
              materials = EXCLUDED.materials,
              updated_at = EXCLUDED.updated_at,
              deleted = EXCLUDED.deleted
            WHERE reports.updated_at IS NULL OR EXCLUDED.updated_at >= reports.updated_at;
          `, [
            entityId,
            date || now,
            locationId || null,
            locationName || '',
            priority || 'medium',
            status || 'pending',
            sectorCode || '',
            description || '',
            timeSpentMinutes || 0,
            JSON.stringify(photos || []),
            materials || '',
            createdAt || now,
            updatedAt || now,
            deleted ? 1 : 0
          ]);
        }
      } else if (entityType === 'task' || entityType === 'tasks') {
        if (action === 'DELETE') {
          await client.query(
            `UPDATE tasks SET deleted = 1, updated_at = $1 WHERE id = $2`,
            [now, entityId]
          );
        } else {
          const { title, description, dueDate, locationId, equipmentId, done, priority, recurring, createdAt, updatedAt, deleted } = payload || {};
          await client.query(`
            INSERT INTO tasks (id, title, description, due_date, location_id, equipment_id, done, priority, recurring, created_at, updated_at, deleted)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              due_date = EXCLUDED.due_date,
              location_id = EXCLUDED.location_id,
              equipment_id = EXCLUDED.equipment_id,
              done = EXCLUDED.done,
              priority = EXCLUDED.priority,
              recurring = EXCLUDED.recurring,
              updated_at = EXCLUDED.updated_at,
              deleted = EXCLUDED.deleted
            WHERE tasks.updated_at IS NULL OR EXCLUDED.updated_at >= tasks.updated_at;
          `, [
            entityId,
            title || '',
            description || '',
            dueDate || '',
            locationId || null,
            equipmentId || null,
            done ? 1 : 0,
            priority || 'medium',
            recurring || null,
            createdAt || now,
            updatedAt || now,
            deleted ? 1 : 0
          ]);
        }
      } else if (entityType === 'note' || entityType === 'notes') {
        if (action === 'DELETE') {
          await client.query(
            `UPDATE notes SET deleted = 1, updated_at = $1 WHERE id = $2`,
            [now, entityId]
          );
        } else {
          const { title, content, pinned, locationId, audioBlob, createdAt, updatedAt, deleted } = payload || {};
          await client.query(`
            INSERT INTO notes (id, title, content, pinned, location_id, audio_blob, created_at, updated_at, deleted)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              pinned = EXCLUDED.pinned,
              location_id = EXCLUDED.location_id,
              audio_blob = EXCLUDED.audio_blob,
              updated_at = EXCLUDED.updated_at,
              deleted = EXCLUDED.deleted
            WHERE notes.updated_at IS NULL OR EXCLUDED.updated_at >= notes.updated_at;
          `, [
            entityId,
            title || '',
            content || '',
            pinned ? 1 : 0,
            locationId || null,
            audioBlob || null,
            createdAt || now,
            updatedAt || now,
            deleted ? 1 : 0
          ]);
        }
      } else if (entityType === 'tool' || entityType === 'tools') {
        if (action === 'DELETE') {
          await client.query(
            `UPDATE tools SET deleted = 1, updated_at = $1 WHERE id = $2`,
            [now, entityId]
          );
        } else {
          const { name, locationId, qty, minQty, createdAt, updatedAt, deleted } = payload || {};
          await client.query(`
            INSERT INTO tools (id, name, location_id, qty, min_qty, created_at, updated_at, deleted)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              location_id = EXCLUDED.location_id,
              qty = EXCLUDED.qty,
              min_qty = EXCLUDED.min_qty,
              updated_at = EXCLUDED.updated_at,
              deleted = EXCLUDED.deleted
            WHERE tools.updated_at IS NULL OR EXCLUDED.updated_at >= tools.updated_at;
          `, [
            entityId,
            name || '',
            locationId || null,
            qty !== undefined ? qty : 0,
            minQty !== undefined ? minQty : 0,
            createdAt || now,
            updatedAt || now,
            deleted ? 1 : 0
          ]);
        }
      } else if (entityType === 'location' || entityType === 'locations') {
        const { name, isCustom, description, createdAt, updatedAt, deleted } = payload || {};
        await client.query(`
          INSERT INTO locations (id, name, is_custom, description, created_at, updated_at, deleted)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            is_custom = EXCLUDED.is_custom,
            description = EXCLUDED.description,
            updated_at = EXCLUDED.updated_at,
            deleted = EXCLUDED.deleted
          WHERE locations.updated_at IS NULL OR EXCLUDED.updated_at >= locations.updated_at;
        `, [
          entityId,
          name || '',
          Boolean(isCustom),
          description || '',
          createdAt || now,
          updatedAt || now,
          deleted ? 1 : 0
        ]);
      } else if (entityType === 'equipment') {
        if (action === 'DELETE') {
          await client.query(
            `UPDATE equipment SET deleted = 1, updated_at = $1 WHERE id = $2`,
            [now, entityId]
          );
        } else {
          const { name, category, locationId, status, serial, qrCode, createdAt, updatedAt, deleted } = payload || {};
          await client.query(`
            INSERT INTO equipment (id, name, category, location_id, status, serial, qr_code, created_at, updated_at, deleted)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              category = EXCLUDED.category,
              location_id = EXCLUDED.location_id,
              status = EXCLUDED.status,
              serial = EXCLUDED.serial,
              qr_code = EXCLUDED.qr_code,
              updated_at = EXCLUDED.updated_at,
              deleted = EXCLUDED.deleted
            WHERE equipment.updated_at IS NULL OR EXCLUDED.updated_at >= equipment.updated_at;
          `, [
            entityId,
            name || '',
            category || '',
            locationId || null,
            status || 'operational',
            serial || '',
            qrCode || '',
            createdAt || now,
            updatedAt || now,
            deleted ? 1 : 0
          ]);
        }
      }

      processed.push(item.id || entityId);
    }

    await client.query('COMMIT');
    return { success: true, processedCount: processed.length, processedIds: processed };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Puxa alterações ocorridas desde um timestamp (Pull)
 */
export async function getSyncPull(sinceTimestamp) {
  const p = getPool();
  if (!p) throw new Error('Base de dados não disponível');

  const since = sinceTimestamp ? new Date(Number(sinceTimestamp) || sinceTimestamp).toISOString() : '1970-01-01T00:00:00Z';

  const [repRes, taskRes, noteRes, toolRes, equipRes, locRes] = await Promise.all([
    p.query('SELECT * FROM reports WHERE updated_at > $1 ORDER BY updated_at ASC', [since]),
    p.query('SELECT * FROM tasks WHERE updated_at > $1 ORDER BY updated_at ASC', [since]),
    p.query('SELECT * FROM notes WHERE updated_at > $1 ORDER BY updated_at ASC', [since]),
    p.query('SELECT * FROM tools WHERE updated_at > $1 ORDER BY updated_at ASC', [since]),
    p.query('SELECT * FROM equipment WHERE updated_at > $1 ORDER BY updated_at ASC', [since]),
    p.query('SELECT * FROM locations WHERE updated_at > $1 ORDER BY updated_at ASC', [since])
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
    timeSpentMinutes: r.time_spent_minutes,
    photos: r.photos,
    materials: r.materials,
    createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at,
    deleted: r.deleted,
    synced: 1
  }));

  const tasks = taskRes.rows.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.due_date,
    locationId: t.location_id,
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
    content: n.content,
    pinned: n.pinned,
    locationId: n.location_id,
    audioBlob: n.audio_blob,
    createdAt: n.created_at?.toISOString ? n.created_at.toISOString() : n.created_at,
    updatedAt: n.updated_at?.toISOString ? n.updated_at.toISOString() : n.updated_at,
    deleted: n.deleted,
    synced: 1
  }));

  const tools = toolRes.rows.map(tl => ({
    id: tl.id,
    name: tl.name,
    locationId: tl.location_id,
    qty: tl.qty,
    minQty: tl.min_qty,
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
    status: e.status,
    serial: e.serial,
    qrCode: e.qr_code,
    createdAt: e.created_at?.toISOString ? e.created_at.toISOString() : e.created_at,
    updatedAt: e.updated_at?.toISOString ? e.updated_at.toISOString() : e.updated_at,
    deleted: e.deleted,
    synced: 1
  }));

  const locations = locRes.rows.map(l => ({
    id: l.id,
    name: l.name,
    isCustom: l.is_custom,
    description: l.description,
    createdAt: l.created_at?.toISOString ? l.created_at.toISOString() : l.created_at,
    updatedAt: l.updated_at?.toISOString ? l.updated_at.toISOString() : l.updated_at,
    deleted: l.deleted,
    synced: 1
  }));

  return {
    timestamp: Date.now(),
    reports,
    tasks,
    notes,
    tools,
    equipment,
    locations
  };
}
