import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PdfService } from '../../src/services/pdfService.js';

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

function asLatin1(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function makeReport(extra = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000000',
    date: '2026-08-21T14:30:00.000Z',
    locationName: 'Bancada Poente',
    priority: 'critical',
    status: 'resolved',
    description: 'Troca da lampada avariada na cabina de som.',
    materials: 'Lampada LED 20W, fita isoladora',
    resolutionNotes: 'Testado e a funcionar.',
    timeSpent: 45,
    photos: [],
    ...extra
  };
}

describe('PdfService — ficha de uma intervenção', () => {
  it('gera um PDF válido com a referência da intervenção', () => {
    const text = asLatin1(PdfService.buildReportBytes(makeReport()));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('EML-A1B2C3D4');
  });

  it('escreve o local, a descrição, os materiais e as notas', () => {
    const text = asLatin1(PdfService.buildReportBytes(makeReport()));
    expect(text).toContain('Bancada Poente');
    expect(text).toContain('Troca da lampada avariada');
    expect(text).toContain('Lampada LED 20W');
    expect(text).toContain('Testado e a funcionar');
  });

  it('mostra os selos de prioridade e de estado', () => {
    const text = asLatin1(PdfService.buildReportBytes(makeReport()));
    expect(text).toContain('CR'); // CRÍTICA fica com o Í em octal
    expect(text).toContain('TICA / URGENTE');
    expect(text).toContain('RESOLVIDO');
  });

  it('usa os rótulos por omissão quando a prioridade ou o estado faltam', () => {
    const text = asLatin1(PdfService.buildReportBytes(makeReport({ priority: undefined, status: undefined })));
    expect(text).toContain('DIA'); // MÉDIA
    expect(text).toContain('PENDENTE');
  });

  it('esconde as secções de materiais e resolução quando estão vazias', () => {
    const text = asLatin1(PdfService.buildReportBytes(makeReport({ materials: '', resolutionNotes: '' })));
    expect(text).not.toContain('MATERIAIS, FERRAMENTAS');
    expect(text).not.toContain('NOTAS DE RESOLU');
  });

  it('não rebenta com um relatório vazio ou nulo', () => {
    expect(() => PdfService.buildReportBytes(null)).not.toThrow();
    expect(() => PdfService.buildReportBytes({})).not.toThrow();
    expect(asLatin1(PdfService.buildReportBytes({}))).toContain('Sem descri');
  });

  it('embute as fotos como JPEG cru', () => {
    const bytes = PdfService.buildReportBytes(makeReport(), [
      { bytes: jpegBytes(), caption: 'Antes da Intervenção' }
    ]);
    const text = asLatin1(bytes);
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('FOTO 1');
  });

  it('inclui as linhas de assinatura', () => {
    const text = asLatin1(PdfService.buildReportBytes(makeReport()));
    expect(text).toContain('Assinatura do T');
    expect(text).toContain('Respons');
  });

  it('uma descrição enorme gera várias páginas', () => {
    const longText = 'Verificacao completa de todos os pontos de luz do estadio. '.repeat(80);
    const text = asLatin1(PdfService.buildReportBytes(makeReport({ description: longText })));
    const count = Number((text.match(/\/Count (\d+)/) || [])[1]);
    expect(count).toBeGreaterThan(1);
  });
});

describe('PdfService — relatório de período', () => {
  const meta = { periodLabel: 'Relatório Diário', rangeText: '21 de agosto de 2026', sectorLabel: 'Bancada Poente' };

  it('avisa quando não há intervenções no período', () => {
    const text = asLatin1(PdfService.buildSummaryBytes([], meta));
    expect(text).toContain('Sem interven');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
  });

  it('conta as intervenções, as críticas e as resolvidas', () => {
    const list = [
      makeReport({ id: '1', priority: 'critical', status: 'resolved' }),
      makeReport({ id: '2', priority: 'low', status: 'pending' }),
      makeReport({ id: '3', priority: 'critical', status: 'in_progress' })
    ];
    const text = asLatin1(PdfService.buildSummaryBytes(list, meta));
    expect(text).toContain('INTERVEN');
    expect(text).toContain('RESOLVIDAS');
    // Numeração dos itens da lista.
    expect(text).toContain('1. Bancada Poente');
    expect(text).toContain('3. Bancada Poente');
  });

  it('aceita uma lista inválida sem rebentar', () => {
    expect(() => PdfService.buildSummaryBytes(null, meta)).not.toThrow();
    expect(() => PdfService.buildSummaryBytes(undefined, {})).not.toThrow();
  });

  it('junta as fotos de cada intervenção', () => {
    const list = [makeReport({ id: '1' }), makeReport({ id: '2' })];
    const text = asLatin1(PdfService.buildSummaryBytes(list, meta, [
      [{ bytes: jpegBytes(), caption: 'Registo Técnico' }],
      []
    ]));
    expect(text).toContain('/Filter /DCTDecode');
  });
});

describe('PdfService — download', () => {
  let clickSpy;

  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:teste');
    global.URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clickSpy.captured = { download: this.download };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exportReport transfere o ficheiro com nome legível', async () => {
    const result = await PdfService.exportReport(makeReport());
    expect(result.outcome).toBe('downloaded');
    expect(result.fileName).toBe('Ficha-EML-A1B2C3D4-2026-08-21.pdf');
    expect(clickSpy.captured.download).toBe('Ficha-EML-A1B2C3D4-2026-08-21.pdf');
  });

  it('exportReport devolve null sem relatório', async () => {
    expect(await PdfService.exportReport(null)).toBeNull();
  });

  it('exportSummaryReport transfere o relatório do período', async () => {
    const result = await PdfService.exportSummaryReport([makeReport()], {
      periodLabel: 'Relatório Diário',
      rangeText: '21 de agosto de 2026'
    });
    expect(result.outcome).toBe('downloaded');
    expect(result.fileName).toContain('EML-Relatorio-Diario');
    expect(result.fileName.endsWith('.pdf')).toBe(true);
  });

  it('uma foto ilegível não impede o download da ficha', async () => {
    const report = makeReport({ photos: [{ blobData: new Uint8Array([1, 2, 3]), type: 'before' }] });
    const result = await PdfService.exportReport(report);
    expect(result.outcome).toBe('downloaded');
  });
});
