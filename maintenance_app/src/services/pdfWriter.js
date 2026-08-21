/**
 * Escritor de PDF mínimo, sem dependências externas.
 *
 * Porque é que isto existe: a app é offline-first e a regra do repositório é
 * não instalar pacotes. Um PDF é um formato de texto com objectos numerados,
 * por isso dá para escrever os bytes à mão.
 *
 * O que suporta (e só isto, de propósito):
 *  - Fontes base-14 Helvetica e Helvetica-Bold com WinAnsiEncoding.
 *    Não é preciso embutir ficheiros de fonte e os acentos do português
 *    (ã, ç, é, ó, ú) cabem todos no WinAnsi (CP1252).
 *  - Imagens JPEG colocadas cruas com o filtro /DCTDecode. As fotos da app já
 *    saem em JPEG do photoCompressor, por isso não há conversão nenhuma.
 *  - Rectângulos preenchidos e linhas, para os selos de prioridade/estado e as
 *    molduras das secções.
 *
 * Sistema de coordenadas: a origem do PDF é o canto inferior esquerdo. Este
 * módulo guarda um cursor `y` nessas mesmas unidades (pontos, de baixo para
 * cima) e desce subtraindo. Quem chama nunca precisa de converter nada.
 */

const PT_PER_MM = 72 / 25.4;

/** A4 vertical, em pontos PostScript. */
export const A4_PORTRAIT = { width: 595.28, height: 841.89 };

/** Margem por omissão: 15 mm, igual à que a versão HTML usava no @page. */
export const DEFAULT_MARGIN = 15 * PT_PER_MM;

// Larguras dos glifos por código WinAnsi, em milésimos do tamanho da fonte.
// Valores oficiais dos ficheiros AFM da Adobe. Servem para partir linhas e
// para alinhar texto à direita sem medir nada no ecrã.
const WIDTHS_HELVETICA = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500
];

const WIDTHS_HELVETICA_BOLD = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556
];

// Caracteres Unicode acima de 255 que o WinAnsi tem em posições próprias.
// Sem este mapa, o "·" e o "—" que a app usa nos títulos saíam trocados.
const UNICODE_TO_WINANSI = {
  0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133,
  0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138,
  0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146,
  0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151,
  0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156,
  0x017E: 158, 0x0178: 159
};

/**
 * Converte texto JavaScript para os códigos WinAnsi que a fonte espera.
 * Um caracter que não exista no WinAnsi vira "?" — é melhor um "?" visível
 * que um PDF corrompido.
 */
function toWinAnsiCodes(text) {
  const str = text === null || text === undefined ? '' : String(text);
  const codes = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp > 0xFFFF) i++; // par surrogate: salta a segunda metade
    if (cp === 0x0A || cp === 0x0D || cp === 0x09) { codes.push(32); continue; }
    if (cp < 32) continue;
    if (cp <= 255) { codes.push(cp); continue; }
    const mapped = UNICODE_TO_WINANSI[cp];
    codes.push(mapped === undefined ? 63 : mapped);
  }
  return codes;
}

/** Bytes ASCII/Latin-1 da sintaxe do PDF. Não usa TextEncoder de propósito. */
function latin1Bytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
  return out;
}

/** Escapa uma cadeia literal do PDF: ( ) \ e tudo o que não seja ASCII visível. */
function pdfString(text) {
  const codes = toWinAnsiCodes(text);
  let out = '';
  for (const c of codes) {
    if (c === 0x28) out += '\\(';
    else if (c === 0x29) out += '\\)';
    else if (c === 0x5C) out += '\\\\';
    else if (c < 32 || c > 126) out += '\\' + c.toString(8).padStart(3, '0');
    else out += String.fromCharCode(c);
  }
  return '(' + out + ')';
}

/** Largura de um texto em pontos, para um tamanho e peso de fonte. */
export function measureText(text, size, bold = false) {
  const table = bold ? WIDTHS_HELVETICA_BOLD : WIDTHS_HELVETICA;
  const codes = toWinAnsiCodes(text);
  let total = 0;
  for (const c of codes) total += table[c] || 556;
  return (total * size) / 1000;
}

/**
 * Parte um texto em linhas que caibam em `maxWidth`.
 * Respeita os \n que o técnico escreveu na descrição.
 * Uma palavra maior que a linha é cortada a meio — melhor que sair da folha.
 */
export function wrapText(text, maxWidth, size, bold = false) {
  const source = text === null || text === undefined ? '' : String(text);
  const lines = [];

  for (const paragraph of source.split(/\r\n|\r|\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(''); continue; }

    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (measureText(candidate, size, bold) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);

      // Palavra sozinha maior que a linha: corta caracter a caracter.
      let rest = word;
      while (measureText(rest, size, bold) > maxWidth && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && measureText(rest.slice(0, cut), size, bold) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }

  return lines;
}

/** '#RRGGBB' → "0.062 0.075 0.169" para os operadores rg/RG do PDF. */
function colorOps(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b].map((v) => (Number.isFinite(v) ? v : 0).toFixed(3)).join(' ');
}

function num(value) {
  return (Math.round((Number(value) || 0) * 100) / 100).toString();
}

/**
 * Lê largura, altura e número de componentes de cor de um JPEG.
 * Percorre os marcadores até encontrar um SOF (Start Of Frame).
 * Devolve null se não for JPEG — nesse caso a foto é simplesmente ignorada.
 */
export function readJpegInfo(input) {
  let bytes = null;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input && input.buffer && typeof input.byteOffset === 'number') {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (Array.isArray(input)) {
    bytes = new Uint8Array(input);
  } else {
    return null;
  }

  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;

  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xFF) { i++; continue; }
    // Marcadores sem payload.
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { i += 2; continue; }

    const segLength = (bytes[i + 2] << 8) | bytes[i + 3];
    const isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSof) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      const components = bytes[i + 9];
      if (!width || !height) return null;
      return { width, height, components, bytes };
    }
    if (segLength < 2) return null;
    i += 2 + segLength;
  }
  return null;
}

/**
 * Documento PDF em construção.
 * Uso típico:
 *   const doc = new PdfDocument({ title: 'Ficha' });
 *   doc.paragraph(descricao);
 *   const bytes = doc.build();
 */
export class PdfDocument {
  constructor(options = {}) {
    this.pageWidth = options.width || A4_PORTRAIT.width;
    this.pageHeight = options.height || A4_PORTRAIT.height;
    this.margin = options.margin === undefined ? DEFAULT_MARGIN : options.margin;
    this.title = options.title || '';
    this.footerText = options.footerText || '';

    this.pages = [];
    this.images = [];      // { name, info }
    this.imageCache = new Map();
    this.page = null;
    this.y = 0;

    this.addPage();
  }

  get contentWidth() { return this.pageWidth - this.margin * 2; }
  get left() { return this.margin; }
  get right() { return this.pageWidth - this.margin; }
  get bottomLimit() { return this.margin + (this.footerText ? 18 : 0); }

  addPage() {
    this.page = { ops: [], images: new Set() };
    this.pages.push(this.page);
    this.y = this.pageHeight - this.margin;
    return this.page;
  }

  /** Garante espaço vertical. Se não houver, abre página nova. */
  ensureSpace(height) {
    if (this.y - height >= this.bottomLimit) return false;
    this.addPage();
    return true;
  }

  /** Desce o cursor sem desenhar nada. */
  space(height) {
    this.y -= height;
    return this;
  }

  // ---- desenho de baixo nível -------------------------------------------

  rect(x, y, w, h, options = {}) {
    const ops = this.page.ops;
    const fill = options.fill;
    const stroke = options.stroke;
    if (!fill && !stroke) return this;
    ops.push('q');
    if (fill) ops.push(colorOps(fill) + ' rg');
    if (stroke) {
      ops.push(colorOps(stroke) + ' RG');
      ops.push(num(options.lineWidth || 0.7) + ' w');
    }
    ops.push([num(x), num(y), num(w), num(h), 're'].join(' '));
    ops.push(fill && stroke ? 'B' : (fill ? 'f' : 'S'));
    ops.push('Q');
    return this;
  }

  line(x1, y1, x2, y2, options = {}) {
    const ops = this.page.ops;
    ops.push('q');
    ops.push(colorOps(options.color || '#000000') + ' RG');
    ops.push(num(options.lineWidth || 0.7) + ' w');
    ops.push([num(x1), num(y1), 'm'].join(' '));
    ops.push([num(x2), num(y2), 'l'].join(' '));
    ops.push('S');
    ops.push('Q');
    return this;
  }

  /** Escreve uma linha de texto numa posição exacta (y é a linha de base). */
  drawText(text, x, y, options = {}) {
    const size = options.size || 10;
    const bold = !!options.bold;
    const value = String(text === null || text === undefined ? '' : text);
    if (!value) return this;

    let posX = x;
    if (options.align === 'right') posX = x - measureText(value, size, bold);
    else if (options.align === 'center') posX = x - measureText(value, size, bold) / 2;

    const ops = this.page.ops;
    ops.push('BT');
    ops.push(colorOps(options.color || '#111827') + ' rg');
    ops.push('/' + (bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf');
    ops.push(num(posX) + ' ' + num(y) + ' Td');
    ops.push(pdfString(value) + ' Tj');
    ops.push('ET');
    return this;
  }

  // ---- fluxo de conteúdo -------------------------------------------------

  /**
   * Escreve texto com corte de linhas e mudança de página automática.
   */
  paragraph(text, options = {}) {
    const size = options.size || 10;
    const bold = !!options.bold;
    const lineHeight = options.lineHeight || size * 1.45;
    const x = options.x === undefined ? this.left : options.x;
    const maxWidth = options.maxWidth || (this.right - x);
    const lines = wrapText(text, maxWidth, size, bold);

    for (const lineText of lines) {
      this.ensureSpace(lineHeight);
      this.y -= lineHeight;
      if (lineText) this.drawText(lineText, x, this.y + lineHeight * 0.22, { size, bold, color: options.color });
    }
    if (options.spaceAfter) this.y -= options.spaceAfter;
    return this;
  }

  /** Rótulo pequeno em maiúsculas + valor por baixo. É o par usado na grelha de dados. */
  labelValue(label, value, options = {}) {
    const x = options.x === undefined ? this.left : options.x;
    const maxWidth = options.maxWidth || (this.right - x);
    this.ensureSpace(26);
    this.y -= 10;
    this.drawText(String(label || '').toUpperCase(), x, this.y, { size: 7.5, bold: true, color: '#6B7280' });
    this.y -= 13;
    const lines = wrapText(value, maxWidth, 10.5, true);
    this.drawText(lines[0] || '', x, this.y, { size: 10.5, bold: true, color: '#111827' });
    return this;
  }

  /** Selo colorido (prioridade, estado). Devolve a largura que ocupou. */
  badge(text, x, y, options = {}) {
    const size = options.size || 8;
    const padX = 6;
    const height = options.height || 14;
    const label = String(text === null || text === undefined ? '' : text).toUpperCase();
    const width = measureText(label, size, true) + padX * 2;
    this.rect(x, y, width, height, { fill: options.bg || '#F3F4F6', stroke: options.color || '#9CA3AF', lineWidth: 0.6 });
    this.drawText(label, x + padX, y + (height - size) / 2 + 1.2, {
      size, bold: true, color: options.color || '#374151'
    });
    return width;
  }

  /** Título de secção com linha por baixo. */
  sectionTitle(text, options = {}) {
    this.ensureSpace(26);
    this.y -= 16;
    this.drawText(String(text).toUpperCase(), this.left, this.y, {
      size: 9, bold: true, color: options.color || '#374151'
    });
    this.y -= 5;
    this.line(this.left, this.y, this.right, this.y, { color: '#E5E7EB', lineWidth: 0.7 });
    return this;
  }

  // ---- imagens -----------------------------------------------------------

  /**
   * Registra um JPEG e devolve o nome do XObject, ou null se não servir.
   * O mesmo JPEG usado duas vezes só entra uma vez no ficheiro.
   */
  registerJpeg(input) {
    const info = readJpegInfo(input);
    if (!info) return null;

    const mid = Math.floor(info.bytes.length / 2);
    const cacheKey = info.bytes.length + ':' + info.width + 'x' + info.height + ':' +
      info.bytes[mid] + ',' + info.bytes[info.bytes.length - 3];
    if (this.imageCache.has(cacheKey)) return this.imageCache.get(cacheKey);

    const name = 'Im' + (this.images.length + 1);
    this.images.push({ name, info });
    this.imageCache.set(cacheKey, name);
    return name;
  }

  /**
   * Desenha um JPEG numa caixa, mantendo a proporção e centrado na horizontal.
   * Devolve a altura realmente usada, ou 0 se a foto não pudesse entrar.
   */
  drawJpeg(input, x, y, boxWidth, boxHeight) {
    const name = this.registerJpeg(input);
    if (!name) return 0;
    const entry = this.images.find((im) => im.name === name);
    const iw = entry.info.width;
    const ih = entry.info.height;

    const scale = Math.min(boxWidth / iw, boxHeight / ih);
    const w = iw * scale;
    const h = ih * scale;
    const offsetX = x + (boxWidth - w) / 2;

    this.page.images.add(name);
    const ops = this.page.ops;
    ops.push('q');
    ops.push([num(w), '0 0', num(h), num(offsetX), num(y), 'cm'].join(' '));
    ops.push('/' + name + ' Do');
    ops.push('Q');
    return h;
  }

  /** Mede a altura que um JPEG vai ocupar numa caixa, sem o desenhar. */
  measureJpegHeight(input, boxWidth, boxHeight) {
    const info = readJpegInfo(input);
    if (!info) return 0;
    const scale = Math.min(boxWidth / info.width, boxHeight / info.height);
    return info.height * scale;
  }

  // ---- serialização ------------------------------------------------------

  /** Desenha o rodapé em todas as páginas, já com o total certo. */
  _stampFooters() {
    if (!this.footerText) return;
    const total = this.pages.length;
    const saved = this.page;
    this.pages.forEach((page, idx) => {
      this.page = page;
      this.drawText(this.footerText, this.left, this.margin - 4, { size: 7.5, color: '#9CA3AF' });
      this.drawText('Pagina ' + (idx + 1) + ' de ' + total, this.right, this.margin - 4, {
        size: 7.5, color: '#9CA3AF', align: 'right'
      });
    });
    this.page = saved;
  }

  /** Constrói o ficheiro final. Devolve Uint8Array. */
  build() {
    this._stampFooters();

    const objects = [];               // posição + 1 = número do objecto
    const push = (chunks) => { objects.push(chunks); return objects.length; };
    const placeholder = () => { objects.push(null); return objects.length; };
    const fill = (n, chunks) => { objects[n - 1] = chunks; };

    const catalogNum = placeholder();
    const pagesNum = placeholder();
    const fontRegularNum = push([latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')]);
    const fontBoldNum = push([latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')]);

    // XObjects das imagens.
    const imageNums = new Map();
    for (const image of this.images) {
      const info = image.info;
      const colorSpace = info.components === 1 ? '/DeviceGray' : (info.components === 4 ? '/DeviceCMYK' : '/DeviceRGB');
      const header = '<< /Type /XObject /Subtype /Image /Width ' + info.width +
        ' /Height ' + info.height + ' /ColorSpace ' + colorSpace +
        ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + info.bytes.length + ' >>\nstream\n';
      const objNum = push([latin1Bytes(header), info.bytes, latin1Bytes('\nendstream')]);
      imageNums.set(image.name, objNum);
    }

    // Páginas e respectivos conteúdos.
    const pageNums = [];
    for (const page of this.pages) {
      const pageNum = placeholder();
      const contentBytes = latin1Bytes(page.ops.join('\n'));
      const contentNum = push([
        latin1Bytes('<< /Length ' + contentBytes.length + ' >>\nstream\n'),
        contentBytes,
        latin1Bytes('\nendstream')
      ]);

      const xobjects = Array.from(page.images).map((n) => '/' + n + ' ' + imageNums.get(n) + ' 0 R').join(' ');
      const resources = '<< /Font << /F1 ' + fontRegularNum + ' 0 R /F2 ' + fontBoldNum + ' 0 R >>' +
        (xobjects ? ' /XObject << ' + xobjects + ' >>' : '') + ' >>';

      fill(pageNum, [latin1Bytes(
        '<< /Type /Page /Parent ' + pagesNum + ' 0 R /MediaBox [0 0 ' +
        num(this.pageWidth) + ' ' + num(this.pageHeight) + '] /Resources ' + resources +
        ' /Contents ' + contentNum + ' 0 R >>'
      )]);
      pageNums.push(pageNum);
    }

    fill(pagesNum, [latin1Bytes(
      '<< /Type /Pages /Kids [' + pageNums.map((n) => n + ' 0 R').join(' ') +
      '] /Count ' + pageNums.length + ' >>'
    )]);

    const infoNum = push([latin1Bytes(
      '<< /Title ' + pdfString(this.title || 'Documento') + ' /Producer ' +
      pdfString('Estadio Municipal de Leiria - App de Manutencao') + ' >>'
    )]);

    fill(catalogNum, [latin1Bytes('<< /Type /Catalog /Pages ' + pagesNum + ' 0 R >>')]);

    // Montagem final com a tabela xref.
    const parts = [];
    let offset = 0;
    const addRaw = (chunk) => { parts.push(chunk); offset += chunk.length; };

    addRaw(latin1Bytes('%PDF-1.4\n'));
    // Comentário binário: diz aos programas que o ficheiro tem bytes binários.
    addRaw(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    const offsets = [];
    objects.forEach((chunks, idx) => {
      offsets[idx] = offset;
      addRaw(latin1Bytes((idx + 1) + ' 0 obj\n'));
      const body = chunks || [latin1Bytes('null')];
      for (const chunk of body) addRaw(chunk);
      addRaw(latin1Bytes('\nendobj\n'));
    });

    const xrefOffset = offset;
    let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (const off of offsets) xref += String(off).padStart(10, '0') + ' 00000 n \n';
    addRaw(latin1Bytes(xref));
    addRaw(latin1Bytes(
      'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogNum +
      ' 0 R /Info ' + infoNum + ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n'
    ));

    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let cursor = 0;
    for (const part of parts) { out.set(part, cursor); cursor += part.length; }
    return out;
  }
}

/** Limpa um nome de ficheiro: tira acentos, barras e espaços. */
export function safeFileName(name) {
  const ACCENTS = {
    192: 'A', 193: 'A', 194: 'A', 195: 'A', 196: 'A', 197: 'A', 199: 'C',
    200: 'E', 201: 'E', 202: 'E', 203: 'E', 204: 'I', 205: 'I', 206: 'I',
    207: 'I', 209: 'N', 210: 'O', 211: 'O', 212: 'O', 213: 'O', 214: 'O',
    217: 'U', 218: 'U', 219: 'U', 220: 'U', 224: 'a', 225: 'a', 226: 'a',
    227: 'a', 228: 'a', 229: 'a', 231: 'c', 232: 'e', 233: 'e', 234: 'e',
    235: 'e', 236: 'i', 237: 'i', 238: 'i', 239: 'i', 241: 'n', 242: 'o',
    243: 'o', 244: 'o', 245: 'o', 246: 'o', 249: 'u', 250: 'u', 251: 'u',
    252: 'u'
  };
  const codes = toWinAnsiCodes(name);
  let out = '';
  for (const c of codes) {
    if (ACCENTS[c]) { out += ACCENTS[c]; continue; }
    const ch = String.fromCharCode(c);
    out += /[A-Za-z0-9._-]/.test(ch) ? ch : '-';
  }
  const cleaned = out.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'documento';
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // O iPad com iPadOS 13+ diz que é Macintosh, mas tem ecrã táctil.
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
}

/**
 * Entrega o PDF ao utilizador.
 *
 * Android e computador: link com `download`, o ficheiro cai nas Transferências.
 * iPhone/iPad: o Safari nem sempre respeita o `download`, sobretudo quando a
 * PWA corre em ecrã inteiro. Por isso tenta-se primeiro a folha de partilha
 * ("Guardar em Ficheiros"). Se o técnico cancelar, não se força mais nada.
 *
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function savePdf(bytes, fileName) {
  const base = safeFileName(fileName);
  const name = base.toLowerCase().endsWith('.pdf') ? base : base + '.pdf';
  const blob = new Blob([bytes], { type: 'application/pdf' });

  if (isIos() && typeof File === 'function' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // Qualquer outra falha cai para o download normal.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}
