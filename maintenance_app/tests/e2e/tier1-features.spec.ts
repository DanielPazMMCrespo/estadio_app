import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockSyncServer } from '../helpers/mock-server';
import {
  unlockApp,
  goToHistory,
  openQuickCapture,
  pickQuickLocation,
  createQuickReport,
  saveQuickCapture,
  openFullReportForm,
  setOffline,
  setOnline,
  waitForSyncDone,
  acceptNextDialog
} from '../helpers/e2e';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_BEFORE_PATH = path.join(__dirname, '../fixtures/sample_before.jpg');

/**
 * Tier 1 — Funcionalidade de base na UI ATUAL.
 *
 * Nota de design: o cabeçalho já não mostra saudação ("Olá, João") — saiu de
 * propósito para dar espaço ao trabalho (ver src/ui/header.js). O fluxo de
 * registo é a captura rápida a partir do botão verde; o feed vive no
 * separador "Intervenções".
 */
test.describe('Tier 1: Core Feature Verification', () => {
  let mockServer: MockSyncServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockSyncServer();
    await mockServer.setup(page);
    await page.goto('/');
    await unlockApp(page);
  });

  test('T1.1: App carrega — header, badge e grelha da Home', async ({ page }) => {
    await expect(page.locator('#header-container')).toBeVisible();
    await expect(page.locator('#connectivity-badge')).toBeVisible();

    // A saudação saiu de propósito do cabeçalho (design). Nada para encontrar.
    await expect(page.locator('.greeting')).toHaveCount(0);

    // Grelha de quadrados vivos da Home (botão verde + 4 quadrados + "Mais").
    await expect(page.locator('#dashboard-feed .ht-tile').first()).toBeVisible();
    const tileCount = await page.locator('#dashboard-feed .ht-tile').count();
    expect(tileCount).toBeGreaterThanOrEqual(5);
    await expect(page.locator('#btn-hero-report')).toBeVisible();
  });

  test('T1.2: Badge de ligação — acaba "Sincronizado" após o sync inicial', async ({ page }) => {
    const badge = page.locator('#connectivity-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/status-badge/);
    await expect(badge.locator('.status-text')).toHaveText('Sincronizado', { timeout: 15000 });
  });

  test('T1.3: Botão verde abre a captura rápida completa', async ({ page }) => {
    await openQuickCapture(page);
    await expect(page.locator('#qc-description')).toBeVisible();
    await expect(page.locator('#qc-loc-search')).toBeVisible();
    await expect(page.locator('#qc-priority-group')).toBeVisible();
    await expect(page.locator('#btn-save-capture')).toBeVisible();
    await expect(page.locator('#btn-expand-capture')).toBeVisible();
  });

  test('T1.4: Dropdown de localizações tem os locais pré-definidos', async ({ page }) => {
    await openQuickCapture(page);
    const input = page.locator('#qc-loc-search');
    await input.click();
    await expect(page.locator('#qc-loc-dropdown .loc-option').first()).toBeVisible();
    await expect(page.locator('#qc-loc-dropdown .loc-option')).toHaveCount(33);

    await input.fill('Relvado');
    await page.locator('#qc-loc-dropdown .loc-option').filter({ hasText: 'Relvado Principal' }).first().click();
    await expect(input).toHaveValue('Relvado Principal');
  });

  test('T1.4b: Botão chevron abre e fecha o dropdown de localizações', async ({ page }) => {
    await openQuickCapture(page);
    const toggleBtn = page.locator('#qc-loc-toggle');
    const dropdown = page.locator('#qc-loc-dropdown');

    // Abre ao clicar no chevron
    await toggleBtn.click();
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.loc-option')).toHaveCount(33);

    // Fecha ao clicar no chevron de novo
    await toggleBtn.click();
    await expect(dropdown).toBeHidden();
  });

  test('T1.5: Criar relatório na captura rápida -> cartão Pendente/Local', async ({ page }) => {
    await createQuickReport(page, 'Reparação da relva da grande área norte', {
      locationQuery: 'Relvado Principal',
      priority: 'critical'
    });

    await goToHistory(page);
    const card = page.locator('#history-list .issue-card').first();
    await expect(card).toContainText('Reparação da relva da grande área norte');
    await expect(card).toContainText('Relvado Principal');
    await expect(card.locator('.chip-priority.crit')).toHaveText('CRÍTICO');
    await expect(card.locator('.chip-status.pending')).toHaveText('Pendente');
    await expect(card.locator('.sync-indicator.pending')).toHaveText('Local');
  });

  test('T1.6: Relatórios por ordem — o mais recente fica no topo', async ({ page }) => {
    await createQuickReport(page, 'Relatório Antigo - Limpeza de balneários', {
      locationQuery: 'Balneário Principal'
    });

    // Segundo relatório com data +5 min para tornar a ordem determinística.
    await openQuickCapture(page);
    await page.locator('#qc-description').fill('Relatório Novo - Baliza reparada');
    await pickQuickLocation(page, 'Relvado');
    await page.locator('#btn-expand-capture').click();
    await expect(page.locator('#modal-report-form')).toBeVisible();
    const d = new Date(Date.now() + 5 * 60000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    await page.locator('#input-date').fill(d.toISOString().slice(0, 16));
    await page.locator('#btn-save-report').click();
    await expect(page.locator('#modal-report-form')).not.toBeVisible();

    await goToHistory(page);
    const firstCard = page.locator('#history-list .issue-card').first();
    await expect(firstCard).toContainText('Relatório Novo - Baliza reparada');
  });

  test('T1.7: Formulário completo (expandir) — tempo e materiais', async ({ page }) => {
    await openFullReportForm(page);

    await page.locator('#input-time-spent').fill('45');
    await expect(page.locator('.mat-checkbox')).not.toHaveCount(0);
    await page.locator('.mat-checkbox[value="Tinta de Marcação"]').check();
    await page.locator('#btn-save-report').click();
    await expect(page.locator('#modal-report-form')).not.toBeVisible();

    await goToHistory(page);
    const card = page.locator('#history-list .issue-card').first();
    await expect(card.locator('.media-tag.time')).toHaveText('45 min');

    // Materiais só são visíveis na ficha (cartão não os mostra).
    await card.click();
    const detail = page.locator('.bottom-sheet-content.detail-sheet');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.detail-stat-pill').first()).toHaveText('45 minutos');
    await expect(detail).toContainText('Tinta de Marcação');
  });

  test('T1.8: Ficha abre, mostra a descrição e fecha', async ({ page }) => {
    await createQuickReport(page, 'Inspeção geral do sistema de rega', {
      locationQuery: 'Sistema de Rega'
    });

    await goToHistory(page);
    await page.locator('#history-list .issue-card .issue-description').first().click();
    const detail = page.locator('.bottom-sheet-content.detail-sheet');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.detail-text-box').first()).toContainText('Inspeção geral do sistema de rega');

    await page.locator('#btn-close-detail').click();
    await expect(detail).not.toBeVisible();
  });

  test('T1.9: Editar — o formulário abre preenchido e o cartão atualiza', async ({ page }) => {
    await createQuickReport(page, 'Descrição Inicial');

    await goToHistory(page);
    let card = page.locator('#history-list .issue-card').first();
    await card.click();
    const detail = page.locator('.bottom-sheet-content.detail-sheet');
    await expect(detail).toBeVisible();

    await page.locator('#btn-edit-report').click();
    const form = page.locator('#modal-report-form');
    await expect(form).toBeVisible();
    await expect(page.locator('#input-description')).toHaveValue('Descrição Inicial');

    await page.locator('#input-description').fill('Descrição Editada com Sucesso');
    await page.locator('#input-time-spent').fill('45');
    await page.locator('#btn-save-report').click();
    await expect(form).not.toBeVisible();

    card = page.locator('#history-list .issue-card').first();
    await expect(card).toContainText('Descrição Editada com Sucesso');
    await expect(card.locator('.media-tag.time')).toHaveText('45 min');
  });

  test('T1.10: Eliminar com confirmação nativa — o cartão desaparece', async ({ page }) => {
    await createQuickReport(page, 'Relatório para Apagar');

    await goToHistory(page);
    await page.locator('#history-list .issue-card .issue-description').first().click();
    await expect(page.locator('.bottom-sheet-content.detail-sheet')).toBeVisible();

    acceptNextDialog(page);
    await page.locator('#btn-delete-report').click();

    await expect(page.locator('.bottom-sheet-content.detail-sheet')).not.toBeVisible();
    await expect(page.locator('#history-list .issue-card')).toHaveCount(0);
  });

  test('T1.11: Foto na captura rápida — miniatura e tag no cartão', async ({ page }) => {
    await openQuickCapture(page);
    await page.locator('#qc-photo-input').setInputFiles(SAMPLE_BEFORE_PATH);
    await expect(page.locator('#qc-photo-list img')).toHaveCount(1, { timeout: 15000 });
    await page.locator('#qc-description').fill('Avaria com fotografia');
    await saveQuickCapture(page);

    await goToHistory(page);
    const card = page.locator('#history-list .issue-card').first();
    await expect(card.locator('.media-tag.photo')).toHaveText('1 Foto');
  });

  test('T1.12: Pesquisa instantânea no feed', async ({ page }) => {
    await createQuickReport(page, 'Trabalho no Relvado', { locationQuery: 'Relvado' });
    await createQuickReport(page, 'Trabalho nos Balneários', { locationQuery: 'Balneário Principal' });

    await goToHistory(page);
    await expect(page.locator('#history-list .issue-card')).toHaveCount(2);

    await page.locator('#input-search-reports').fill('Balneários');
    await expect(page.locator('#history-list .issue-card')).toHaveCount(1, { timeout: 3000 });
    await expect(page.locator('#history-list .issue-card').first()).toContainText('Trabalho nos Balneários');

    await page.locator('#input-search-reports').fill('');
    await expect(page.locator('#history-list .issue-card')).toHaveCount(2, { timeout: 3000 });
  });

  test('T1.13: Offline -> online — o relatório sincroniza (badge + cartão)', async ({ page }) => {
    await setOffline(page);
    await createQuickReport(page, 'Relatório para sincronizar automaticamente', {
      locationQuery: 'Relvado Principal'
    });

    await goToHistory(page);
    await expect(page.locator('#history-list .issue-card .sync-indicator.pending')).toHaveText('Local');

    await setOnline(page);
    await waitForSyncDone(page);
    await expect(mockServer.getRemoteReports()).toHaveLength(1);

    await expect(page.locator('#history-list .issue-card .sync-indicator.synced')).toBeVisible({ timeout: 10000 });
  });
});