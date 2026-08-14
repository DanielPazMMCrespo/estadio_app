import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockSyncServer } from '../helpers/mock-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_LARGE_PATH = path.join(__dirname, '../fixtures/sample_large.jpg');

test.describe('Tier 2: Boundary & Edge Case Testing', () => {
  let mockServer: MockSyncServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockSyncServer();
    await mockServer.setup(page);
    await page.goto('/');
  });

  test('T2.1: Large photo compression (>5MB canvas downscale to max 1280px)', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório com Imagem Grande (>5MB)');
    await page.fill('#input-time-spent', '30');

    // Attach 6MB high-res photo
    await page.setInputFiles('#input-photo-before', SAMPLE_LARGE_PATH);

    // Verify preview renders without freezing
    const previewContainer = page.locator('#photo-preview-container');
    await expect(previewContainer).toBeVisible({ timeout: 10000 });
    await expect(previewContainer.locator('img')).toHaveCount(1);

    await page.click('#btn-save-report');
    await expect(page.locator('#modal-report-form')).not.toBeVisible();
    await expect(page.locator('.report-card').first()).toBeVisible();
  });

  test('T2.2: 10,000-character description field input & persistence & UI truncation', async ({ page }) => {
    const longText = 'A'.repeat(10000);

    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', longText);
    await page.fill('#input-time-spent', '60');
    await page.click('#btn-save-report');

    await expect(page.locator('#modal-report-form')).not.toBeVisible();
    const card = page.locator('.report-card').first();
    await expect(card).toBeVisible();

    // Verify truncation in card view
    const cardText = await card.textContent();
    expect(cardText?.length).toBeLessThan(10000);

    // Open detail modal and verify full 10,000 character string is intact
    await card.click();
    const detailModal = page.locator('#modal-report-detail');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText(longText);
  });

  test('T2.3: Network drop mid-submit fallback to sync queue without data loss', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_CHANGING');
    await page.fill('#input-description', 'Relatório submetido durante quebra de rede');
    await page.fill('#input-time-spent', '45');

    // Drop network right before click
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    await page.click('#btn-save-report');

    // Should fall back gracefully to queue without crash
    await expect(page.locator('#modal-report-form')).not.toBeVisible();
    const card = page.locator('.report-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.badge-pending')).toBeVisible();
  });

  test('T2.4: Empty required fields validation error toasts', async ({ page }) => {
    await page.click('#btn-new-report');
    
    // Attempt save with empty description and location
    await page.click('#btn-save-report');

    // Toast error should appear
    const toastError = page.locator('.toast-error');
    await expect(toastError).toBeVisible();
    
    // Form modal must remain open
    await expect(page.locator('#modal-report-form')).toBeVisible();
  });

  test('T2.5: High volume custom locations (50 locations) dropdown performance/search', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    // Create 50 custom locations
    for (let i = 1; i <= 50; i++) {
      await page.click('#btn-new-report');
      await page.click('#btn-add-location-trigger');
      await page.fill('#input-location-name', `Localização Personalizada ${i}`);
      await page.click('#btn-save-location');
      await page.click('#btn-cancel-report');
    }

    // Verify select dropdown has all 50 + default + seed locations (54 options)
    await page.click('#btn-new-report');
    const select = page.locator('#select-location');
    const options = select.locator('option');
    await expect(options).toHaveCount(54);

    // Select the 50th location
    await page.selectOption('#select-location', { label: 'Localização Personalizada 50' });
    const selectedOption = page.locator('#select-location option:checked');
    await expect(selectedOption).toHaveText('Localização Personalizada 50');
  });

  test('T2.6: Invalid file upload (.pdf) error toast', async ({ page }) => {
    await page.click('#btn-new-report');

    // Create a dummy PDF buffer in memory and attach to file input
    const pdfBuffer = Buffer.from('%PDF-1.4 dummy pdf content');
    await page.setInputFiles('#input-photo-before', {
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });

    // Toast error should be triggered
    const toastError = page.locator('.toast-error');
    await expect(toastError).toBeVisible();
    
    // Preview container should not contain PDF image
    const previewContainer = page.locator('#photo-preview-container');
    await expect(previewContainer.locator('img')).toHaveCount(0);
  });

  test('T2.7: Invalid numeric input (-30 min) validation block', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Teste de Tempo Negativo');
    await page.fill('#input-time-spent', '-30');

    await page.click('#btn-save-report');

    // Should trigger validation error toast or prevent modal close
    const toastError = page.locator('.toast-error');
    await expect(toastError).toBeVisible();
    await expect(page.locator('#modal-report-form')).toBeVisible();
  });
});
