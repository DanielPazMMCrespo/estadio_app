import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockSyncServer } from '../helpers/mock-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_BEFORE_PATH = path.join(__dirname, '../fixtures/sample_before.jpg');

test.describe('Tier 4: Stadium Operational Scenarios', () => {
  let mockServer: MockSyncServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockSyncServer();
    await mockServer.setup(page);
    await page.goto('/');
  });

  test('T4.1: Scenario 1 — Morning Pitch Inspection (Relvado Principal)', async ({ page }) => {
    // Step 1: Open app online at admin office. Pre-cached locations are loaded.
    await expect(page.locator('#header-container')).toBeVisible();
    await expect(page.locator('#connectivity-badge')).toHaveClass(/online/);

    // Step 2: User enters pitch level tunnel (loses network -> Offline mode active).
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);
    await expect(page.locator('#connectivity-badge')).toHaveClass(/offline/);

    // Step 3: Inspect pitch, open report form, select "Relvado Principal"
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Inspeção matinal. Relvado molhado. Necessita de corte e remarcação de linhas.');
    await page.fill('#input-time-spent', '45');
    await page.setInputFiles('#input-photo-before', SAMPLE_BEFORE_PATH);
    await page.fill('#input-materials', 'Cortador relva, Tinta de marcação branca');
    await page.click('#btn-save-report');

    // First report saved offline with yellow "Pendente" badge
    await expect(page.locator('#modal-report-form')).not.toBeVisible();
    const firstCard = page.locator('.report-card').first();
    await expect(firstCard.locator('.badge-pending')).toBeVisible();

    // Step 4: Walk to South Access Tunnel, add new custom location "Túnel de Acesso Sul"
    await page.click('#btn-new-report');
    await page.click('#btn-add-location-trigger');
    await page.fill('#input-location-name', 'Túnel de Acesso Sul');
    await page.fill('#input-location-desc', 'Acesso interior relvado bancada sul');
    await page.click('#btn-save-location');

    // Step 5: Create second report for "Túnel de Acesso Sul"
    await page.fill('#input-description', 'Lâmpada fundida no corredor');
    await page.fill('#input-time-spent', '15');
    await page.click('#btn-save-report');

    // Both reports displayed in feed with "Pendente" badge
    await expect(page.locator('.report-card')).toHaveCount(2);
    await expect(page.locator('.badge-pending')).toHaveCount(2);

    // Step 6: Return to admin office (network reconnects)
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Step 7: Auto-sync executes, badges update to "Sincronizado"
    await expect(page.locator('.badge-synced')).toHaveCount(2, { timeout: 5000 });

    // Verify mock server received both reports and the new custom location
    const remoteLocations = mockServer.getRemoteLocations();
    const remoteReports = mockServer.getRemoteReports();

    expect(remoteLocations.some(l => l.name === 'Túnel de Acesso Sul')).toBe(true);
    expect(remoteReports).toHaveLength(2);
    expect(remoteReports.some(r => r.description.includes('Inspeção matinal'))).toBe(true);
    expect(remoteReports.some(r => r.description.includes('Lâmpada fundida'))).toBe(true);
  });

  test('T4.2: Scenario 2 — Emergency Evening Floodlight Repair (Torres de Iluminação)', async ({ page }) => {
    // Step 1: Night match prep emergency. Staff opens app offline.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // Step 2: Add dynamic custom location for "Torre 3 - Bancada Nascente"
    await page.click('#btn-new-report');
    await page.click('#btn-add-location-trigger');
    await page.fill('#input-location-name', 'Torre 3 - Bancada Nascente');
    await page.fill('#input-location-desc', 'Torre de iluminação 2,000W');
    await page.click('#btn-save-location');

    // Step 3: Create urgent report
    await page.fill('#input-description', 'Substituição de projetor queimado no topo da torre');
    await page.fill('#input-time-spent', '120');
    await page.setInputFiles('#input-photo-before', SAMPLE_BEFORE_PATH);
    await page.fill('#input-materials', 'Projetor 2000W, Fusível de alta voltagem');
    await page.click('#btn-save-report');

    // Step 4: Saved cleanly to IndexedDB queue with yellow "Pendente" badge
    const card = page.locator('.report-card').first();
    await expect(card.locator('.badge-pending')).toBeVisible();

    // Step 5: Update report description offline after completing repair
    await card.click();
    await page.click('#btn-edit-report');
    await page.fill('#input-description', 'Projetor 2000W instalado com sucesso, fiação verificada');
    await page.click('#btn-save-report');

    // Step 6: Network connection is restored -> Auto-sync pushes updated report to cloud
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Auto-sync badge update to "Sincronizado"
    await expect(page.locator('.badge-synced')).toBeVisible({ timeout: 5000 });

    // Step 7: Open detail modal, verify synced status and photo gallery rendering
    await card.click();
    const detailModal = page.locator('#modal-report-detail');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('Projetor 2000W instalado com sucesso, fiação verificada');
    await expect(detailModal.locator('.photo-gallery img')).toHaveCount(1);

    const remoteReports = mockServer.getRemoteReports();
    expect(remoteReports[0].description).toBe('Projetor 2000W instalado com sucesso, fiação verificada');
  });
});
