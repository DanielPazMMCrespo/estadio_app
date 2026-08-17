/**
 * Escape de HTML — uma só implementação para toda a app.
 *
 * Porque existe: havia 16 cópias desta função espalhadas pelos componentes, em
 * três variantes diferentes. Uma delas (a do history.js) não escapava a
 * apóstrofe, o que abria um risco de injeção em atributos delimitados por
 * apóstrofe. Uma implementação, uma correção, um teste.
 *
 * A variante antiga do main.js criava um elemento DOM a cada chamada, o que é
 * lento em listas de centenas de linhas. Esta usa substituição direta.
 */

const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapa texto para poder entrar em HTML com segurança.
 * Aceita qualquer tipo: números viram texto, nulos viram string vazia.
 *
 * @param {*} value
 * @returns {string}
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch] || ch);
}

/**
 * Escapa um valor para dentro de um atributo HTML.
 * Hoje é igual ao esc() — ambos cobrem aspas e apóstrofes. Existe como nome
 * separado para que a intenção fique legível no local de uso.
 *
 * @param {*} value
 * @returns {string}
 */
export function attr(value) {
  return esc(value);
}
