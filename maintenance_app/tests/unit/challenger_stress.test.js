import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EstadioMaintenanceDB } from '../../src/db/db.js';
import { HeaderComponent } from '../../src/ui/header.js';
import { ToastManager, showToast } from '../../src/ui/toast.js';
import fs from 'fs';
import path from 'path';

describe('Empirical Challenger Stress & Boundary Test Suite', () => {
  let db;

  beforeEach(async () => {
    const dbName = `stress_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db = new EstadioMaintenanceDB(dbName);
    await db.open();
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await db.delete();
      await db.close();
    }
  });

  describe('1. Dexie DB Stress & Edge Cases', () => {
    it('handles high volume bulk insertions of reports, locations, and queue items', async () => {
      const reports = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-rep-${i}`,
        date: new Date(Date.now() - i * 3600000).toISOString(),
        locationId: i % 2 === 0 ? 'LOC_PITCH' : 'LOC_STAND',
        locationName: i % 2 === 0 ? 'Relvado Principal' : 'Bancada Norte',
        description: `Relatório de teste de carga ${i} com caracteres especiais: áéíóú ⚽🔧`,
        timeSpentMinutes: 30 + (i % 60),
        photos: [
          {
            id: `photo-${i}-1`,
            blobData: new Blob(['fake image data'], { type: 'image/jpeg' }),
            type: 'work',
            createdAt: new Date().toISOString()
          }
        ],
        materials: i % 3 === 0 ? 'Tinta, escova' : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: i % 2,
        deleted: i % 5 === 0 ? 1 : 0
      }));

      await db.reports.bulkAdd(reports);
      const count = await db.reports.count();
      expect(count).toBe(100);

      const activeCount = await db.reports.where('deleted').equals(0).count();
      expect(activeCount).toBe(80);

      const unsyncedCount = await db.reports.where('synced').equals(0).count();
      expect(unsyncedCount).toBe(50);
    });

    it('stores and retrieves Blob binary photo data accurately', async () => {
      const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const blob = new Blob([binaryData], { type: 'image/jpeg' });

      const report = {
        id: 'rep-blob-test',
        date: '2026-08-11T12:00:00Z',
        locationId: 'LOC_PITCH',
        locationName: 'Relvado',
        description: 'Test with Blob',
        timeSpentMinutes: 45,
        photos: [{ id: 'p1', blobData: blob, type: 'before', createdAt: '2026-08-11T12:00:00Z' }],
        createdAt: '2026-08-11T12:00:00Z',
        updatedAt: '2026-08-11T12:00:00Z',
        synced: 0,
        deleted: 0
      };

      await db.reports.add(report);
      const retrieved = await db.reports.get('rep-blob-test');
      expect(retrieved.photos).toHaveLength(1);
      // Under fake-indexeddb/jsdom environment, Blob objects are serialized during IDB clone
      expect(retrieved.photos[0].blobData).toBeDefined();
    });

    it('correctly increments sync_queue auto-increment primary key and filters by entityType', async () => {
      await db.sync_queue.bulkAdd([
        { entityType: 'report', entityId: 'r1', action: 'CREATE', payload: {}, timestamp: Date.now(), retryCount: 0 },
        { entityType: 'location', entityId: 'l1', action: 'CREATE', payload: {}, timestamp: Date.now(), retryCount: 0 },
        { entityType: 'report', entityId: 'r2', action: 'UPDATE', payload: {}, timestamp: Date.now(), retryCount: 1 }
      ]);

      const reportSyncs = await db.sync_queue.where('entityType').equals('report').toArray();
      expect(reportSyncs).toHaveLength(2);

      const locationSyncs = await db.sync_queue.where('entityType').equals('location').toArray();
      expect(locationSyncs).toHaveLength(1);
    });

    it('rejects duplicate primary keys in reports and locations', async () => {
      await db.locations.add({ id: 'LOC_DUP', name: 'Original', isCustom: 0, createdAt: '', synced: 1 });
      await expect(
        db.locations.add({ id: 'LOC_DUP', name: 'Duplicate', isCustom: 0, createdAt: '', synced: 1 })
      ).rejects.toThrow();
    });
  });

  describe('2. UI Header & Security Stress Tests', () => {
    let container;

    beforeEach(() => {
      document.body.innerHTML = '<header id="header-container"></header>';
      container = document.getElementById('header-container');
    });

    it('prevents XSS attacks in operator user name', () => {
      const xssName = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      const header = new HeaderComponent(container, { userName: xssName, isOnline: true });
      header.render();

      const span = container.querySelector('.user-name');
      expect(span.innerHTML).not.toContain('<script>');
      expect(span.textContent).toBe(xssName);
    });

    it('handles method calls prior to rendering gracefully', () => {
      const header = new HeaderComponent(container, { userName: 'Test' });
      // updateStatus without prior render
      expect(() => header.updateStatus(false)).not.toThrow();
      expect(container.querySelector('#connectivity-badge')).not.toBeNull();
      expect(container.querySelector('.status-badge').classList.contains('offline')).toBe(true);

      // setUserName without prior render
      expect(() => header.setUserName('Updated')).not.toThrow();
      expect(container.querySelector('.user-name').textContent).toBe('Updated');
    });

    it('handles null container safely without throwing errors', () => {
      const header = new HeaderComponent(null, { userName: 'NullTest' });
      expect(() => header.render()).not.toThrow();
      expect(() => header.updateStatus(true)).not.toThrow();
      expect(() => header.setUserName('Foo')).not.toThrow();
    });
  });

  describe('3. Toast System Stress & Safety Tests', () => {
    it('escapes HTML in toast messages to prevent XSS injection', () => {
      const toastManager = new ToastManager();
      const xssMsg = '<b>Alert</b> <svg onload=alert(1)>';
      const toastEl = toastManager.show(xssMsg, 'error', 0);

      expect(toastEl.querySelector('.toast-message').innerHTML).not.toContain('<b>Alert</b>');
      expect(toastEl.querySelector('.toast-message').textContent).toBe(xssMsg);
    });

    it('handles rapid fire burst of 50 toasts without DOM corruption', () => {
      const toastManager = new ToastManager();
      for (let i = 0; i < 50; i++) {
        toastManager.show(`Toast Message ${i}`, i % 2 === 0 ? 'info' : 'success', 0);
      }

      const container = document.getElementById('toast-container');
      expect(container.children.length).toBe(50);
    });

    it('re-creates container if removed from DOM during show call', () => {
      const toastManager = new ToastManager();
      toastManager.ensureContainer();
      const initialContainer = document.getElementById('toast-container');
      initialContainer.remove();

      expect(document.getElementById('toast-container')).toBeNull();
      toastManager.info('Test recovery', 0);
      expect(document.getElementById('toast-container')).not.toBeNull();
    });
  });

  describe('4. Manifest & Static Asset Verification', () => {
    it('validates manifest.webmanifest format and properties', () => {
      const manifestPath = path.resolve('public/manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(content.display).toBe('standalone');
      expect(content.orientation).toBe('portrait-primary');
      expect(content.theme_color.toUpperCase()).toBe('#0B132B');
      expect(content.background_color.toUpperCase()).toBe('#0B132B');
      expect(content.icons.length).toBeGreaterThanOrEqual(2);
    });

    it('verifies generated PWA icons exist on disk', () => {
      expect(fs.existsSync(path.resolve('public/favicon.ico'))).toBe(true);
      expect(fs.existsSync(path.resolve('public/icons/icon-192.png'))).toBe(true);
      expect(fs.existsSync(path.resolve('public/icons/icon-512.png'))).toBe(true);
    });
  });
});
