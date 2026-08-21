import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PdfDocument,
  measureText,
  wrapText,
  readJpegInfo,
  safeFileName,
  savePdf,
  A4_PORTRAIT
} from '../../src/services/pdfWriter.js';

// JPEG válido de 1x1 em escala de cinzentos. Serve para provar que os bytes
// entram no PDF sem conversão e que o cabeçalho SOF é lido bem.
const JPEG_1X1_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDL/wAALCAABAAEBAREA/8QAFAAB' +
  'AQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAA' +
  'AAAAAAAAAP/aAAwDAQACEQMRAD8AKACgAoAKACgAoAKACgAoAKACgD//2Q==';

function jpegBytes() {
  const binary = atob(JPEG_1X1_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lê o PDF como texto latin-1, que é como a sintaxe do PDF está escrita. */
function asLatin1(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

describe('pdfWriter — estrutura do ficheiro', () => {
  it('escreve um PDF com cabeçalho e fim válidos', () => {
    const doc = new PdfDocument({ title: 'Teste' });
    doc.paragraph('Uma linha qualquer.');
    const bytes = doc.build();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(asLatin1(bytes.slice(0, 8))).toBe('%PDF-1.4');
    expect(asLatin1(bytes.slice(-6))).toBe('%%EOF\n');
  });

  it('a tabela xref aponta para o início de cada objecto', () => {
    const doc = new PdfDocument({ footerText: 'rodapé' });
    doc.paragraph('Texto de teste com acentuação: ação, lâmpada, ó.');
    doc.drawJpeg(jpegBytes(), doc.left, doc.y - 60, 100, 60);
    const text = asLatin1(doc.build());

    const startxref = parseInt(text.slice(text.lastIndexOf('startxref') + 9).trim(), 10);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');

    const lines = text.slice(startxref).split('\n');
    const declared = parseInt(lines[1].split(' ')[1], 10);
    expect(declared).toBeGreaterThan(4);

    // A entrada 0 é a livre; da 1 em diante cada offset tem de cair em "N 0 obj".
    for (let i = 1; i < declared; i++) {
      const offset = parseInt(lines[2 + i].slice(0, 10), 10);
      expect(text.slice(offset, offset + String(i).length + 6)).toBe(i + ' 0 obj');
    }
  });

  it('declara as duas fontes base-14 com WinAnsiEncoding', () => {
    const text = asLatin1(new PdfDocument().build());
    expect(text).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(text).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
  });

  it('escapa os acentos em octal em vez de meter bytes crus', () => {
    const doc = new PdfDocument();
    doc.drawText('ação', doc.left, 400, { size: 10 });
    const text = asLatin1(doc.build());
    // ç = 231 = \347 em octal, ã = 227 = \343
    expect(text).toContain('a\\347\\343o');
  });

  it('converte o travessão e o ponto médio para as posições WinAnsi', () => {
    const doc = new PdfDocument();
    doc.drawText('a—b·c', doc.left, 400);
    const text = asLatin1(doc.build());
    expect(text).toContain('a\\227b\\267c'); // 151 = \227, 183 = \267
  });

  it('escapa parênteses e barras invertidas no texto', () => {
    const doc = new PdfDocument();
    doc.drawText('a(b)c\\d', doc.left, 400);
    const text = asLatin1(doc.build());
    expect(text).toContain('a\\(b\\)c\\\\d');
  });

  it('abre página nova quando o texto não cabe', () => {
    const doc = new PdfDocument();
    for (let i = 0; i < 120; i++) doc.paragraph('Linha numero ' + i, { size: 10 });
    const bytes = doc.build();
    expect(doc.pages.length).toBeGreaterThan(1);
    expect(asLatin1(bytes)).toContain('/Count ' + doc.pages.length);
  });

  it('usa A4 vertical por omissão', () => {
    const text = asLatin1(new PdfDocument().build());
    expect(text).toContain('/MediaBox [0 0 ' + A4_PORTRAIT.width + ' ' + A4_PORTRAIT.height + ']');
  });

  it('numera o rodapé com o total certo de páginas', () => {
    const doc = new PdfDocument({ footerText: 'Ficha EML-TESTE' });
    for (let i = 0; i < 120; i++) doc.paragraph('Linha ' + i);
    const text = asLatin1(doc.build());
    expect(doc.pages.length).toBeGreaterThan(1);
    expect(text).toContain('de ' + doc.pages.length);
  });
});

describe('pdfWriter — imagens JPEG', () => {
  it('lê largura, altura e componentes de um JPEG', () => {
    const info = readJpegInfo(jpegBytes());
    expect(info).toMatchObject({ width: 1, height: 1, components: 1 });
  });

  it('devolve null para dados que não são JPEG', () => {
    expect(readJpegInfo(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(readJpegInfo(null)).toBeNull();
    expect(readJpegInfo('nao e imagem')).toBeNull();
  });

  it('aceita ArrayBuffer e array normal', () => {
    const bytes = jpegBytes();
    expect(readJpegInfo(bytes.buffer)).not.toBeNull();
    expect(readJpegInfo(Array.from(bytes))).not.toBeNull();
  });

  it('embute o JPEG com filtro DCTDecode e o tamanho certo', () => {
    const bytes = jpegBytes();
    const doc = new PdfDocument();
    const used = doc.drawJpeg(bytes, 50, 50, 200, 200);
    const text = asLatin1(doc.build());

    expect(used).toBeGreaterThan(0);
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('/Length ' + bytes.length);
    expect(text).toContain('/ColorSpace /DeviceGray');
    expect(text).toContain('/Im1 Do');
  });

  it('a mesma foto usada duas vezes só entra uma vez no ficheiro', () => {
    const bytes = jpegBytes();
    const doc = new PdfDocument();
    doc.drawJpeg(bytes, 50, 500, 100, 100);
    doc.drawJpeg(bytes, 200, 500, 100, 100);
    expect(doc.images.length).toBe(1);
  });

  it('ignora em silêncio uma foto ilegível', () => {
    const doc = new PdfDocument();
    expect(doc.drawJpeg(new Uint8Array([9, 9, 9]), 50, 50, 100, 100)).toBe(0);
    expect(doc.images.length).toBe(0);
  });

  it('mede a altura de uma foto sem a desenhar', () => {
    const doc = new PdfDocument();
    expect(doc.measureJpegHeight(jpegBytes(), 100, 80)).toBe(80);
    expect(doc.images.length).toBe(0);
  });
});

describe('pdfWriter — medida e corte de texto', () => {
  it('a largura cresce com o tamanho da fonte', () => {
    expect(measureText('Estádio', 20)).toBeCloseTo(measureText('Estádio', 10) * 2, 5);
  });

  it('texto vazio mede zero', () => {
    expect(measureText('', 12)).toBe(0);
    expect(measureText(null, 12)).toBe(0);
  });

  it('parte as linhas dentro da largura pedida', () => {
    const lines = wrapText('substituicao da lampada avariada na cabina de som do estadio', 120, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measureText(line, 10)).toBeLessThanOrEqual(120);
  });

  it('respeita as mudanças de linha escritas pelo técnico', () => {
    expect(wrapText('primeira\nsegunda', 400, 10)).toEqual(['primeira', 'segunda']);
  });

  it('corta uma palavra maior que a linha em vez de sair da folha', () => {
    const lines = wrapText('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 40, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measureText(line, 10)).toBeLessThanOrEqual(40);
  });
});

describe('pdfWriter — nome do ficheiro', () => {
  it('tira acentos, barras e espaços', () => {
    expect(safeFileName('Ficha Intervenção 21/08/2026')).toBe('Ficha-Intervencao-21-08-2026');
  });

  it('nunca devolve vazio', () => {
    expect(safeFileName('///')).toBe('documento');
    expect(safeFileName('')).toBe('documento');
  });
});

describe('pdfWriter — entrega do ficheiro', () => {
  let clickSpy;
  let createdUrl;

  beforeEach(() => {
    createdUrl = 'blob:teste';
    global.URL.createObjectURL = vi.fn(() => createdUrl);
    global.URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      // Guarda o estado do link no momento do clique — depois ele é removido.
      clickSpy.captured = { href: this.href, download: this.download };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cria um link com o atributo download e limpa-o depois', async () => {
    const bytes = new PdfDocument().build();
    const result = await savePdf(bytes, 'Ficha EML-ABC123');

    expect(result).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy.captured.download).toBe('Ficha-EML-ABC123.pdf');
    expect(document.querySelectorAll('a[download]').length).toBe(0);
  });

  it('não duplica a extensão .pdf', async () => {
    await savePdf(new PdfDocument().build(), 'relatorio.pdf');
    expect(clickSpy.captured.download).toBe('relatorio.pdf');
  });
});
