import { getPhotoArrayBuffer, getPhotoDataUrl } from '../db/db.js';
import { PdfDocument, savePdf, wrapText, safeFileName } from './pdfWriter.js';

/**
 * Geração das fichas e relatórios em PDF.
 *
 * Antes isto abria um separador novo com HTML e obrigava o técnico a clicar em
 * "Imprimir / Guardar PDF". Com luvas, ao sol, isso eram três toques a mais e
 * ninguém percebia onde ficava o ficheiro. Agora escreve-se um PDF verdadeiro
 * (ver pdfWriter.js) e faz-se download direto.
 *
 * Consequência assumida: um PDF não tem CSS. Os selos de prioridade/estado são
 * retângulos pintados e as secções são títulos com um filete por baixo. O
 * conteúdo é exatamente o mesmo que a versão HTML mostrava.
 */

// Paleta do PDF. Espelha os tokens de src/styles/theme.css, mas em valores
// literais: o PDF não tem CSS nem custom properties para ler.
const PDF_COLORS = {
  brand: '#557D14',        // --color-brand-primary (verde do logotipo mmcrespo)
  brandText: '#4E7215',    // --color-brand-text
  text: '#14181E',         // --color-text
  muted: '#4A5560',        // --color-text-secondary
  hairline: '#E2E8F0',
  boxFill: '#F8FAFC',
  signLine: '#9CA3AF'
};

const PRIORITY_LABELS = {
  critical: { label: 'Crítica / Urgente', color: '#B01717', bg: '#FCECEC' },
  medium: { label: 'Média', color: '#B45309', bg: '#FCF3E7' },
  low: { label: 'Baixa', color: '#047857', bg: '#E8F6F0' }
};

const STATUS_LABELS = {
  resolved: { label: 'Concluído / Resolvido', color: '#047857', bg: '#E8F6F0' },
  in_progress: { label: 'Em Curso', color: '#075985', bg: '#EAF2F8' },
  pending: { label: 'Pendente', color: '#B45309', bg: '#FCF3E7' }
};

const PHOTO_CAPTIONS = {
  before: 'Antes da Intervenção',
  after: 'Após Conclusão'
};

const MAX_PHOTO_HEIGHT = 170;

// Espera máxima para reconverter uma foto que não seja JPEG (ver photoToJpegBytes).
const PHOTO_DECODE_TIMEOUT_MS = 4000;

function operatorName() {
  try {
    return localStorage.getItem('operator_name') || 'Técnico de Manutenção';
  } catch (err) {
    // localStorage pode não existir (testes, modo privado antigo).
    return 'Técnico de Manutenção';
  }
}

function formatDate(value) {
  return new Date(value || Date.now()).toLocaleDateString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatTime(value) {
  return new Date(value || Date.now()).toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit'
  });
}

function reportRef(report) {
  return 'EML-' + String((report && report.id) || '').substring(0, 8).toUpperCase();
}

/** Data em ISO curto para o nome do ficheiro: 2026-08-21. */
function isoDay(value) {
  const d = new Date(value || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function base64ToBytes(base64) {
  if (typeof atob !== 'function') return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (err) {
    return null;
  }
}

/**
 * Converte uma foto para bytes JPEG, que é o único formato que o PDF aceita
 * cru (filtro /DCTDecode).
 *
 * As fotos da app já saem em JPEG do photoCompressor, por isso o caminho normal
 * é devolver os bytes tal como estão. Só quando o compressor falhou e guardou o
 * ficheiro original (PNG, WebP) é que se passa pelo canvas para converter.
 * Nunca lança: uma foto que não dê é ignorada, o resto da ficha sai igual.
 */
async function photoToJpegBytes(photo) {
  try {
    const buffer = await getPhotoArrayBuffer(photo);
    const bytes = buffer && buffer.byteLength ? new Uint8Array(buffer) : null;
    if (bytes && bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8) return bytes;

    // Não é JPEG: tenta reconverter pelo canvas do browser.
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
    const dataUrl = getPhotoDataUrl(photo);
    if (!dataUrl) return null;

    // Tem de haver relógio: um <img> que nunca dispara onload nem onerror
    // deixava o botão de exportar bloqueado para sempre. 4 s é metade do que o
    // photoCompressor espera, porque aqui o pior caso é só perder uma foto.
    const image = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), PHOTO_DECODE_TIMEOUT_MS);
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = dataUrl;
    });
    if (!image || !image.naturalWidth) return null;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.8);
    const comma = jpegUrl.indexOf(',');
    if (comma < 0) return null;
    return base64ToBytes(jpegUrl.slice(comma + 1));
  } catch (err) {
    return null;
  }
}

/** Prepara a lista de fotos prontas a desenhar. Fotos ilegíveis desaparecem. */
async function collectPhotos(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const out = [];
  for (const photo of photos) {
    const bytes = await photoToJpegBytes(photo);
    if (!bytes) continue;
    out.push({
      bytes,
      caption: PHOTO_CAPTIONS[photo && photo.type] || 'Registo Técnico'
    });
  }
  return out;
}

// ---- blocos de desenho reutilizados pelas duas saídas --------------------

/** Cabeçalho com o nome do estádio à esquerda e a identificação à direita. */
function drawHeader(doc, subtitle, rightLines) {
  const top = doc.y;
  doc.drawText('ESTÁDIO MUNICIPAL DE LEIRIA', doc.left, top - 14, {
    size: 14.5, bold: true, color: PDF_COLORS.brandText
  });
  doc.drawText(subtitle, doc.left, top - 26, { size: 8.5, color: PDF_COLORS.muted });

  (rightLines || []).forEach((line, idx) => {
    doc.drawText(line.text, doc.right, top - 13 - idx * 11, {
      size: line.size || 8.5,
      bold: !!line.bold,
      color: line.color || PDF_COLORS.muted,
      align: 'right'
    });
  });

  const bottom = top - Math.max(34, 15 + (rightLines || []).length * 11);
  doc.line(doc.left, bottom, doc.right, bottom, { color: PDF_COLORS.brand, lineWidth: 1.4 });
  doc.y = bottom - 4;
}

/**
 * Caixa com a grelha de dados em duas colunas.
 * `rows` é uma lista de pares [célulaEsquerda, célulaDireita]; cada célula é
 * `{ label, value }` ou `{ label, badge: { text, color, bg } }`.
 */
function drawInfoBox(doc, rows) {
  const rowHeight = 30;
  const padding = 12;
  const boxHeight = rows.length * rowHeight + padding * 2 - 6;
  doc.ensureSpace(boxHeight + 10);

  const top = doc.y;
  doc.rect(doc.left, top - boxHeight, doc.contentWidth, boxHeight, {
    fill: PDF_COLORS.boxFill, stroke: PDF_COLORS.hairline
  });

  const colGap = 18;
  const colWidth = (doc.contentWidth - padding * 2 - colGap) / 2;

  rows.forEach((row, rowIdx) => {
    const rowTop = top - padding - rowIdx * rowHeight;
    row.forEach((cell, colIdx) => {
      if (!cell) return;
      const x = doc.left + padding + colIdx * (colWidth + colGap);
      doc.drawText(String(cell.label || '').toUpperCase(), x, rowTop - 8, {
        size: 7.5, bold: true, color: PDF_COLORS.muted
      });
      if (cell.badge) {
        doc.badge(cell.badge.text, x, rowTop - 24, {
          size: 7.5, color: cell.badge.color, bg: cell.badge.bg
        });
        return;
      }
      const line = wrapText(cell.value || '—', colWidth, 10.5, true)[0] || '—';
      doc.drawText(line, x, rowTop - 21, { size: 10.5, bold: true, color: PDF_COLORS.text });
    });
  });

  doc.y = top - boxHeight - 6;
}

/** Grelha de fotos, duas por linha, com legenda em cima. */
function drawPhotoGrid(doc, items) {
  if (!items || items.length === 0) return;
  const gap = 12;
  const cellWidth = (doc.contentWidth - gap) / 2;
  const imageWidth = cellWidth - 12;

  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    const heights = pair.map((p) => doc.measureJpegHeight(p.bytes, imageWidth, MAX_PHOTO_HEIGHT));
    const rowHeight = Math.max(Math.max.apply(null, heights.concat([0])), 40) + 26;

    doc.ensureSpace(rowHeight + 8);
    const top = doc.y;

    pair.forEach((p, idx) => {
      const x = doc.left + idx * (cellWidth + gap);
      const h = heights[idx];
      doc.rect(x, top - rowHeight, cellWidth, rowHeight, {
        fill: '#FBFCFD', stroke: PDF_COLORS.hairline
      });
      doc.drawText('FOTO ' + (i + idx + 1) + ' — ' + p.caption.toUpperCase(), x + 6, top - 12, {
        size: 7.5, bold: true, color: PDF_COLORS.muted
      });
      if (h > 0) doc.drawJpeg(p.bytes, x + 6, top - 20 - h, imageWidth, MAX_PHOTO_HEIGHT);
    });

    doc.y = top - rowHeight - gap;
  }
}

/** Duas linhas de assinatura no fim da ficha. */
function drawSignatures(doc, technician) {
  doc.ensureSpace(78);
  doc.y -= 48;
  const gap = 30;
  const colWidth = (doc.contentWidth - gap) / 2;
  const labels = [
    'Assinatura do Técnico (' + technician + ')',
    'Validação / Responsável das Instalações'
  ];
  labels.forEach((label, idx) => {
    const x = doc.left + idx * (colWidth + gap);
    doc.line(x, doc.y, x + colWidth, doc.y, { color: PDF_COLORS.signLine, lineWidth: 0.7 });
    const text = wrapText(label, colWidth, 8)[0] || label;
    doc.drawText(text, x + colWidth / 2, doc.y - 11, {
      size: 8, color: PDF_COLORS.muted, align: 'center'
    });
  });
  doc.y -= 24;
}

/** Faixa de números do relatório de período. */
function drawStatsRow(doc, stats) {
  const gap = 8;
  const cellWidth = (doc.contentWidth - gap * (stats.length - 1)) / stats.length;
  const height = 46;
  doc.ensureSpace(height + 12);
  const top = doc.y;

  stats.forEach((stat, idx) => {
    const x = doc.left + idx * (cellWidth + gap);
    doc.rect(x, top - height, cellWidth, height, {
      fill: PDF_COLORS.boxFill, stroke: PDF_COLORS.hairline
    });
    doc.drawText(String(stat.value), x + cellWidth / 2, top - 25, {
      size: 18, bold: true, color: PDF_COLORS.brandText, align: 'center'
    });
    const label = wrapText(stat.label, cellWidth - 6, 6.8)[0] || stat.label;
    doc.drawText(label.toUpperCase(), x + cellWidth / 2, top - 38, {
      size: 6.8, color: PDF_COLORS.muted, align: 'center'
    });
  });

  doc.y = top - height - 12;
}

// ---- serviço público -----------------------------------------------------

export class PdfService {
  /**
   * Monta os bytes da ficha de uma intervenção.
   * É separado do download para poder ser testado sem browser.
   * @param {Object} report
   * @param {Array} photoItems - resultado de collectPhotos()
   * @returns {Uint8Array}
   */
  static buildReportBytes(report, photoItems = []) {
    const safeReport = report || {};
    const technician = operatorName();
    const ref = reportRef(safeReport);
    const dateStr = formatDate(safeReport.date);
    const timeStr = formatTime(safeReport.date);
    const priority = PRIORITY_LABELS[safeReport.priority] || PRIORITY_LABELS.medium;
    const status = STATUS_LABELS[safeReport.status] || STATUS_LABELS.pending;

    const doc = new PdfDocument({
      title: 'Ficha de Intervenção ' + ref,
      footerText: 'Ficha ' + ref + ' · Estádio Municipal de Leiria'
    });

    drawHeader(doc, 'Ficha Técnica de Manutenção e Intervenção de Campo', [
      { text: 'REF: ' + ref, size: 11, bold: true, color: PDF_COLORS.text },
      { text: 'Emitido em: ' + formatDate() + ' às ' + formatTime() }
    ]);

    drawInfoBox(doc, [
      [
        { label: 'Setor / Localização', value: safeReport.locationName || 'Não especificado' },
        { label: 'Técnico Responsável', value: technician }
      ],
      [
        { label: 'Nível de Prioridade', badge: { text: priority.label, color: priority.color, bg: priority.bg } },
        { label: 'Estado da Ocorrência', badge: { text: status.label, color: status.color, bg: status.bg } }
      ],
      [
        { label: 'Data & Hora da Ocorrência', value: dateStr + ' · ' + timeStr },
        { label: 'Tempo de Intervenção', value: (safeReport.timeSpent || 0) + ' minutos' }
      ]
    ]);

    doc.sectionTitle('Descrição da Intervenção / Trabalhos');
    doc.paragraph(safeReport.description || 'Sem descrição detalhada.', { size: 10, spaceAfter: 4 });

    if (safeReport.materials) {
      doc.sectionTitle('Materiais, Ferramentas & Peças Utilizadas');
      doc.paragraph(safeReport.materials, { size: 10, spaceAfter: 4 });
    }

    if (safeReport.resolutionNotes) {
      doc.sectionTitle('Notas de Resolução / Observações Finais', { color: '#047857' });
      doc.paragraph(safeReport.resolutionNotes, { size: 10, color: '#047857', spaceAfter: 4 });
    }

    if (photoItems.length) {
      doc.sectionTitle('Registo Fotográfico & Evidências');
      doc.space(8);
      drawPhotoGrid(doc, photoItems);
    }

    drawSignatures(doc, technician);
    return doc.build();
  }

  /**
   * Gera a ficha de uma intervenção e entrega o ficheiro ao técnico.
   * @returns {Promise<{fileName: string, outcome: string}|null>}
   */
  static async exportReport(report) {
    if (!report) return null;
    const photoItems = await collectPhotos(report.photos);
    const bytes = PdfService.buildReportBytes(report, photoItems);
    const fileName = safeFileName('Ficha-' + reportRef(report) + '-' + isoDay(report.date)) + '.pdf';
    const outcome = await savePdf(bytes, fileName);
    return { fileName, outcome };
  }

  /**
   * Monta os bytes do relatório de um período (dia, semana, mês, intervalo).
   * @param {Array} reports
   * @param {Object} meta - { periodLabel, rangeText, sectorLabel }
   * @param {Array<Array>} photosByReport - fotos já preparadas, por índice
   * @returns {Uint8Array}
   */
  static buildSummaryBytes(reports, meta = {}, photosByReport = []) {
    const list = Array.isArray(reports) ? reports : [];
    const technician = operatorName();
    const periodLabel = meta.periodLabel || 'Relatório';

    const doc = new PdfDocument({
      title: periodLabel + ' — Estádio Municipal de Leiria',
      footerText: periodLabel + ' · ' + (meta.rangeText || '')
    });

    drawHeader(doc, periodLabel, [
      { text: meta.rangeText || '', size: 10.5, bold: true, color: PDF_COLORS.text },
      { text: (meta.sectorLabel ? 'Área: ' + meta.sectorLabel + ' · ' : '') + 'Emitido em: ' + formatDate() + ' ' + formatTime() },
      { text: 'Técnico: ' + technician }
    ]);

    const totalPhotos = list.reduce((sum, r) => sum + (Array.isArray(r.photos) ? r.photos.length : 0), 0);
    const countBy = (pred) => list.filter(pred).length;
    drawStatsRow(doc, [
      { label: 'Intervenções', value: list.length },
      { label: 'Críticas', value: countBy((r) => r.priority === 'critical') },
      { label: 'Resolvidas', value: countBy((r) => r.status === 'resolved') },
      { label: 'Pendentes / Em curso', value: countBy((r) => r.status !== 'resolved') },
      { label: 'Fotos anexadas', value: totalPhotos }
    ]);

    if (list.length === 0) {
      doc.space(20);
      doc.paragraph('Sem intervenções registadas neste período.', {
        size: 10.5, color: PDF_COLORS.muted
      });
      return doc.build();
    }

    list.forEach((report, idx) => {
      doc.ensureSpace(72);
      if (idx > 0) {
        doc.y -= 10;
        doc.line(doc.left, doc.y, doc.right, doc.y, { color: PDF_COLORS.hairline, lineWidth: 0.7 });
      }

      const priority = PRIORITY_LABELS[report.priority] || PRIORITY_LABELS.medium;
      const status = STATUS_LABELS[report.status] || STATUS_LABELS.pending;

      doc.y -= 20;
      const heading = (idx + 1) + '. ' + (report.locationName || 'Não especificado');
      doc.drawText(wrapText(heading, doc.contentWidth - 10, 11, true)[0] || heading, doc.left, doc.y, {
        size: 11, bold: true, color: PDF_COLORS.brandText
      });

      doc.y -= 12;
      doc.drawText(formatDate(report.date) + ' · ' + formatTime(report.date), doc.left, doc.y, {
        size: 8, color: PDF_COLORS.muted
      });

      doc.y -= 16;
      const badgeWidth = doc.badge(priority.label, doc.left, doc.y, {
        size: 7.5, color: priority.color, bg: priority.bg
      });
      doc.badge(status.label, doc.left + badgeWidth + 6, doc.y, {
        size: 7.5, color: status.color, bg: status.bg
      });
      doc.y -= 6;

      doc.paragraph(report.description || 'Sem descrição.', { size: 9.5 });
      if (report.materials) {
        doc.paragraph('Materiais: ' + report.materials, { size: 9, color: PDF_COLORS.muted });
      }
      if (report.resolutionNotes) {
        doc.paragraph('Resolução: ' + report.resolutionNotes, { size: 9, color: '#047857' });
      }

      const photos = photosByReport[idx] || [];
      if (photos.length) {
        doc.space(6);
        drawPhotoGrid(doc, photos);
      }
      doc.space(6);
    });

    return doc.build();
  }

  /**
   * Gera o relatório de um período e entrega o ficheiro ao técnico.
   * @returns {Promise<{fileName: string, outcome: string}>}
   */
  static async exportSummaryReport(reports, meta = {}) {
    const list = Array.isArray(reports) ? reports : [];
    const photosByReport = [];
    for (const report of list) {
      photosByReport.push(await collectPhotos(report.photos));
    }
    const bytes = PdfService.buildSummaryBytes(list, meta, photosByReport);
    const base = (meta.periodLabel || 'Relatorio') + '-' + (meta.rangeText || isoDay());
    const fileName = safeFileName('EML-' + base) + '.pdf';
    const outcome = await savePdf(bytes, fileName);
    return { fileName, outcome };
  }
}
