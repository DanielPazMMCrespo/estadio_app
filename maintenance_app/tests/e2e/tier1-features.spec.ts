import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockSyncServer } from '../helpers/mock-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_BEFORE_PATH = path.join(__dirname, '../fixtures/sample_before.jpg');

test.describe('Tier 1: Core Feature Verification', () => {
  let mockServer: MockSyncServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockSyncServer();
    await mockServer.setup(page);
    await page.goto('/');
  });

  test('T1.1: App load & header greeting ("Olá, João")', async ({ page }) => {
    await expect(page.locator('#header-container')).toBeVisible();
    const greeting = page.locator('.greeting');
    await expect(greeting).toBeVisible();
    await expect(greeting).toContainText('Olá, João');
  });

  test('T1.2: Connectivity badge online status (green dot, "Online")', async ({ page }) => {
    const badge = page.locator('#connectivity-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/online/);
    const statusText = badge.locator('.status-text');
    await expect(statusText).toHaveText('Online');
  });

  test('T1.3: Pre-cached locations loading in dropdown', async ({ page }) => {
    await page.click('#btn-new-report');
    const select = page.locator('#select-location');
    await expect(select).toBeVisible();
    
    // Should contain pre-cached options
    const options = select.locator('option');
    await expect(options).toHaveCount(4); // 1 default placeholder + 3 seed locations
    await expect(select.locator('option[value="LOC_PITCH"]')).toHaveText('Relvado Principal');
    await expect(select.locator('option[value="LOC_CHANGING"]')).toHaveText('Balneários');
    await expect(select.locator('option[value="LOC_NORTH_STAND"]')).toHaveText('Bancada Norte');
  });

  test('T1.4: Report creator modal opening via #btn-new-report', async ({ page }) => {
    const modal = page.locator('#modal-report-form');
    await expect(modal).not.toBeVisible();
    await page.click('#btn-new-report');
    await expect(modal).toBeVisible();
  });

  test('T1.5: Create report with valid fields', async ({ page }) => {
    await page.click('#btn-new-report');
    
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-date', '2026-08-11T14:30');
    await page.fill('#input-description', 'Reparação de relva da grande área norte');
    await page.fill('#input-time-spent', '45');
    
    await page.click('#btn-save-report');
    
    // Modal should close and toast/feed update
    await expect(page.locator('#modal-report-form')).not.toBeVisible();
    const feed = page.locator('#dashboard-feed');
    await expect(feed.locator('.report-card')).toHaveCount(1);
    await expect(feed).toContainText('Reparação de relva da grande área norte');
  });

  test('T1.6: Verify report appears at top of feed', async ({ page }) => {
    // Create first report
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_CHANGING');
    await page.fill('#input-description', 'Relatório Antigo - Limpeza de balneários');
    await page.fill('#input-time-spent', '30');
    await page.click('#btn-save-report');
    await expect(page.locator('#modal-report-form')).not.toBeVisible();

    // Create second report
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório Novo - Marcador de linhas');
    await page.fill('#input-time-spent', '60');
    await page.click('#btn-save-report');
    await expect(page.locator('#modal-report-form')).not.toBeVisible();

    // Second report should be top card
    const firstCard = page.locator('.report-card').first();
    await expect(firstCard).toContainText('Relatório Novo - Marcador de linhas');
  });

  test('T1.7: Create report with optional materials & tools', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_NORTH_STAND');
    await page.fill('#input-description', 'Manutenção dos assentos da bancada norte');
    await page.fill('#input-time-spent', '90');
    await page.fill('#input-materials', 'Chave de fendas, Parafusos M8, Tinta azul');
    await page.click('#btn-save-report');

    await expect(page.locator('#modal-report-form')).not.toBeVisible();
    const card = page.locator('.report-card').first();
    await expect(card).toContainText('Tinta azul');
  });

  test('T1.8: Open report detail modal', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Inspeção geral do sistema de rega');
    await page.fill('#input-time-spent', '20');
    await page.click('#btn-save-report');

    await page.click('.report-card');
    const detailModal = page.locator('#modal-report-detail');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('Inspeção geral do sistema de rega');
  });

  test('T1.9: Edit report description & time spent', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Descrição Inicial');
    await page.fill('#input-time-spent', '30');
    await page.click('#btn-save-report');

    await page.click('.report-card');
    await page.click('#btn-edit-report');

    // Report form modal should open pre-populated
    const formModal = page.locator('#modal-report-form');
    await expect(formModal).toBeVisible();
    await expect(page.locator('#input-description')).toHaveValue('Descrição Inicial');

    await page.fill('#input-description', 'Descrição Editada com Sucesso');
    await page.fill('#input-time-spent', '45');
    await page.click('#btn-save-report');

    await expect(formModal).not.toBeVisible();
    await expect(page.locator('.report-card').first()).toContainText('Descrição Editada com Sucesso');
    await expect(page.locator('.report-card').first()).toContainText('45 min');
  });

  test('T1.10: Soft-delete report & confirmation dialog', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório para Apagar');
    await page.fill('#input-time-spent', '15');
    await page.click('#btn-save-report');

    await page.click('.report-card');
    await page.click('#btn-delete-report');

    const confirmModal = page.locator('#modal-confirm-delete');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText('Tem a certeza');
  });

  test('T1.11: Verify deleted report removed from feed', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório Eliminado Definitivamente');
    await page.fill('#input-time-spent', '15');
    await page.click('#btn-save-report');

    await page.click('.report-card');
    await page.click('#btn-delete-report');
    await page.click('#btn-confirm-delete');

    await expect(page.locator('#modal-confirm-delete')).not.toBeVisible();
    await expect(page.locator('#modal-report-detail')).not.toBeVisible();
    await expect(page.locator('.report-card')).toHaveCount(0);
  });

  test('T1.12: Attach photo (sample_before.jpg) & render thumbnail preview', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.setInputFiles('#input-photo-before', SAMPLE_BEFORE_PATH);

    const previewContainer = page.locator('#photo-preview-container');
    await expect(previewContainer).toBeVisible();
    await expect(previewContainer.locator('img')).toHaveCount(1);
  });

  test('T1.13: Attach multiple photos (before/after)', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.setInputFiles('#input-photo-before', SAMPLE_BEFORE_PATH);
    await page.setInputFiles('#input-photo-after', SAMPLE_BEFORE_PATH);

    const previewContainer = page.locator('#photo-preview-container');
    await expect(previewContainer.locator('img')).toHaveCount(2);
  });

  test('T1.14: Render full-size gallery in detail modal', async ({ page }) => {
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório com galeria de fotos');
    await page.fill('#input-time-spent', '40');
    await page.setInputFiles('#input-photo-before', SAMPLE_BEFORE_PATH);
    await page.click('#btn-save-report');

    await page.click('.report-card');
    const detailModal = page.locator('#modal-report-detail');
    await expect(detailModal).toBeVisible();
    const gallery = detailModal.locator('.photo-gallery');
    await expect(gallery).toBeVisible();
    await expect(gallery.locator('img')).toHaveCount(1);
  });

  test('T1.15: Switch network offline -> connectivity badge updates to yellow "Offline"', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    const badge = page.locator('#connectivity-badge');
    await expect(badge).toHaveClass(/offline/);
    await expect(badge.locator('.status-text')).toHaveText('Offline');
  });

  test('T1.16: Create report offline -> status badge "Pendente"', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório Criado em Modo Offline');
    await page.fill('#input-time-spent', '50');
    await page.click('#btn-save-report');

    const card = page.locator('.report-card').first();
    await expect(card).toBeVisible();
    const statusBadge = card.locator('.badge-pending');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('Pendente');
  });

  test('T1.17: Add dynamic custom location offline via "+ Nova Localização"', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    await page.click('#btn-new-report');
    await page.click('#btn-add-location-trigger');

    const locationModal = page.locator('#modal-location');
    await expect(locationModal).toBeVisible();

    await page.fill('#input-location-name', 'Camarote Presidencial');
    await page.fill('#input-location-desc', 'Zona VIP superior');
    await page.click('#btn-save-location');

    await expect(locationModal).not.toBeVisible();
    // Newly created location should be selected in #select-location
    const selectedOption = page.locator('#select-location option:checked');
    await expect(selectedOption).toHaveText('Camarote Presidencial');
  });

  test('T1.18: Select custom location in report form offline', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    await page.click('#btn-new-report');
    await page.click('#btn-add-location-trigger');
    await page.fill('#input-location-name', 'Zona de Imprensa');
    await page.click('#btn-save-location');

    await page.fill('#input-description', 'Manutenção das bancadas de imprensa');
    await page.fill('#input-time-spent', '30');
    await page.click('#btn-save-report');

    const card = page.locator('.report-card').first();
    await expect(card).toContainText('Zona de Imprensa');
  });

  test('T1.19: Switch network online -> auto-sync executes & card badge updates to "Sincronizado"', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(true);

    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Relatório para Sincronizar Automaticamente');
    await page.fill('#input-time-spent', '25');
    await page.click('#btn-save-report');

    await expect(page.locator('.badge-pending')).toBeVisible();

    // Switch back online
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Auto-sync should change badge to synced
    const syncedBadge = page.locator('.badge-synced');
    await expect(syncedBadge).toBeVisible({ timeout: 5000 });
    await expect(syncedBadge).toContainText('Sincronizado');
  });

  test('T1.20: Search/filter dashboard feed by location', async ({ page }) => {
    // Create Pitch report
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_PITCH');
    await page.fill('#input-description', 'Trabalho no Relvado');
    await page.fill('#input-time-spent', '30');
    await page.click('#btn-save-report');

    // Create Changing Room report
    await page.click('#btn-new-report');
    await page.selectOption('#select-location', 'LOC_CHANGING');
    await page.fill('#input-description', 'Trabalho nos Balneários');
    await page.fill('#input-time-spent', '40');
    await page.click('#btn-save-report');

    await expect(page.locator('.report-card')).toHaveCount(2);

    // Search for "Balneários"
    await page.fill('#input-search-reports', 'Balneários');
    await expect(page.locator('.report-card')).toHaveCount(1);
    await expect(page.locator('.report-card').first()).toContainText('Trabalho nos Balneários');

    // Clear search
    await page.fill('#input-search-reports', '');
    await expect(page.locator('.report-card')).toHaveCount(2);
  });
});
