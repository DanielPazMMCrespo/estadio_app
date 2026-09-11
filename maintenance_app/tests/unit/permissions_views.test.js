import { describe, it, expect, beforeEach } from 'vitest';
import { setupProfile, createUser, setCurrentUser } from '../../src/services/profile.js';
import { ToolsViewComponent } from '../../src/ui/toolsView.js';
import { DoorsViewComponent } from '../../src/ui/doorsView.js';
import { EquipmentViewComponent } from '../../src/ui/equipmentView.js';
import { toolsRepo } from '../../src/db/toolsRepo.js';
import { doorsRepo } from '../../src/db/doorsRepo.js';
import { equipmentRepo } from '../../src/db/equipmentRepo.js';
import 'fake-indexeddb/auto';

describe('Permissions & Role-Based UI Guards (Tools, Doors, Equipment)', () => {
  let container;

  beforeEach(async () => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    await toolsRepo.seedDefaults();
    await doorsRepo.seedDefaults();
    await equipmentRepo.seedDefaults();
  });

  it('renders Tools view with active buttons for Administrator', async () => {
    await setupProfile('Admin Chefe', '1234');

    const toolsView = new ToolsViewComponent(container);
    await toolsView.render();

    expect(container.querySelector('.d-perm-banner')).toBeNull();
    const takeBtns = container.querySelectorAll('.d-tool-btn.d-tool-take');
    expect(takeBtns.length).toBeGreaterThan(0);
    takeBtns.forEach(btn => {
      expect(btn.classList.contains('is-locked')).toBe(false);
      expect(btn.textContent).toContain('Tirar 1');
    });
  });

  it('renders Tools view with locked "- Tirar 1" and technician notice for Técnico', async () => {
    await setupProfile('Admin Chefe', '1234');
    const tech = await createUser({ name: 'Tecnico Silva', pin: '0000', role: 'tecnico' });
    setCurrentUser(tech.id);

    const toolsView = new ToolsViewComponent(container);
    await toolsView.render();

    const banner = container.querySelector('.d-perm-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Modo Técnico');

    const takeBtns = container.querySelectorAll('.d-tool-btn.d-tool-take');
    expect(takeBtns.length).toBeGreaterThan(0);
    takeBtns.forEach(btn => {
      expect(btn.classList.contains('is-locked')).toBe(true);
      expect(btn.textContent).toContain('🔒');
    });

    // Technicians can still see "+ Nova ferramenta" and "+ Repor 1" ("apenas adicionar")
    expect(container.querySelector('#btn-new-tool')).not.toBeNull();
    const restockBtns = container.querySelectorAll('.d-tool-btn.d-tool-restock');
    expect(restockBtns.length).toBeGreaterThan(0);
  });

  it('blocks negative stock movements for restricted technicians', async () => {
    await setupProfile('Admin Chefe', '1234');
    const tech = await createUser({ name: 'Tecnico Silva', pin: '0000', role: 'tecnico' });
    setCurrentUser(tech.id);

    const tools = await toolsRepo.getAll();
    const tool = tools[0];
    const initialQty = tool.qty;

    const toolsView = new ToolsViewComponent(container);
    await toolsView.render();

    // Try to take stock
    await toolsView.applyMove(tool.id, -1, null);

    const afterTool = await toolsRepo.getById(tool.id);
    expect(afterTool.qty).toBe(initialQty); // Unchanged!
  });

  it('locks status change buttons on Doors for restricted technicians while keeping intervention button active', async () => {
    await setupProfile('Admin Chefe', '1234');
    const tech = await createUser({ name: 'Tecnico Silva', pin: '0000', role: 'tecnico' });
    setCurrentUser(tech.id);

    const doorsView = new DoorsViewComponent(container);
    await doorsView.render();

    const doors = await doorsRepo.getAll();
    doorsView.openDetailSheet(doors[0]);

    const sheet = doorsView.sheetEl;
    expect(sheet).not.toBeNull();

    // Status buttons disabled with notice
    const notice = sheet.querySelector('.d-perm-notice');
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('Apenas administradores podem alterar o estado da porta');

    const statusBtns = sheet.querySelectorAll('.d-status-btn');
    statusBtns.forEach(b => {
      expect(b.hasAttribute('disabled')).toBe(true);
    });

    // "Registar intervenção" remains active for technician!
    const faultBtn = sheet.querySelector('#d-sheet-fault');
    expect(faultBtn).not.toBeNull();
    expect(faultBtn.hasAttribute('disabled')).toBe(false);

    doorsView.closeSheet();
  });

  it('locks status change buttons on Equipment for restricted technicians while keeping intervention button active', async () => {
    await setupProfile('Admin Chefe', '1234');
    const tech = await createUser({ name: 'Tecnico Silva', pin: '0000', role: 'tecnico' });
    setCurrentUser(tech.id);

    const equipView = new EquipmentViewComponent(container);
    await equipView.render();

    const items = await equipmentRepo.getAll();
    equipView.openDetailSheet(items[0]);

    const sheet = equipView.sheetEl;
    expect(sheet).not.toBeNull();

    const notice = sheet.querySelector('.d-perm-notice');
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('Apenas administradores podem alterar o estado do equipamento');

    const statusBtns = sheet.querySelectorAll('.d-status-btn');
    statusBtns.forEach(b => {
      expect(b.hasAttribute('disabled')).toBe(true);
    });

    const faultBtn = sheet.querySelector('#d-sheet-fault');
    expect(faultBtn).not.toBeNull();
    expect(faultBtn.hasAttribute('disabled')).toBe(false);

    equipView.closeSheet();
  });
});
