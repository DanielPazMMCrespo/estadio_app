/**
 * Cópia de segurança da base partilhada (JSON).
 *
 * Usa o próprio endpoint de pull com since=0: despeja reports, tasks, notes,
 * tools, equipment, locations, doors e materials para um ficheiro datado em
 * backups/. Sem dependências novas (fetch é nativo do Node 18+).
 *
 * Uso (a partir de maintenance_app/):
 *   API_URL=https://<host> SYNC_TOKEN=<token> node scripts/backup.mjs
 *
 * O token tem de ser o mesmo SYNC_TOKEN do servidor. Sem token e com o
 * servidor sem SYNC_TOKEN, funciona na mesma (rede interna).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TOKEN = process.env.SYNC_TOKEN || '';

const headers = {};
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

const res = await fetch(`${API_URL}/api/sync/pull?since=0`, { headers });
if (!res.ok) {
  console.error(`Pull falhou: HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();

const dir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = path.join(dir, `backup-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(data, null, 2));

const counts = ['reports', 'tasks', 'notes', 'tools', 'equipment', 'locations', 'doors', 'materials']
  .map((k) => `${k}=${Array.isArray(data[k]) ? data[k].length : 0}`)
  .join(' ');
console.log(`Backup gravado em ${file} (${counts})`);
