import { Page, expect } from '@playwright/test';

/**
 * Helpers partilhados pelos specs E2E, ajustados à UI atual da app.
 *
 * Flows essenciais:
 *  - unlockApp: ecrã de entrada (setup: nome + PIN 2x; unlock: PIN 1x).
 *  - openQuickCapture / createQuickReport: captura rápida (a via normal).
 *  - pickQuickLocation: dropdown de local da captura rápida (listas .loc-option).
 *  - openFullReportForm / createFullReport: formulário completo (via "Mais campos").
 *  - setOffline / setOnline: emular rede + disparar os eventos window.
 *  - waitForSyncDone: esperar o badge chegar a "Sincronizado".
 *  - acceptNextDialog: aceitar o próximo confirm() nativo.
 */

export const TEST_USER = 'João Teste';
export const TEST_PIN = '1111';

/** Tecla do teclado de luvas por dígito. */
const KEY_BY_DIGIT: Record<string, string> = {
  '1': '.lock-key[data-key="1"]',
  '2': '.lock-key[data-key="2"]',
  '3': '.lock-key[data-key="3"]',
  '4': '.lock-key[data-key="4"]',
  '5': '.lock-key[data-key="5"]',
  '6': '.lock-key[data-key="6"]',
  '7': '.lock-key[data-key="7"]',
  '8': '.lock-key[data-key="8"]',
  '9': '.lock-key[data-key="9"]',
  '0': '.lock-key[data-key="0"]'
};

async function pressPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.locator(KEY_BY_DIGIT[digit] || '.lock-key[data-key="1"]').click();
  }
}

/**
 * Completa o ecrã de entrada. Se aparecer #lock-name estamos em setup
 * (1ª vez, perfil novo): nome + PIN duas vezes. Senão é unlock: PIN uma vez.
 * Resolve quando o overlay sai do DOM.
 */
export async function unlockApp(page: Page, name = TEST_USER, pin = TEST_PIN): Promise<void> {
  const overlay = page.locator('.lock-overlay');
  await overlay.waitFor({ state: 'attached', timeout: 15000 });

  const nameInput = page.locator('#lock-name');
  const isSetup = (await nameInput.count()) > 0;

  if (isSetup) {
    await nameInput.fill(name);
  }

  await pressPin(page, pin);

  if (isSetup) {
    await expect(page.locator('#lock-pin-label')).toHaveText(/Repita/, { timeout: 5000 });
    await pressPin(page, pin);
  }

  await expect(overlay).toHaveCount(0, { timeout: 15000 });
}

/** Abre o separador Intervenções (a lista de relatórios/ocorrências). */
export async function goToHistory(page: Page): Promise<void> {
  await page.locator('.nav-tab[data-tab="history"]').click();
  await expect(page.locator('#history-list')).toBeVisible({ timeout: 15000 });
}

/** Abre a captura rápida a partir do botão verde da Home. */
export async function openQuickCapture(page: Page): Promise<void> {
  await page.locator('#btn-hero-report').click();
  await expect(page.locator('#modal-quick-capture')).toBeVisible({ timeout: 15000 });
}

/**
 * Escolhe um local no dropdown de pesquisa da captura rápida.
 * O campo abre ao clicar ou focar e permite filtrar por query.
 */
export async function pickQuickLocation(page: Page, query: string): Promise<void> {
  const input = page.locator('#qc-loc-search');
  await input.fill('');
  await input.fill(query);
  await page.locator('#qc-loc-dropdown .loc-option').filter({ hasText: query }).first().click();
  await expect(input).not.toHaveValue('');
  await expect(page.locator('#qc-loc-dropdown')).toBeHidden();
}

/**
 * Guarda a captura rápida já preenchida e espera a folha fechar.
 * Devolve ao fim do save — o cartão é visível no separador Intervenções.
 */
export async function saveQuickCapture(page: Page): Promise<void> {
  await page.locator('#btn-save-capture').click();
  await expect(page.locator('#modal-quick-capture')).not.toBeVisible({ timeout: 15000 });
}

/**
 * Funde os passos de uma captura rápida: abrir, descrever, escolher local
 * (opcional), prioridade (opcional) e guardar.
 */
export async function createQuickReport(
  page: Page,
  description: string,
  opts: { locationQuery?: string; priority?: 'low' | 'medium' | 'critical' } = {}
): Promise<void> {
  await openQuickCapture(page);
  await page.locator('#qc-description').fill(description);
  if (opts.locationQuery) {
    await pickQuickLocation(page, opts.locationQuery);
  }
  if (opts.priority) {
    await page.locator(`#qc-priority-group .priority-btn[data-priority="${opts.priority}"]`).click();
  }
  await saveQuickCapture(page);
}

/** Abre o formulário completo a partir da captura rápida ("Mais campos..."). */
export async function openFullReportForm(page: Page): Promise<void> {
  await openQuickCapture(page);
  await page.locator('#btn-expand-capture').click();
  await expect(page.locator('#modal-report-form')).toBeVisible({ timeout: 15000 });
}

/**
 * Abre o seletor de local do formulário completo e escolhe uma localização
 * existente por pesquisa (lista .location-card).
 */
export async function pickFullFormLocation(page: Page, query: string): Promise<void> {
  await page.locator('#search-location-input').click();
  await expect(page.locator('#modal-location')).toBeVisible({ timeout: 15000 });
  const search = page.locator('#input-search-location');
  await search.fill(query);
  await page.locator('#location-cards-list .location-card').filter({ hasText: query }).first().click();
  await expect(page.locator('#modal-location')).not.toBeVisible({ timeout: 15000 });
}

/**
 * Cria uma localização personalizada diretamente do formulário completo
 * (botão "+ Local") e deixa-a selecionada no input #search-location-input.
 */
export async function createCustomLocationFromForm(
  page: Page,
  name: string,
  description = ''
): Promise<void> {
  await page.locator('#btn-new-location-inline').click();
  await expect(page.locator('#modal-location')).toBeVisible({ timeout: 15000 });
  await page.locator('#input-location-name').fill(name);
  if (description) {
    await page.locator('#input-location-desc').fill(description);
  }
  await page.locator('#btn-save-location').click();
  await expect(page.locator('#modal-location')).not.toBeVisible({ timeout: 15000 });
  await expect(page.locator('#search-location-input')).toHaveValue(name);
}

/** Emula a perda de rede e faz o badge mudar para Offline. */
export async function setOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#connectivity-badge')).toHaveClass(/offline/, { timeout: 5000 });
}

/** Repõe a rede e dispara o handler de "online" (que dispara o sync). */
export async function setOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

/** Espera o badge do cabeçalho chegar a "Sincronizado". */
export async function waitForSyncDone(page: Page, timeout = 20000): Promise<void> {
  await expect(page.locator('#connectivity-badge .status-text')).toHaveText('Sincronizado', { timeout });
}

/** Aceita o próximo `confirm()` nativo (sem isto o Playwright auto-dismissa). */
export function acceptNextDialog(page: Page): void {
  page.once('dialog', (dialog) => dialog.accept());
}

/** Espera um toast de erro com o texto indicado. */
export async function expectErrorToast(page: Page, text: string): Promise<void> {
  const toast = page.locator('#toast-container .toast-error').filter({ hasText: text }).first();
  await expect(toast).toBeVisible({ timeout: 10000 });
}