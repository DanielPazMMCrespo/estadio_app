import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPin,
  isValidPin,
  setupProfile,
  hasProfile,
  profileName,
  currentAuthor,
  verifyPin,
  clearProfile,
  getUsers,
  getUserById,
  getCurrentUser,
  isCurrentUserAdmin,
  canCurrentUserEditDoors,
  canCurrentUserEditStock,
  createUser,
  updateUser,
  deleteUser,
  verifyUserPin,
  setCurrentUser
} from '../../src/services/profile.js';

describe('Profile and User Management Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates 4-digit numeric PINs correctly', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
    expect(isValidPin('9999')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('abcd')).toBe(false);
    expect(isValidPin('')).toBe(false);
    expect(isValidPin(null)).toBe(false);
  });

  it('hashes pins reproducibly', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    const c = await hashPin('4321');
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
    expect(a.algo).toBeDefined();
  });

  it('sets up the initial profile as Administrator', async () => {
    expect(hasProfile()).toBe(false);
    const admin = await setupProfile('Manuel Silva', '1234');

    expect(hasProfile()).toBe(true);
    expect(admin.name).toBe('Manuel Silva');
    expect(admin.role).toBe('admin');
    expect(admin.canEditDoors).toBe(true);
    expect(admin.canEditStock).toBe(true);
    expect(profileName()).toBe('Manuel Silva');
    expect(currentAuthor()).toBe('Manuel Silva');
    expect(isCurrentUserAdmin()).toBe(true);
    expect(canCurrentUserEditDoors()).toBe(true);
    expect(canCurrentUserEditStock()).toBe(true);

    const ok = await verifyPin('1234');
    const fail = await verifyPin('9999');
    expect(ok).toBe(true);
    expect(fail).toBe(false);
  });

  it('creates technician with restricted permissions by default ("apenas adicionar")', async () => {
    await setupProfile('Chefe Carlos', '1234');

    const tech = await createUser({
      name: 'Joao Tecnico',
      pin: '5678',
      role: 'tecnico'
    });

    expect(tech.role).toBe('tecnico');
    expect(tech.canEditDoors).toBe(false);
    expect(tech.canEditStock).toBe(false);

    // Switch to technician
    setCurrentUser(tech.id);
    expect(profileName()).toBe('Joao Tecnico');
    expect(isCurrentUserAdmin()).toBe(false);
    expect(canCurrentUserEditDoors()).toBe(false);
    expect(canCurrentUserEditStock()).toBe(false);

    // Verify technician PIN
    const ok = await verifyPin('5678');
    const fail = await verifyPin('1234');
    expect(ok).toBe(true);
    expect(fail).toBe(false);
  });

  it('allows granting specific permissions to a technician', async () => {
    await setupProfile('Chefe Carlos', '1234');

    const techWithDoors = await createUser({
      name: 'Tecnico Especialista',
      pin: '9012',
      role: 'tecnico',
      canEditDoors: true,
      canEditStock: false
    });

    setCurrentUser(techWithDoors.id);
    expect(isCurrentUserAdmin()).toBe(false);
    expect(canCurrentUserEditDoors()).toBe(true);
    expect(canCurrentUserEditStock()).toBe(false);
  });

  it('prevents deleting the only administrator', async () => {
    const admin = await setupProfile('Admin Unico', '1111');
    const tech = await createUser({ name: 'Tecnico 1', pin: '2222', role: 'tecnico' });

    setCurrentUser(tech.id);
    expect(() => deleteUser(admin.id)).toThrow(/único administrador/i);
  });

  it('prevents deleting the active user', async () => {
    const admin = await setupProfile('Admin 1', '1111');
    expect(() => deleteUser(admin.id)).toThrow(/sessão iniciada/i);
  });

  it('updates technician permissions and details', async () => {
    await setupProfile('Admin', '1111');
    const tech = await createUser({ name: 'Rui', pin: '2222', role: 'tecnico' });

    const updated = await updateUser(tech.id, {
      name: 'Rui Santos',
      canEditStock: true
    });

    expect(updated.name).toBe('Rui Santos');
    expect(updated.canEditStock).toBe(true);
    expect(updated.canEditDoors).toBe(false);

    setCurrentUser(tech.id);
    expect(canCurrentUserEditStock()).toBe(true);
    expect(canCurrentUserEditDoors()).toBe(false);
  });

  it('migrates legacy user_profile seamlessly into an Administrator account', async () => {
    const { hash, algo } = await hashPin('4444');
    localStorage.setItem('user_profile', JSON.stringify({
      name: 'Antonio Legado',
      pinHash: hash,
      algo,
      createdAt: '2026-01-01T00:00:00.000Z'
    }));

    expect(hasProfile()).toBe(true);
    const users = getUsers();
    expect(users.length).toBe(1);
    expect(users[0].name).toBe('Antonio Legado');
    expect(users[0].role).toBe('admin');
    expect(users[0].canEditDoors).toBe(true);
    expect(users[0].canEditStock).toBe(true);

    const ok = await verifyPin('4444');
    expect(ok).toBe(true);
  });
});
