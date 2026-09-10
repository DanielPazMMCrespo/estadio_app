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

/**
 * Linha de histórico de intervenções para as fichas de equipamento e porta.
 * Só texto escapado e o id em data-attribute: quem chama liga o clique.
 *
 * @param {Array} rows - intervenções (as mais recentes primeiro)
 * @param {number} [max=5]
 * @returns {string}
 */
export function reportListHtml(rows, max = 5) {
  const list = Array.isArray(rows) ? rows.slice(0, max) : [];
  if (!list.length) return '<p class="d-sheet-sub">Sem intervenções registadas.</p>';
  return `<ul class="d-rep-list">` + list.map((r) => {
    let when = '';
    try {
      const d = new Date(r.date || r.createdAt || Date.now());
      when = d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
    } catch { when = ''; }
    const desc = String(r.description || '').trim();
    const snippet = desc.length > 80 ? desc.slice(0, 80) + '…' : desc;
    return `<li><button type="button" class="d-rep-row" data-report-id="${attr(r.id)}">` +
      `<span class="d-rep-when">${esc(when)}</span>` +
      `<span class="d-rep-what">${esc(snippet || 'Intervenção')}</span>` +
      `</button></li>`;
  }).join('') + `</ul>`;
}
