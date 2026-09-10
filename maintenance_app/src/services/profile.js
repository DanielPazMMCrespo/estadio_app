/**
 * Perfil local do técnico (login sem servidor).
 *
 * Porquê local: o técnico trabalha sem rede nas caves — um login que exija
 * servidor deixava-o à porta da app exatamente quando mais precisa dela.
 * Aqui o "login" identifica o AUTOR (cada avaria fica assinada) e evita uso
 * acidental por outra pessoa que pegue no telemóvel. Não é cofre: um PIN de
 * 4 dígitos tem 10 mil combinações e os dados da app não são sensíveis.
 *
 * Guarda-se em localStorage['user_profile']: { name, pinHash, algo, createdAt }.
 * O PIN nunca é guardado em claro — só o hash SHA-256 (ou djb2 com sal em
 * ambientes sem crypto.subtle, ex.: alguns webviews de teste).
 */

const PROFILE_KEY = 'user_profile';
const OPERATOR_KEY = 'operator_name';
const PIN_SALT = 'estadio-leiria-chaveiro';

function readStore() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.name !== 'string' || typeof p.pinHash !== 'string') return null;
    return p;
  } catch {
    return null;
  }
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

/** Cria o perfil (primeira abertura ou troca de utilizador). */
export async function setupProfile(name, pin) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Escreva o nome do técnico.');
  if (!isValidPin(pin)) throw new Error('O PIN são 4 dígitos.');
  const { hash, algo } = await hashPin(pin);
  const profile = { name: cleanName, pinHash: hash, algo, createdAt: new Date().toISOString() };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // O nome do operador já existia para o PDF: mantém-se sincronizado.
    localStorage.setItem(OPERATOR_KEY, cleanName);
  } catch (err) {
    throw new Error('Não foi possível guardar o perfil neste aparelho.');
  }
  return profile;
}

/** Há perfil criado? */
export function hasProfile() {
  return readStore() !== null;
}

/** Nome do perfil atual (para saudações e assinaturas). */
export function profileName() {
  try {
    const p = readStore();
    if (p && p.name) return p.name;
    return localStorage.getItem(OPERATOR_KEY) || '';
  } catch {
    return '';
  }
}

/** Nome a carimbar como autor de novos registos. */
export function currentAuthor() {
  return profileName();
}

/** Confere o PIN sem nunca o guardar nem registar. */
export async function verifyPin(pin) {
  const p = readStore();
  if (!p) return false;
  if (!isValidPin(pin)) return false;
  const { hash } = await hashPin(pin);
  const a = String(hash);
  const b = String(p.pinHash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Apaga o perfil (troca de utilizador). Os dados ficam; só sai a sessão. */
export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch { /* sem armazenamento não há nada para limpar */ }
}
