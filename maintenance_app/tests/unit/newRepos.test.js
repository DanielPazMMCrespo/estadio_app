import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import { EstadioMaintenanceDB } from '../../src/db/db.js';
import { TasksRepository, toLocalDateISO, todayISO, tomorrowISO, nextRecurrenceDate } from '../../src/db/tasksRepo.js';
import { NotesRepository } from '../../src/db/notesRepo.js';
import { ToolsRepository, DEFAULT_TOOLS } from '../../src/db/toolsRepo.js';
import { EquipmentRepository, DEFAULT_EQUIPMENT } from '../../src/db/equipmentRepo.js';

function uniqueName(prefix = 'test_v4') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Replica exata das versões 1..3 do schema, para simular uma instalação antiga
 * que já tem dados antes da migração para a v4.
 */
class LegacyV3DB extends Dexie {
  constructor(dbName) {
    super(dbName);
    this.version(1).stores({
      reports: 'id, date, locationId, locationName, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount'
    });
    this.version(2).stores({
      reports: 'id, date, locationId, locationName, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      materials: 'id, name, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount'
    });
    this.version(3).stores({
      reports: 'id, date, locationId, locationName, priority, status, sectorCode, createdAt, updatedAt, synced, deleted',
      locations: 'id, name, isCustom, createdAt, synced',
      materials: 'id, name, createdAt, synced',
      sync_queue: '++id, entityType, entityId, action, timestamp, retryCount'
    });
  }
}

describe('Camada de dados v4', () => {
  let db;

  beforeEach(async () => {
    db = new EstadioMaintenanceDB(uniqueName());
    await db.open();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (db && db.isOpen()) {
      await db.delete();
      await db.close();
    }
  });

  // ---------------------------------------------------------------- A) schema

  describe('Schema v4', () => {
    it('cria as novas tabelas sem perder as antigas', async () => {
      const names = db.tables.map(t => t.name);
      expect(names).toEqual(expect.arrayContaining([
        'reports', 'locations', 'materials', 'sync_queue',
        'tasks', 'notes', 'tools', 'tool_moves', 'equipment'
      ]));
      expect(db.verno).toBe(4);
    });

    it('a migração v3 -> v4 não perde dados existentes', async () => {
      const dbName = uniqueName('migration');

      // 1. Instalação antiga na v3, com dados em todas as tabelas.
      const legacy = new LegacyV3DB(dbName);
      await legacy.open();
      expect(legacy.verno).toBe(3);

      await legacy.table('reports').put({
        id: 'rep-legacy', date: '2026-08-10T09:00:00Z',
        locationId: 'LOC_PITCH', locationName: 'Relvado Principal',
        priority: 'critical', status: 'pending', sectorCode: 'SEC_PITCH',
        description: 'Aspersor 7 empancado', photos: [],
        createdAt: '2026-08-10T09:00:00Z', updatedAt: '2026-08-10T09:00:00Z',
        synced: 0, deleted: 0
      });
      await legacy.table('locations').put({
        id: 'LOC_PITCH', name: 'Relvado Principal', isCustom: 0,
        createdAt: '2026-08-01T08:00:00Z', synced: 1
      });
      await legacy.table('materials').put({
        id: 'MAT_SILICONE', name: 'Silicone', createdAt: '2026-08-01T08:00:00Z', synced: 1
      });
      await legacy.table('sync_queue').add({
        entityType: 'report', entityId: 'rep-legacy', action: 'CREATE',
        payload: { id: 'rep-legacy' }, timestamp: 1754812800000, retryCount: 0
      });
      await legacy.close();

      // 2. Reabrir com a v4 — Dexie corre a migração.
      const upgraded = new EstadioMaintenanceDB(dbName);
      await upgraded.open();

      expect(upgraded.verno).toBe(4);

      const report = await upgraded.reports.get('rep-legacy');
      expect(report).toBeDefined();
      expect(report.description).toBe('Aspersor 7 empancado');
      expect(report.priority).toBe('critical');

      expect((await upgraded.locations.get('LOC_PITCH')).name).toBe('Relvado Principal');
      expect((await upgraded.materials.get('MAT_SILICONE')).name).toBe('Silicone');
      expect(await upgraded.sync_queue.count()).toBe(1);

      // 3. As novas tabelas existem e estão vazias.
      expect(await upgraded.tasks.count()).toBe(0);
      expect(await upgraded.notes.count()).toBe(0);
      expect(await upgraded.tools.count()).toBe(0);
      expect(await upgraded.tool_moves.count()).toBe(0);
      expect(await upgraded.equipment.count()).toBe(0);

      await upgraded.delete();
      await upgraded.close();
    });
  });

  // ---------------------------------------------------------------- B) tasks

  describe('tasksRepo', () => {
    let repo;

    beforeEach(() => {
      repo = new TasksRepository(db);
    });

    it('helpers de data usam o dia LOCAL, não UTC', () => {
      const d = new Date(2026, 0, 5, 23, 59, 59); // 5 de janeiro, 23:59 local
      expect(toLocalDateISO(d)).toBe('2026-01-05');

      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(todayISO()).toBe(expected);
    });

    it('getToday/getTomorrow respeitam a fronteira do dia local (23:30 de 31/dez)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 11, 31, 23, 30, 0)); // local

      expect(todayISO()).toBe('2026-12-31');
      expect(tomorrowISO()).toBe('2027-01-01');

      const hoje = await repo.create({ title: 'Verificar gerador', dueDate: '2026-12-31' });
      const amanha = await repo.create({ title: 'Regar relvado', dueDate: '2027-01-01' });
      await repo.create({ title: 'Tarefa antiga', dueDate: '2026-12-30' });

      const today = await repo.getToday();
      expect(today.map(t => t.id)).toEqual([hoje.id]);

      const tomorrow = await repo.getTomorrow();
      expect(tomorrow.map(t => t.id)).toEqual([amanha.id]);
    });

    it('getToday/getTomorrow respeitam a fronteira do dia local (00:30 de 1/jan)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2027, 0, 1, 0, 30, 0)); // local

      expect(todayISO()).toBe('2027-01-01');
      expect(tomorrowISO()).toBe('2027-01-02');

      const hoje = await repo.create({ title: 'Ronda matinal' }); // dueDate por omissão = hoje
      expect(hoje.dueDate).toBe('2027-01-01');

      const today = await repo.getToday();
      expect(today.map(t => t.id)).toEqual([hoje.id]);
      expect(await repo.getTomorrow()).toEqual([]);
    });

    it('getOverdue devolve só tarefas não feitas com data anterior a hoje', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 7, 14, 10, 0, 0));

      const atrasada = await repo.create({ title: 'Trocar disjuntor', dueDate: '2026-08-10' });
      const feita = await repo.create({ title: 'Já feita', dueDate: '2026-08-11' });
      await repo.toggleDone(feita.id);
      await repo.create({ title: 'Hoje', dueDate: '2026-08-14' });
      await repo.create({ title: 'Amanhã', dueDate: '2026-08-15' });

      const overdue = await repo.getOverdue();
      expect(overdue.map(t => t.id)).toEqual([atrasada.id]);
    });

    it('create escreve na sync_queue na mesma transação', async () => {
      const task = await repo.create({
        title: 'Substituir lâmpada da torre SW',
        locationId: 'LOC_EXT_LIGHTS',
        locationName: 'Torres de Iluminação do Estádio',
        priority: 'critical'
      });

      expect(task.done).toBe(0);
      expect(task.synced).toBe(0);
      expect(task.deleted).toBe(0);
      expect(task.priority).toBe('critical');

      const queue = await db.sync_queue.where('entityId').equals(task.id).toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].action).toBe('CREATE');
      expect(queue[0].entityType).toBe('task');
    });

    it('toggleDone alterna done e doneAt', async () => {
      const task = await repo.create({ title: 'Limpar canaletas' });

      const first = await repo.toggleDone(task.id);
      expect(first.task.done).toBe(1);
      expect(first.task.doneAt).toBeTruthy();
      expect(first.nextTask).toBeNull();

      const second = await repo.toggleDone(task.id);
      expect(second.task.done).toBe(0);
      expect(second.task.doneAt).toBeNull();
    });

    it('tarefa recorrente gera a próxima ocorrência ao ser marcada feita', async () => {
      const diaria = await repo.create({ title: 'Ronda diária', dueDate: '2026-08-14', recurring: 'daily' });
      const r1 = await repo.toggleDone(diaria.id);
      expect(r1.nextTask).not.toBeNull();
      expect(r1.nextTask.dueDate).toBe('2026-08-15');
      expect(r1.nextTask.recurring).toBe('daily');
      expect(r1.nextTask.done).toBe(0);
      expect(r1.nextTask.id).not.toBe(diaria.id);

      const semanal = await repo.create({ title: 'Ensaio do gerador', dueDate: '2026-08-14', recurring: 'weekly' });
      const r2 = await repo.toggleDone(semanal.id);
      expect(r2.nextTask.dueDate).toBe('2026-08-21');

      const mensal = await repo.create({ title: 'Inspeção do elevador', dueDate: '2026-01-31', recurring: 'monthly' });
      const r3 = await repo.toggleDone(mensal.id);
      expect(r3.nextTask.dueDate).toBe('2026-03-03'); // 31/fev normaliza para março

      // desmarcar não volta a gerar ocorrências
      const before = (await repo.getAll()).length;
      await repo.toggleDone(diaria.id);
      expect((await repo.getAll()).length).toBe(before);

      expect(nextRecurrenceDate('2026-08-31', 'monthly')).toBe('2026-10-01');
    });

    it('moveToTomorrow empurra a tarefa para amanhã', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 7, 14, 22, 45, 0));

      const task = await repo.create({ title: 'Apertar corrimão', dueDate: '2026-08-14' });
      const moved = await repo.moveToTomorrow(task.id);
      expect(moved.dueDate).toBe('2026-08-15');
      expect(await repo.getToday()).toEqual([]);
      expect((await repo.getTomorrow()).map(t => t.id)).toEqual([task.id]);
    });

    it('remove faz soft-delete e markSynced marca sincronizado', async () => {
      const task = await repo.create({ title: 'Verificar rede da baliza' });
      await repo.remove(task.id);

      expect((await repo.getById(task.id)).deleted).toBe(1);
      expect(await repo.getAll()).toEqual([]);

      await repo.markSynced(task.id);
      expect((await repo.getById(task.id)).synced).toBe(1);
    });

    it('create rejeita tarefa sem título', async () => {
      await expect(repo.create({})).rejects.toThrow(/título/i);
    });
  });

  // ---------------------------------------------------------------- C) notes

  describe('notesRepo', () => {
    let repo;

    beforeEach(() => {
      repo = new NotesRepository(db);
    });

    it('cria uma nota só com corpo e enfileira o sync', async () => {
      const note = await repo.create({ body: '  Válvula 3 a pingar  ' });
      expect(note.body).toBe('Válvula 3 a pingar');
      expect(note.pinned).toBe(0);
      expect(note.photoIds).toEqual([]);
      expect(note.synced).toBe(0);

      const queue = await db.sync_queue.where('entityId').equals(note.id).toArray();
      expect(queue[0].action).toBe('CREATE');
      expect(queue[0].entityType).toBe('note');
    });

    it('rejeita nota sem corpo', async () => {
      await expect(repo.create({ body: '   ' })).rejects.toThrow(/corpo/i);
    });

    it('getAll devolve fixadas no topo e depois as mais recentes', async () => {
      const a = await repo.create({ body: 'Nota A', createdAt: '2026-08-01T10:00:00Z' });
      await db.notes.update(a.id, { updatedAt: '2026-08-01T10:00:00Z' });
      const b = await repo.create({ body: 'Nota B', createdAt: '2026-08-05T10:00:00Z' });
      await db.notes.update(b.id, { updatedAt: '2026-08-05T10:00:00Z' });
      const c = await repo.create({ body: 'Nota C', createdAt: '2026-08-03T10:00:00Z' });
      await db.notes.update(c.id, { updatedAt: '2026-08-03T10:00:00Z' });

      let ordered = await repo.getAll();
      expect(ordered.map(n => n.body)).toEqual(['Nota B', 'Nota C', 'Nota A']);

      await repo.togglePinned(a.id);
      ordered = await repo.getAll();
      expect(ordered[0].body).toBe('Nota A');
      expect(ordered[0].pinned).toBe(1);

      await repo.togglePinned(a.id);
      expect((await repo.getById(a.id)).pinned).toBe(0);
    });

    it('search ignora acentos e maiúsculas', async () => {
      await repo.create({ body: 'Fuga no Balneário Visitante', locationName: 'Balneário Visitante' });
      await repo.create({ body: 'Cortar a relva na quinta' });

      const hits = await repo.search('balneario');
      expect(hits).toHaveLength(1);
      expect(hits[0].body).toContain('Balneário');

      expect(await repo.search('RELVA')).toHaveLength(1);
      expect(await repo.search('')).toHaveLength(2);
    });

    it('update e remove funcionam com soft-delete', async () => {
      const note = await repo.create({ body: 'Rascunho' });
      const updated = await repo.update(note.id, { body: 'Texto final', audioDuration: 12 });
      expect(updated.body).toBe('Texto final');
      expect(updated.audioDuration).toBe(12);

      await repo.remove(note.id);
      expect(await repo.getAll()).toEqual([]);
      expect((await repo.getById(note.id)).deleted).toBe(1);

      await repo.markSynced(note.id);
      expect((await repo.getById(note.id)).synced).toBe(1);
    });
  });

  // ---------------------------------------------------------------- D) tools

  describe('toolsRepo', () => {
    let repo;

    beforeEach(() => {
      repo = new ToolsRepository(db);
    });

    it('semeia o stock inicial do estádio uma única vez', async () => {
      const seeded = await repo.seedDefaults();
      expect(seeded.length).toBe(DEFAULT_TOOLS.length);
      expect(seeded.length).toBeGreaterThanOrEqual(20);

      const names = seeded.map(t => t.name);
      // nomes reaproveitados de DEFAULT_MATERIALS
      expect(names).toEqual(expect.arrayContaining([
        'Tinta de Marcação', 'Chave Inglesa', 'Chave de Fendas', 'Fita Isoladora', 'Silicone'
      ]));
      // e os novos, reais
      expect(names).toEqual(expect.arrayContaining([
        'Lâmpada de Projetor LED 400W', 'Aspersor de Rega Retrátil',
        'Vedante de Roscas (teflon)', 'Disjuntor 16A Bipolar',
        'Cabo Elétrico 3x2,5mm²', 'Escova de Relvado'
      ]));

      await repo.seedDefaults();
      expect(await db.tools.count()).toBe(DEFAULT_TOOLS.length);
    });

    it('take() baixa o stock, escreve o movimento e mantém tudo coerente', async () => {
      const tool = await repo.create({ name: 'Fita Isoladora', unit: 'un', qty: 10, minQty: 3 });

      const { tool: afterTake, move } = await repo.take(tool.id, 3, 'Reparação de cablagem', 'rep-77');
      expect(afterTake.qty).toBe(7);
      expect(move.delta).toBe(-3);
      expect(move.qtyAfter).toBe(7);
      expect(move.reason).toBe('Reparação de cablagem');
      expect(move.reportId).toBe('rep-77');
      expect(move.at).toBeTruthy();

      const stored = await repo.getById(tool.id);
      expect(stored.qty).toBe(7);
      expect(stored.synced).toBe(0);

      const moves = await repo.getMoves(tool.id);
      expect(moves).toHaveLength(1);
      expect(moves[0].qtyAfter).toBe(7);

      const queue = await db.sync_queue.where('entityType').equals('tool_move').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].action).toBe('TAKE');
    });

    it('take() recusa deixar o stock negativo e não escreve movimento', async () => {
      const tool = await repo.create({ name: 'Silicone', unit: 'un', qty: 2, minQty: 1 });

      await expect(repo.take(tool.id, 5)).rejects.toThrow(/Stock insuficiente/);

      expect((await repo.getById(tool.id)).qty).toBe(2);
      expect(await repo.getMoves(tool.id)).toEqual([]);
      expect(await db.tool_moves.count()).toBe(0);
      expect(await db.sync_queue.where('entityType').equals('tool_move').count()).toBe(0);
    });

    it('take() pode esvaziar o stock exatamente até zero', async () => {
      const tool = await repo.create({ name: 'Broca 8mm', unit: 'un', qty: 2 });
      const { tool: after } = await repo.take(tool.id, 2, 'Obra nos bancos');
      expect(after.qty).toBe(0);
      await expect(repo.take(tool.id, 1)).rejects.toThrow(/Stock insuficiente/);
    });

    it('take()/restock() mantêm qty e tool_moves coerentes ao longo do histórico', async () => {
      const tool = await repo.create({ name: 'Cabo Elétrico', unit: 'm', qty: 100, minQty: 30 });

      await repo.take(tool.id, 20, 'Ligação do marcador');
      await repo.restock(tool.id, 50, 'Compra de rolo novo');
      await repo.take(tool.id, 5.5, 'Reparação pontual');

      const stored = await repo.getById(tool.id);
      expect(stored.qty).toBe(124.5);

      const moves = await repo.getMoves(tool.id);
      expect(moves).toHaveLength(3);

      // o movimento mais recente reflete o stock atual
      expect(moves[0].qtyAfter).toBe(124.5);

      // a soma dos deltas reconstrói o stock a partir de 100
      const sum = moves.reduce((acc, m) => acc + m.delta, 0);
      expect(Math.round((100 + sum) * 1000) / 1000).toBe(124.5);

      const restockQueue = await db.sync_queue.where('entityType').equals('tool_move').toArray();
      expect(restockQueue.map(q => q.action)).toEqual(['TAKE', 'RESTOCK', 'TAKE']);

      // getMoves respeita o limite
      expect(await repo.getMoves(tool.id, 2)).toHaveLength(2);
    });

    it('take() rejeita ferramenta inexistente e quantidade zero', async () => {
      await expect(repo.take('NAO_EXISTE', 1)).rejects.toThrow(/não encontrada/);
      const tool = await repo.create({ name: 'Multímetro', qty: 1 });
      await expect(repo.take(tool.id, 0)).rejects.toThrow(/maior do que zero/);
    });

    it('getLowStock devolve ferramentas com qty <= minQty', async () => {
      const baixa = await repo.create({ name: 'Aspersor de Rega', unit: 'un', qty: 2, minQty: 3 });
      const igual = await repo.create({ name: 'Vedante', unit: 'un', qty: 4, minQty: 4 });
      await repo.create({ name: 'Escova de Relvado', unit: 'un', qty: 9, minQty: 2 });

      const low = await repo.getLowStock();
      const ids = low.map(t => t.id);
      expect(ids).toContain(baixa.id);
      expect(ids).toContain(igual.id);
      expect(low).toHaveLength(2);
      expect(low[0].id).toBe(baixa.id); // pior défice primeiro

      // consumir stock faz entrar no aviso
      const outra = await repo.create({ name: 'Disjuntor 16A', unit: 'un', qty: 5, minQty: 3 });
      await repo.take(outra.id, 2);
      expect((await repo.getLowStock()).map(t => t.id)).toContain(outra.id);
    });

    it('update, remove e markSynced comportam-se como nos repos existentes', async () => {
      const tool = await repo.create({ name: 'Chave Inglesa', qty: 4, minQty: 2 });

      const updated = await repo.update(tool.id, { minQty: 3, notes: 'Jogo completo', unit: 'un' });
      expect(updated.minQty).toBe(3);
      expect(updated.notes).toBe('Jogo completo');

      await expect(repo.update(tool.id, { qty: -1 })).rejects.toThrow(/negativa/);

      await repo.remove(tool.id);
      expect(await repo.getAll()).toEqual([]);
      expect((await repo.getById(tool.id)).deleted).toBe(1);

      await repo.markSynced(tool.id);
      expect((await repo.getById(tool.id)).synced).toBe(1);
    });
  });

  // ------------------------------------------------------------ E) equipment

  describe('equipmentRepo', () => {
    let repo;

    beforeEach(() => {
      repo = new EquipmentRepository(db);
    });

    it('semeia pelo menos 20 equipamentos ligados a localizações reais', async () => {
      const seeded = await repo.seedDefaults();
      expect(seeded.length).toBeGreaterThanOrEqual(20);
      expect(seeded.length).toBe(DEFAULT_EQUIPMENT.length);

      const locIds = new Set(seeded.map(e => e.locationId));
      ['LOC_EXT_LIGHTS', 'LOC_TECH_PUMPS', 'LOC_TECH_ELEC', 'LOC_PITCH_IRRIGATION', 'LOC_EXT_GENERATOR']
        .forEach(id => expect(locIds.has(id)).toBe(true));

      seeded.forEach(e => {
        expect(e.locationId).toBeTruthy();
        expect(e.locationId.startsWith('LOC_')).toBe(true);
      });

      await repo.seedDefaults();
      expect(await db.equipment.count()).toBe(DEFAULT_EQUIPMENT.length);
    });

    it('getByLocation devolve o equipamento daquela sala', async () => {
      await repo.seedDefaults();

      const towers = await repo.getByLocation('LOC_EXT_LIGHTS');
      expect(towers.length).toBeGreaterThanOrEqual(4);
      towers.forEach(e => expect(e.locationId).toBe('LOC_EXT_LIGHTS'));
      expect(towers.map(e => e.name)).toEqual(expect.arrayContaining([
        'Torre de Iluminação Noroeste', 'Torre de Iluminação Sudeste'
      ]));

      expect(await repo.getByLocation('LOC_INEXISTENTE')).toEqual([]);
      expect(await repo.getByLocation('')).toEqual([]);

      // soft-delete sai do resultado
      await repo.remove(towers[0].id);
      const after = await repo.getByLocation('LOC_EXT_LIGHTS');
      expect(after.map(e => e.id)).not.toContain(towers[0].id);
    });

    it('getByCategory, getBroken e setStatus', async () => {
      await repo.seedDefaults();

      const rega = await repo.getByCategory('rega');
      expect(rega.length).toBeGreaterThanOrEqual(3);
      rega.forEach(e => expect(e.category).toBe('rega'));

      const brokenBefore = await repo.getBroken();
      expect(brokenBefore.length).toBeGreaterThanOrEqual(1);
      brokenBefore.forEach(e => expect(e.status).toBe('avariado'));

      const target = rega.find(e => e.status === 'ok');
      await repo.setStatus(target.id, 'avariado');
      const brokenAfter = await repo.getBroken();
      expect(brokenAfter.map(e => e.id)).toContain(target.id);

      await repo.setStatus(target.id, 'ok');
      expect((await repo.getById(target.id)).status).toBe('ok');

      await expect(repo.setStatus(target.id, 'partido')).rejects.toThrow(/inválido/i);
    });

    it('create/update/search/remove e sync_queue', async () => {
      const eq = await repo.create({
        name: 'Projetor LED do Túnel',
        category: 'iluminacao',
        locationId: 'LOC_WEST_LIFTS',
        locationName: 'Elevadores & Acessos Poente',
        brand: 'Philips',
        model: 'BVP383',
        serial: 'PH-BVP-0099'
      });

      expect(eq.status).toBe('ok');
      expect(eq.synced).toBe(0);

      const queue = await db.sync_queue.where('entityId').equals(eq.id).toArray();
      expect(queue[0].entityType).toBe('equipment');
      expect(queue[0].action).toBe('CREATE');

      const updated = await repo.update(eq.id, { notes: 'Difusor riscado' });
      expect(updated.notes).toBe('Difusor riscado');

      expect((await repo.search('philips')).map(e => e.id)).toContain(eq.id);
      expect((await repo.search('PH-BVP')).map(e => e.id)).toContain(eq.id);
      expect((await repo.search('tunel')).map(e => e.id)).toContain(eq.id);
      expect(await repo.search('bomba de vácuo')).toEqual([]);

      await repo.remove(eq.id);
      expect(await repo.getAll()).toEqual([]);

      await repo.markSynced(eq.id);
      expect((await repo.getById(eq.id)).synced).toBe(1);
    });

    it('rejeita equipamento sem nome e normaliza categoria inválida', async () => {
      await expect(repo.create({})).rejects.toThrow(/nome/i);
      const eq = await repo.create({ name: 'Coisa nova', category: 'inexistente' });
      expect(eq.category).toBe('outro');
    });
  });
});
