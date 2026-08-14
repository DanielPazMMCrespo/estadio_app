import { describe, it, expect, beforeEach } from 'vitest';
import { EstadioMaintenanceDB } from '../../src/db/db.js';
import { ReportsRepository } from '../../src/db/reportsRepo.js';
import { LocationsRepository } from '../../src/db/locationsRepo.js';
import { AudioService } from '../../src/services/audioService.js';
import { StadiumMapComponent } from '../../src/ui/stadiumMap.js';
import 'fake-indexeddb/auto';

describe('Field Tools & Modern Features Test Suite', () => {
  let db;
  let reportsRepo;
  let locationsRepo;

  beforeEach(async () => {
    db = new EstadioMaintenanceDB('TestFieldToolsDB_' + Date.now() + '_' + Math.random());
    await db.open();
    reportsRepo = new ReportsRepository(db);
    locationsRepo = new LocationsRepository(db);
  });

  it('creates reports with priority, status, sectorCode and audio metadata', async () => {
    const report = await reportsRepo.create({
      locationId: 'LOC_WEST_STAND',
      locationName: 'Bancada Poente',
      sectorCode: 'LOC_WEST_STAND',
      priority: 'critical',
      status: 'pending',
      description: 'Cadeira solta na fila 14',
      timeSpent: 25,
      materials: 'Parafusos M8, Chave sextavada',
      audioDuration: 12
    });

    expect(report.id).toBeDefined();
    expect(report.priority).toBe('critical');
    expect(report.status).toBe('pending');
    expect(report.sectorCode).toBe('LOC_WEST_STAND');
    expect(report.audioDuration).toBe(12);

    const saved = await reportsRepo.getById(report.id);
    expect(saved.priority).toBe('critical');
    expect(saved.description).toBe('Cadeira solta na fila 14');
  });

  it('progresses status with setStatus and updates timestamps', async () => {
    const report = await reportsRepo.create({
      locationId: 'LOC_PITCH',
      locationName: 'Relvado Principal',
      description: 'Aspersor entupido no meio-campo',
      timeSpent: 15
    });

    expect(report.status).toBe('pending');

    // Advance to in_progress
    const inProg = await reportsRepo.setStatus(report.id, 'in_progress');
    expect(inProg.status).toBe('in_progress');

    // Advance to resolved
    const resolved = await reportsRepo.setStatus(report.id, 'resolved', 'Desentupido e testado com pressão.');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.resolutionNotes).toBe('Desentupido e testado com pressão.');
  });

  it('correctly aggregates sector statistics for the StadiumMapComponent', async () => {
    await reportsRepo.create({
      locationId: 'LOC_NORTH_STAND',
      locationName: 'Topo Norte',
      sectorCode: 'LOC_NORTH_STAND',
      priority: 'critical',
      status: 'pending',
      description: 'Degrau com fissura',
      timeSpent: 30
    });

    await reportsRepo.create({
      locationId: 'LOC_NORTH_STAND',
      locationName: 'Topo Norte',
      sectorCode: 'LOC_NORTH_STAND',
      priority: 'medium',
      status: 'in_progress',
      description: 'Lâmpada fundida no corredor',
      timeSpent: 10
    });

    await reportsRepo.create({
      locationId: 'LOC_PITCH',
      locationName: 'Relvado Principal',
      sectorCode: 'LOC_PITCH',
      priority: 'low',
      status: 'resolved', // Should not count as active
      description: 'Corte de relva',
      timeSpent: 60
    });

    const activeReports = (await reportsRepo.getAll()).filter(r => r.status !== 'resolved');
    const map = new StadiumMapComponent(null);
    const stats = map.getSectorStats(activeReports);

    expect(stats['LOC_NORTH_STAND'].total).toBe(2);
    expect(stats['LOC_NORTH_STAND'].critical).toBe(1);
    expect(stats['LOC_NORTH_STAND'].inProgress).toBe(1);
    expect(stats['LOC_PITCH'].total).toBe(0);
  });

  it('validates AudioService static helpers', () => {
    expect(AudioService.getPlayableUrl(null)).toBe('');
    expect(AudioService.getPlayableUrl('data:audio/webm;base64,AAA')).toBe('data:audio/webm;base64,AAA');
  });
});
