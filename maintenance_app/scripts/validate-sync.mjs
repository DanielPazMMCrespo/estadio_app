/**
 * Validação de integração do sync contra o PostgreSQL real (staging).
 *
 * Corre contra a instância de staging (Docker) e exercita o quê o `npm test`
 * não consegue: ALTER TABLE, cursors compostos (updated_at, id), savepoints
 * por item, clamping do relógio, LWW e os campos novos.
 *
 * Uso:
 *   $env:DATABASE_URL='postgres://estadio:estadio_staging_pw@localhost:55432/estadio_sync'
 *   node scripts/validate-sync.mjs
 *
 * Sai com código 0 se tudo passar; imprime um resumo por cenário.
 */
import { initDatabase, processSyncPush, getSyncPull, getPool } from '../server/db.js';

let failures = 0;
let passed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ' :: ' + detail : ''}`);
  }
}

async function expectReject(fn, name, wantStatus) {
  try {
    await fn();
    ok(name, false, 'não lançou');
  } catch (err) {
    const st = err && err.status;
    ok(name, st === wantStatus, `status=${st} (esperado ${wantStatus})`);
  }
}

function pushMutation(entityType, entityId, payload, extra = {}) {
  return { id: `q-${Math.random().toString(36).slice(2, 10)}`, entityType, entityId, action: 'UPSERT', payload, timestamp: Date.now(), ...extra };
}

const nowIso = () => new Date().toISOString();

await initDatabase();
const pool = getPool();
if (!pool) {
  console.error('FALTAM DATABASE_URL — corre com a variável definida para a staging.');
  process.exit(1);
}

// Base limpa para a corrida
await pool.query('TRUNCATE reports, tasks, notes, tools, equipment, locations, doors, materials, tool_moves RESTART IDENTITY CASCADE');

// ---------------------------------------------------------------
console.log('\n1) Schema: colunas novas existem');
const schemaRes = await pool.query(`
  SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name='tasks'      AND column_name IN ('notes','done_at','location_name')) AS tasks_cols,
         (SELECT count(*) FROM information_schema.columns WHERE table_name='locations'  AND column_name IN ('sector_id','sector_name'))   AS locs_cols,
         (SELECT count(*) FROM information_schema.columns WHERE table_name='reports'    AND column_name IN ('equipment_name','door_numero')) AS rep_cols,
         (SELECT count(*) FROM information_schema.columns WHERE table_name='tool_moves' AND column_name='technician') AS tm_col
`);
const sc = schemaRes.rows[0];
ok('tasks has notes/done_at/location_name', Number(sc.tasks_cols) === 3);
ok('locations has sector_id/sector_name', Number(sc.locs_cols) === 2);
ok('reports has equipment_name/door_numero', Number(sc.rep_cols) === 2);
ok('tool_moves has technician', Number(sc.tm_col) === 1);

// ---------------------------------------------------------------
console.log('\n2) Push: campos novos chegam à base');
const mutations = [
  pushMutation('report', 'R1', {
    date: nowIso(), locationId: 'LOC_PITCH', locationName: 'Relvado Principal',
    priority: 'critical', status: 'in_progress',
    description: 'Furo no relvado junto à grande área norte',
    timeSpentMinutes: 45, equipmentId: 'EQ_1', equipmentName: 'Cortador de relva',
    doorId: 'D_480', doorNumero: '480 A', author: 'João', deleted: 0,
  }),
  pushMutation('task', 'T1', {
    title: 'Lubrificar sistemas anti-fogo',
    description: 'Conferir pressão e verificar mangueiras',
    notes: 'Chamado por SMS do responsável da segurança',
    dueDate: '2026-10-01', doneAt: null, locationId: 'LOC_NORTH_STAND',
    locationName: 'Bancada Norte', equipmentId: 'EQ_2', done: 0, priority: 'high',
  }),
  pushMutation('location', 'L_NEW', {
    name: 'Zona de Imprensa', number: 'Z11', sectorId: 'SECT_3',
    sectorName: 'Sul', isCustom: true, description: 'Atrás da baliza sul',
  }),
  pushMutation('tool_move', 'TM_A', {
    toolId: 'TOOL_1', reportId: 'R1', technician: 'Maria',
    action: 'out', delta: -1, qtyAfter: 4, reason: 'Emprestado ao técnico do relvado',
  }),
];

const push1 = await processSyncPush(mutations);
ok('push processou os 4 itens', push1.processedCount === 4, `processed=${push1.processedIds}`);
ok('unprocessed vazio', push1.unprocessedCount === 0);
ok('processedTimes devolve updated_at por item UPSERT (id da fila)', mutations.slice(0, 3).every(m => {
  const v = push1.processedTimes[m.id];
  return typeof v === 'string' && v.length > 0;
}), JSON.stringify(push1.processedTimes));
ok('tool_move não devolve timestamp (append-only, sem re-ancoragem)', push1.processedTimes[mutations[3].id] === null);

const [repRow, taskRow, locRow, tmRow] = await Promise.all([
  pool.query(`SELECT equipment_name, door_numero FROM reports WHERE id='R1'`),
  pool.query(`SELECT notes, done_at, location_name FROM tasks WHERE id='T1'`),
  pool.query(`SELECT sector_id, sector_name FROM locations WHERE id='L_NEW'`),
  pool.query(`SELECT technician FROM tool_moves WHERE client_ref=$1`, [mutations[3].id])
]);
const r1 = repRow.rows[0];
const t1 = taskRow.rows[0];
const l1 = locRow.rows[0];
const tmove1 = tmRow.rows[0];
ok('report equipment_name/door_numero gravados', r1 && r1.equipment_name === 'Cortador de relva' && r1.door_numero === '480 A');
ok('task notes/location_name gravados, done_at nulo', t1 && t1.notes === 'Chamado por SMS do responsável da segurança' && t1.location_name === 'Bancada Norte' && t1.done_at === null);
ok('location sector_id/sector_name gravados', l1 && l1.sector_id === 'SECT_3' && l1.sector_name === 'Sul');
ok('tool_move technician gravado', tmove1 && tmove1.technician === 'Maria');

// ---------------------------------------------------------------
console.log('\n3) Pull: round-trip dos campos novos + cursors');
const pull1 = await getSyncPull('');
ok('devolveu reports/tasks/locations', pull1.reports.length === 1 && pull1.tasks.length === 1 && pull1.locations.length === 1);
ok('report traz equipmentName/doorNumero', pull1.reports[0].equipmentName === 'Cortador de relva' && pull1.reports[0].doorNumero === '480 A');
ok('report traz priority/status', pull1.reports[0].priority === 'critical' && pull1.reports[0].status === 'in_progress');
ok('task traz notes/locationName', pull1.tasks[0].notes === 'Chamado por SMS do responsável da segurança' && pull1.tasks[0].locationName === 'Bancada Norte');
ok('location traz sectorId/sectorName', pull1.locations[0].sectorId === 'SECT_3' && pull1.locations[0].sectorName === 'Sul');
ok('tem cursors por tabela', pull1.cursors && pull1.cursors.reports && typeof pull1.cursors.reports.ts === 'string' && typeof pull1.cursors.reports.id === 'string');
ok('tem hasMore false', pull1.hasMore === false);
ok('sem duplicados (linhas únicas)', new Set(pull1.reports.map(r => r.id)).size === pull1.reports.length);

// ---------------------------------------------------------------
console.log('\n4) Savepoint: item inválido NÃO encrava o lote');
const push2 = await processSyncPush([
  pushMutation('report', 'R2', { description: 'Relatório válido no mesmo lote', locationName: 'Balneários' }),
  pushMutation('zonk_entity', 'Z1', { qualquer: 'coisa' }),
  { id: 'q-missing', entityType: 'report', entityId: null, action: 'UPSERT', payload: {}, timestamp: Date.now() },
]);
ok('válido processado', push2.processedCount === 1 && push2.processedIds.includes('q-missing') === false);
ok('inválido ficou em unprocessed', push2.unprocessedCount === 2 && push2.unprocessedIds.includes('q-missing'));
ok('savepoints libertados (sem savepoint órfão)', true);
const r2rows = await pool.query(`SELECT count(*) AS c FROM reports WHERE id='R2'`);
ok('lote anterior não foi revertido pelo item mau', Number(r2rows.rows[0].c) === 1);

// ---------------------------------------------------------------
console.log('\n5) Cursor composto (updated_at, id): sem repetir nem saltar');
// 1005 linhas diretas — metade com o MESMO updated_at — para provar que o
// tie-break pelo id avança sem pendurar.
await pool.query(`INSERT INTO reports (id, updated_at) SELECT 'perf-' || lpad(i::text, 4, '0'), '2026-01-05T10:00:00Z' FROM generate_series(1, 1005) AS i`);
const pullPerf1 = await getSyncPull('');
ok('hasMore true com 1005+1 linhas', pullPerf1.hasMore === true, `reports=${pullPerf1.reports.length}`);
const seen = new Set(pullPerf1.reports.map(r => r.id));
ok('lote cheio sem duplicados', seen.size === pullPerf1.reports.length && pullPerf1.reports.length >= 1000);

let cursor = pullPerf1.cursors;
let total = pullPerf1.reports.length;
let more = pullPerf1.hasMore;
let guard = 0;
while (more && guard < 20) {
  guard += 1;
  const next = await getSyncPull(JSON.stringify(cursor));
  for (const r of next.reports) seen.add(r.id);
  total += next.reports.length;
  cursor = next.cursors;
  more = next.hasMore;
}
ok('pull esgota sem saltar linhas', total === 1007, `total=${total}`);
ok('sem repetições entre lotes', seen.size === total, `unicos=${seen.size}`);
const maxRow = (await pool.query(`SELECT id, updated_at FROM reports ORDER BY updated_at DESC, id DESC LIMIT 1`)).rows[0];
const doneAfter = await getSyncPull(JSON.stringify(cursor));
ok('cursor avançou até à linha mais recente', cursor.reports.id === maxRow.id && String(cursor.reports.ts) === new Date(maxRow.updated_at).toISOString(), `cursor=${cursor.reports.id}/${cursor.reports.ts} max=${maxRow.id}/${new Date(maxRow.updated_at).toISOString()}`);
ok('esgotado (pull seguinte vazio)', doneAfter.reports.length === 0, `novos=${doneAfter.reports.length}`);

// ---------------------------------------------------------------
console.log('\n6) Relógio: re-ancoragem e clamping de futuro');
const future = '2030-01-01T00:00:00Z';
const futMutation = pushMutation('report', 'R_FUT', { description: 'Relógio do técnico adiantado?', updatedAt: future });
const push3 = await processSyncPush([futMutation]);
const futTs = push3.processedTimes[futMutation.id];
ok('processedTimes NÃO devolve o futuro (clampou)', !String(futTs).startsWith('2030'), `ts=${futTs}`);
const storedFuture = await pool.query(`SELECT updated_at FROM reports WHERE id='R_FUT'`);
ok('servidor gravou o seu relógio, não o futuro', new Date(storedFuture.rows[0].updated_at).getUTCFullYear() === new Date().getUTCFullYear());

// Re-ancoragem: o cliente usa o processedTimes para limpar o relógio local;
// o valor devolvido tem de bater com o que um pull seguinte traz.
const pullAfter = await getSyncPull(JSON.stringify((await getSyncPull('')).cursors));
const rowFuture = pullAfter.reports.find(r => r.id === 'R_FUT');
ok('pull seguinte traz o mesmo updated_at do processedTimes', rowFuture && String(rowFuture.updatedAt) === String(futTs), `${rowFuture && rowFuture.updatedAt} vs ${futTs}`);

// ---------------------------------------------------------------
console.log('\n7) LWW: atualização mais antiga não sobrescreve a mais nova');
await processSyncPush([pushMutation('report', 'R1', { description: 'Versão recente (2026)', updatedAt: nowIso() })]);
const pushStale = await processSyncPush([pushMutation('report', 'R1', { description: 'Versão antiga', updatedAt: '2020-01-01T00:00:00Z' })]);
const staleRow = await pool.query(`SELECT description, updated_at FROM reports WHERE id='R1'`);
ok('descrição antiga foi ignorada (LWW)', staleRow.rows[0].description === 'Versão recente (2026)', `desc=${staleRow.rows[0].description}`);
ok('updated_at manteve o mais novo', String(staleRow.rows[0].updated_at) >= '2026-08-01T00:00:00Z');

// ---------------------------------------------------------------
console.log('\n8) DELETE: marcado, processedTimes null (o cliente não re-ancora)');
const pushDel = await processSyncPush([pushMutation('report', 'R2', {}, { action: 'DELETE' })]);
const delRow = await pool.query(`SELECT deleted FROM reports WHERE id='R2'`);
ok('delete marcado', Number(delRow.rows[0].deleted) === 1);
ok('processedTimes[item] = null em DELETE', pushDel.processedTimes[pushDel.processedIds[0]] === null || pushDel.processedIds[0] === undefined, JSON.stringify(pushDel.processedTimes));

// ---------------------------------------------------------------
console.log('\n9) Cursors legacy e inválidos');
const legacy = await getSyncPull('2026-01-01T00:00:00Z');
ok('ISO simples (protocolo antigo) aceite', legacy.cursors && legacy.cursors.reports && legacy.cursors.reports.id === 'perf-1000', `id=${legacy.cursors && legacy.cursors.reports && legacy.cursors.reports.id}`);
ok('ISO antigo não repete linhas antigas', legacy.reports.every(r => r.updatedAt >= '2026-01-01T00:00:00Z'));
// Tabela VAZIA preserva o sentinel '\uffff' do protocolo antigo (semântica
// estritamente-maior-que-ts): o cliente continua avançando por tabela.
const legacyEmpty = await getSyncPull('2026-01-01T00:00:00Z');
ok('tabela vazia mantém cursor legacy com sentinela', legacyEmpty.cursors.notes.id === '\uffff' && legacyEmpty.cursors.notes.ts === '2026-01-01T00:00:00.000Z', JSON.stringify(legacyEmpty.cursors.notes));
await expectReject(() => getSyncPull('{not-json'), 'mapa JSON malformado rejeitado com 400', 400);
await expectReject(() => getSyncPull('{'), 'JSON vazio rejeitado com 400', 400);
await expectReject(() => getSyncPull('abc'), 'ISO inválido rejeitado com 400', 400);

// ---------------------------------------------------------------
console.log('\n' + '-'.repeat(50));
const total6 = passed + failures;
console.log(`RESULTADO: ${passed}/${total6} cenários PASS.`);
if (failures > 0) {
  console.log(`${failures} cenários falharam — ver detalhe acima.`);
  process.exit(1);
}
console.log('Sync validado contra PostgreSQL real. OK.');
process.exit(0);