import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockSyncServer, RemoteReport, RemoteLocation } from '../helpers/mock-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_BEFORE_PATH = path.join(__dirname, '../fixtures/sample_before.jpg');

test.describe('Tier 3: Cross-Feature Interactions', () => {
  let mockServer: MockSyncServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockSyncServer();
    await mockServer.setup(page);
    await page.goto('/');
  });

  test('T3.1: Offline location + report dependency sync ordering', async ({ page }) => {
    // Start offline
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // 1. Create custom location offline
    await page.click('#btn-new-report');
    await page.click('#btn-add-location-trigger');
    await page.fill('#input-location-name', 'Torre de Transmissão Sul');
    await page.click('#btn-save-location');

    // 2. Create report linked to that custom location offline
    await page.fill('#input-description', 'Verificação de antenas e cablagens');
    await page.fill('#input-time-spent', '60');
    await page.click('#btn-save-report');

    await expect(page.locator('.badge-pending')).toBeVisible();

    // 3. Reconnect network
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Wait for auto-sync completion
    await expect(page.locator('.badge-synced')).toBeVisible({ timeout: 5000 });

    // Verify remote server state
    const remoteLocations = mockServer.getRemoteLocations();
    const remoteReports = mockServer.getRemoteReports();

    const createdLocation = remoteLocations.find(l => l.name === 'Torre de Transmissão Sul');
    expect(createdLocation).toBeDefined();

    const createdReport = remoteReports.find(r => r.description === 'Verificação de antenas e cablagens');
    expect(createdReport).toBeDefined();
    expect(createdReport?.locationId).toBe(createdLocation?.id);
  });

  test('T3.2: Offline edit + soft-delete pre-sync cycle', async ({ page }) => {
    // Start offline
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // 1. Create report offline
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório Rascunho para Eliminar');
    await page.fill('#input-time-spent', '30');
    await page.click('#btn-save-report');

    // 2. Edit report offline
    await page.click('.report-card');
    await page.click('#btn-edit-report');
    await page.fill('#input-description', 'Relatório Editado antes de apagar');
    await page.click('#btn-save-report');

    // 3. Soft-delete report offline
    await page.click('.report-card');
    await page.click('#btn-delete-report');
    await page.click('#btn-confirm-delete');

    await expect(page.locator('.report-card')).toHaveCount(0);

    // 4. Reconnect network
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Give time for queue processing
    await page.waitForTimeout(1000);

    // Verify remote server does NOT contain active report (or has deleted = 1)
    const remoteReports = mockServer.getRemoteReports();
    const activeRemoteReports = remoteReports.filter(r => r.deleted === 0);
    expect(activeRemoteReports).toHaveLength(0);
  });

  test('T3.3: Multi-report queue flushes (5 offline reports synced chronologically)', async ({ page }) => {
    // Start offline
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // Create 5 reports sequentially offline
    for (let i = 1; i <= 5; i++) {
      await page.click('#btn-new-report');
      await page.selectOption('#select-location', 'LOC_PITCH');
      await page.fill('#input-description', `Relatório Sequencial N.º ${i}`);
      await page.fill('#input-time-spent', `${i * 10}`);
      await page.click('#btn-save-report');
      await page.waitForTimeout(100);
    }

    await expect(page.locator('.badge-pending')).toHaveCount(5);

    // Reconnect network
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // All 5 cards should transition to synced
    await expect(page.locator('.badge-synced')).toHaveCount(5, { timeout: 5000 });

    const remoteReports = mockServer.getRemoteReports();
    expect(remoteReports).toHaveLength(5);
  });

  test('T3.4: Last-Write-Wins (LWW) conflict handling using ISO timestamps', async ({ page }) => {
    // Seed server with existing report
    const serverTimestamp = '2026-08-11T10:00:00.000Z';
    const reportId = 'REP_CONFLICT_1';
    mockServer.seedReports([
      {
        id: reportId,
        date: '2026-08-11T10:00:00.000Z',
        locationId: 'LOC_PITCH',
        locationName: 'Relvado Principal',
        description: 'Versão do Servidor Remoto',
        timeSpentMinutes: 30,
        photos: [],
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
        synced: 1,
        deleted: 0
      }
    ]);

    // Reload page to fetch remote state
    await page.reload();
    await expect(page.locator('.report-card').first()).toContainText('Versão do Servidor Remoto');

    // Go offline
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // Edit report locally offline with newer timestamp
    await page.click('.report-card');
    await page.click('#btn-edit-report');
    await page.fill('#input-description', 'Versão Local Mais Recente (LWW Winner)');
    await page.click('#btn-save-report');

    // Reconnect
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Sync engine processes queue; local update wins because local updatedAt > server updatedAt
    await expect(page.locator('.badge-synced')).toBeVisible({ timeout: 5000 });
    const remoteReports = mockServer.getRemoteReports();
    expect(remoteReports[0].description).toBe('Versão Local Mais Recente (LWW Winner)');
  });

  test('T3.5: Combined multi-entity single offline session atomic sync', async ({ page }) => {
    // Start offline
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // 1. Add photo + custom location + create report in single session
    await page.click('#btn-new-report');
    await page.click('#btn-add-location-trigger');
    await page.fill('#input-location-name', 'Balneário de Arbitragem');
    await page.click('#btn-save-location');

    await page.fill('#input-description', 'Manutenção completa de balneário de arbitragem com fotos');
    await page.fill('#input-time-spent', '75');
    await page.setInputFiles('#input-photo-before', SAMPLE_BEFORE_PATH);
    await page.click('#btn-save-report');

    await expect(page.locator('.badge-pending')).toBeVisible();

    // Reconnect network
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Verify complete sync across both entities
    await expect(page.locator('.badge-synced')).toBeVisible({ timeout: 5000 });

    const remoteLocations = mockServer.getRemoteLocations();
    const remoteReports = mockServer.getRemoteReports();

    expect(remoteLocations.some(l => l.name === 'Balneário de Arbitragem')).toBe(true);
    const syncedReport = remoteReports.find(r => r.description.includes('Manutenção completa'));
    expect(syncedReport).toBeDefined();
    expect(syncedReport?.photos.length).toBeGreaterThan(0);
  });
});
