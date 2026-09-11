/**
 * Perfil local e gestão de utilizadores (login sem servidor, 100% offline-first).
 *
 * Porquê local: o técnico trabalha sem rede nas caves — um login que exija
 * servidor deixava-o à porta da app exatamente quando mais precisa dela.
 * Aqui o login identifica o AUTOR (cada avaria fica assinada) e evita uso
 * acidental por outra pessoa que pegue no telemóvel.
 *
 * Suporta múltiplos utilizadores por aparelho:
 * - Administrador: controlo total, gestão de utilizadores, alterar portas, equipamento e stock.
 * - Técnico: permissões configuráveis (por defeito "apenas adicionar" — registar avarias,
 *   adicionar novas ferramentas e repor stock, sem permissão para tirar stock ou alterar portas).
 *
 * Guarda-se em localStorage['app_users'] e localStorage['user_profile'].
 */

const PROFILE_KEY = 'user_profile';
const OPERATOR_KEY = 'operator_name';
const USERS_KEY = 'app_users';
const ACTIVE_USER_ID_KEY = 'active_user_id';
const PIN_SALT = 'estadio-leiria-chaveiro';

function readUsersList() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }

    // Migração suave de perfil legado único
    const legacyRaw = localStorage.getItem(PROFILE_KEY);
    if (legacyRaw) {
      const leg = JSON.parse(legacyRaw);
      if (leg && typeof leg.name === 'string' && typeof leg.pinHash === 'string') {
        const migratedAdmin = {
          id: 'usr_admin',
          name: leg.name,
          role: 'admin',
          pinHash: leg.pinHash,
          algo: leg.algo || 'sha256',
          canEditDoors: true,
          canEditStock: true,
          createdAt: leg.createdAt || new Date().toISOString()
        };
        saveUsersList([migratedAdmin]);
        localStorage.setItem(ACTIVE_USER_ID_KEY, migratedAdmin.id);
        return [migratedAdmin];
      }
    }
    return [];
  } catch {
    return [];
  }
}

function saveUsersList(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('[Profile] Erro ao guardar utilizadores:', err);
  }
}

function syncActiveProfile(user) {
  if (!user) {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    return;
  }
  try {
    localStorage.setItem(ACTIVE_USER_ID_KEY, user.id);
    const profile = {
      id: user.id,
      name: user.name,
      role: user.role || 'tecnico',
      canEditDoors: user.role === 'admin' || user.canEditDoors === true,
      canEditStock: user.role === 'admin' || user.canEditStock === true,
      pinHash: user.pinHash,
      algo: user.algo,
      createdAt: user.createdAt
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(OPERATOR_KEY, user.name);
  } catch (err) {
    console.error('[Profile] Erro ao sincronizar perfil ativo:', err);
  }
}

function readStore() {
  const u = getCurrentUser();
  if (!u) return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** SHA-256 hex quando há crypto.subtle; senão djb2 com sal (só anti-acidental). */
export async function hashPin(pin) {
  const input = `${PIN_SALT}:${pin}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return { hash: Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''), algo: 'sha256' };
    }
  } catch { /* cai para o fallback */ }
  let h1 = 0x811c9dc5;
  const s = `djb2:${input}`;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return { hash: `djb2-${h1.toString(16)}`, algo: 'djb2' };
}

/** Um PIN válido são exatamente 4 dígitos. Nada de letras, nada de vazio. */
export function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4}$/.test(pin);
}

/** Obter lista de todos os utilizadores (com ou sem pinHash). */
export function getUsers(includeSecret = false) {
  const users = readUsersList();
  if (includeSecret) return users;
  return users.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role || 'tecnico',
    canEditDoors: u.role === 'admin' || u.canEditDoors === true,
    canEditStock: u.role === 'admin' || u.canEditStock === true,
    createdAt: u.createdAt
  }));
}

/** Obter utilizador por ID. */
export function getUserById(id) {
  const users = readUsersList();
  return users.find(u => u.id === id) || null;
}

/** Utilizador com sessão ativa neste momento. */
export function getCurrentUser() {
  const users = readUsersList();
  if (users.length === 0) return null;

  const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
  let user = users.find(u => u.id === activeId);

  if (!user && users.length > 0) {
    user = users[0];
    syncActiveProfile(user);
  }

  return user ? {
    id: user.id,
    name: user.name,
    role: user.role || 'tecnico',
    canEditDoors: user.role === 'admin' || user.canEditDoors === true,
    canEditStock: user.role === 'admin' || user.canEditStock === true,
    createdAt: user.createdAt
  } : null;
}

/** O utilizador ativo é administrador? */
export function isCurrentUserAdmin() {
  const u = getCurrentUser();
  return !!(u && u.role === 'admin');
}

/** O utilizador ativo pode alterar o estado das portas? */
export function canCurrentUserEditDoors() {
  const u = getCurrentUser();
  if (!u) return false;
  return u.role === 'admin' || u.canEditDoors === true;
}

/** O utilizador ativo pode alterar ou retirar stock de ferramentas? */
export function canCurrentUserEditStock() {
  const u = getCurrentUser();
  if (!u) return false;
  return u.role === 'admin' || u.canEditStock === true;
}

/** Cria um novo utilizador. */
export async function createUser({ name, pin, role = 'tecnico', canEditDoors = false, canEditStock = false }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Escreva o nome do utilizador.');
  if (!isValidPin(pin)) throw new Error('O PIN são exatamente 4 dígitos.');

  const users = readUsersList();
  if (users.some(u => u.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error('Já existe um utilizador com esse nome.');
  }

  const { hash, algo } = await hashPin(pin);
  const isAdmin = role === 'admin';
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    role: isAdmin ? 'admin' : 'tecnico',
    pinHash: hash,
    algo,
    canEditDoors: isAdmin ? true : Boolean(canEditDoors),
    canEditStock: isAdmin ? true : Boolean(canEditStock),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsersList(users);

  // Se for o primeiro utilizador ou não houver utilizador ativo, ativa este
  if (users.length === 1 || !localStorage.getItem(ACTIVE_USER_ID_KEY)) {
    syncActiveProfile(newUser);
  }

  return {
    id: newUser.id,
    name: newUser.name,
    role: newUser.role,
    canEditDoors: newUser.canEditDoors,
    canEditStock: newUser.canEditStock,
    createdAt: newUser.createdAt
  };
}

/** Atualiza um utilizador existente. */
export async function updateUser(id, updates = {}) {
  const users = readUsersList();
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('Utilizador não encontrado.');

  const user = users[idx];

  if (updates.name !== undefined) {
    const cleanName = String(updates.name).trim();
    if (!cleanName) throw new Error('O nome não pode ficar vazio.');
    if (users.some(u => u.id !== id && u.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('Já existe outro utilizador com esse nome.');
    }
    user.name = cleanName;
  }

  if (updates.pin) {
    if (!isValidPin(updates.pin)) throw new Error('O PIN são 4 dígitos.');
    const { hash, algo } = await hashPin(updates.pin);
    user.pinHash = hash;
    user.algo = algo;
  }

  if (updates.role !== undefined) {
    if (user.role === 'admin' && updates.role !== 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        throw new Error('Tem de haver pelo menos um administrador no sistema.');
      }
    }
    user.role = updates.role === 'admin' ? 'admin' : 'tecnico';
  }

  const isAdmin = user.role === 'admin';
  user.canEditDoors = isAdmin ? true : Boolean(updates.canEditDoors);
  user.canEditStock = isAdmin ? true : Boolean(updates.canEditStock);

  users[idx] = user;
  saveUsersList(users);

  const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
  if (activeId === id) {
    syncActiveProfile(user);
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    canEditDoors: user.canEditDoors,
    canEditStock: user.canEditStock,
    createdAt: user.createdAt
  };
}

/** Elimina um utilizador. */
export function deleteUser(id) {
  const users = readUsersList();
  const user = users.find(u => u.id === id);
  if (!user) return false;

  const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
  if (activeId === id) {
    throw new Error('Não pode eliminar o utilizador com sessão iniciada. Mude de utilizador primeiro.');
  }

  if (user.role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('Não é possível eliminar o único administrador.');
    }
  }

  const nextUsers = users.filter(u => u.id !== id);
  saveUsersList(nextUsers);
  return true;
}

/** Confere o PIN de um utilizador específico em tempo constante. */
export async function verifyUserPin(userId, pin) {
  const user = getUserById(userId);
  if (!user || !isValidPin(pin)) return false;

  const { hash } = await hashPin(pin);
  const a = String(hash);
  const b = String(user.pinHash);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Troca o utilizador ativo sem apagar dados. */
export function setCurrentUser(userId) {
  const user = getUserById(userId);
  if (!user) throw new Error('Utilizador não encontrado.');
  syncActiveProfile(user);
  return getCurrentUser();
}

/** Cria o perfil inicial ou Administrador (primeira abertura). */
export async function setupProfile(name, pin, role = 'admin') {
  const users = readUsersList();
  const assignedRole = users.length === 0 ? 'admin' : role;
  const user = await createUser({
    name,
    pin,
    role: assignedRole,
    canEditDoors: assignedRole === 'admin',
    canEditStock: assignedRole === 'admin'
  });
  setCurrentUser(user.id);
  return user;
}

/** Há pelo menos um perfil criado? */
export function hasProfile() {
  const users = readUsersList();
  return users.length > 0;
}

/** Nome do perfil atual (para saudações e assinaturas). */
export function profileName() {
  const u = getCurrentUser();
  if (u && u.name) return u.name;
  return localStorage.getItem(OPERATOR_KEY) || '';
}

/** Nome a carimbar como autor de novos registos. */
export function currentAuthor() {
  return profileName();
}

/** Confere o PIN do utilizador ativo. */
export async function verifyPin(pin) {
  const activeUser = getCurrentUser();
  if (!activeUser) return false;
  return verifyUserPin(activeUser.id, pin);
}

/** Sai da sessão do utilizador atual. Os dados e os utilizadores ficam gravados. */
export function clearProfile() {
  try {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch { /* sem armazenamento */ }
}
