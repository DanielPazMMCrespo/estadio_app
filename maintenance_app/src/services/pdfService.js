import { getPhotoDataUrl } from '../db/db.js';

const PRIORITY_LABELS = {
  critical: { label: 'CRÍTICA / URGENTE', color: '#EF4444', bg: '#FEE2E2' },
  medium: { label: 'MÉDIA', color: '#D97706', bg: '#FEF3C7' },
  low: { label: 'BAIXA', color: '#059669', bg: '#D1FAE5' }
};

const STATUS_LABELS = {
  resolved: { label: 'CONCLUÍDO / RESOLVIDO', color: '#059669', bg: '#D1FAE5' },
  in_progress: { label: 'EM CURSO', color: '#2563EB', bg: '#DBEAFE' },
  pending: { label: 'PENDENTE', color: '#D97706', bg: '#FEF3C7' }
};

function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPhotosGridHtml(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return '';

  const photosList = photos.map((p, idx) => {
    const url = getPhotoDataUrl(p);
    if (!url) return '';
    const typeLabel = p.type === 'before' ? 'Antes da Intervenção' : (p.type === 'after' ? 'Após Conclusão' : 'Registo Técnico');
    return `
      <div style="border:1px solid #E5E7EB; border-radius:8px; overflow:hidden; background:#F9FAFB; padding:8px;">
        <div style="font-size:11px; font-weight:700; color:#374151; margin-bottom:6px; text-transform:uppercase;">
          Foto #${idx + 1} — ${typeLabel}
        </div>
        <img src="${url}" style="width:100%; max-height:260px; object-fit:contain; border-radius:4px; display:block;" />
      </div>
    `;
  }).filter(Boolean).join('');

  if (!photosList) return '';

  return `
    <div style="margin-top:14px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        ${photosList}
      </div>
    </div>
  `;
}

/**
 * PDF / Printable Work Order Service
 * Generates and prints/downloads a structured intervention sheet for stadium maintenance.
 */
export class PdfService {
  /**
   * Generates printable work order HTML and triggers window print / save as PDF.
   * @param {Object} report 
   */
  static exportReport(report) {
    if (!report) return;

    const date = new Date(report.date || Date.now());
    const dateFormatted = date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeFormatted = date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const operatorName = localStorage.getItem('operator_name') || 'Técnico de Manutenção';
    const reportRef = `EML-${(report.id || '').substring(0, 8).toUpperCase()}`;

    const priorityInfo = PRIORITY_LABELS[report.priority] || PRIORITY_LABELS.medium;
    const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.pending;

    const photosGrid = buildPhotosGridHtml(report.photos);
    const photosHtml = photosGrid ? `
      <div style="margin-top:20px;">
        <h3 style="font-size:14px; font-weight:700; color:#111827; border-bottom:1px solid #E5E7EB; padding-bottom:6px; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">
          Registo Fotográfico & Evidências
        </h3>
        ${photosGrid}
      </div>
    ` : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permita pop-ups para gerar a ficha em PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8" />
        <title>Ficha de Intervenção — ${reportRef}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            color: #1F2937;
            background: #FFFFFF;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #0B132B;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 11px;
            letter-spacing: 0.05em;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
            background: #F9FAFB;
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            padding: 14px;
          }
          .info-item label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: #6B7280;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .info-item value {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #111827;
          }
          .section-box {
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 8px 0;
          }
          .signature-box {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
          }
          .sign-line {
            border-top: 1px solid #9CA3AF;
            margin-top: 50px;
            padding-top: 6px;
            text-align: center;
            font-size: 12px;
            color: #4B5563;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; background:#0B132B; color:#fff; padding:12px 18px; border-radius:8px;">
          <div><strong>Ficha Técnica Pronta</strong> — Clique em Imprimir ou Guardar em PDF</div>
          <button onclick="window.print()" style="background:#10B981; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:700; cursor:pointer;">Imprimir / Guardar PDF</button>
        </div>

        <table class="header-table">
          <tr>
            <td>
              <h1 style="margin:0; font-size:18px; color:#0B132B; text-transform:uppercase; letter-spacing:0.02em;">
                Estádio Municipal de Leiria
              </h1>
              <div style="font-size:12px; color:#6B7280; margin-top:2px;">
                Ficha Técnica de Manutenção e Intervenção de Campo
              </div>
            </td>
            <td style="text-align:right;">
              <div style="font-size:16px; font-weight:700; color:#0B132B;">REF: ${reportRef}</div>
              <div style="font-size:12px; color:#6B7280;">Emitido em: ${dateFormatted} às ${timeFormatted}</div>
            </td>
          </tr>
        </table>

        <div class="info-grid">
          <div class="info-item">
            <label>Setor / Localização</label>
            <value>${report.locationName || 'Não especificado'}</value>
          </div>
          <div class="info-item">
            <label>Técnico Responsável</label>
            <value>${operatorName}</value>
          </div>
          <div class="info-item">
            <label>Nível de Prioridade</label>
            <span class="badge" style="background:${priorityInfo.bg}; color:${priorityInfo.color}; border:1px solid ${priorityInfo.color};">
              ${priorityInfo.label}
            </span>
          </div>
          <div class="info-item">
            <label>Estado da Ocorrência</label>
            <span class="badge" style="background:${statusInfo.bg}; color:${statusInfo.color}; border:1px solid ${statusInfo.color};">
              ${statusInfo.label}
            </span>
          </div>
          <div class="info-item">
            <label>Data & Hora da Ocorrência</label>
            <value>${dateFormatted} · ${timeFormatted}</value>
          </div>
          <div class="info-item">
            <label>Tempo de Intervenção</label>
            <value>${report.timeSpent || 0} minutos</value>
          </div>
        </div>

        <div class="section-box">
          <div class="section-title">Descrição da Intervenção / Trabalhos</div>
          <div style="white-space:pre-line; color:#1F2937; font-size:13px;">${report.description || 'Sem descrição detalhada.'}</div>
        </div>

        ${report.materials ? `
          <div class="section-box">
            <div class="section-title">Materiais, Ferramentas & Peças Utilizadas</div>
            <div style="color:#1F2937; font-size:13px;">${report.materials}</div>
          </div>
        ` : ''}

        ${report.resolutionNotes ? `
          <div class="section-box" style="background:#F0FDF4; border-color:#BBF7D0;">
            <div class="section-title" style="color:#166534;">Notas de Resolução / Observações Finais</div>
            <div style="color:#166534; font-size:13px;">${report.resolutionNotes}</div>
          </div>
        ` : ''}

        ${photosHtml}

        <div class="signature-box">
          <div>
            <div class="sign-line">Assinatura do Técnico (${operatorName})</div>
          </div>
          <div>
            <div class="sign-line">Validação / Responsável das Instalações</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  /**
   * Generates a printable summary report covering several interventions in a period
   * (dia / semana / mês / intervalo personalizado), with photos included.
   * @param {Array} reports
   * @param {Object} meta
   * @param {string} meta.periodLabel - e.g. "Relatório Diário"
   * @param {string} meta.rangeText - e.g. "17 de agosto de 2026"
   * @param {string} [meta.sectorLabel] - e.g. "Bancada Poente" or "Todas as áreas"
   */
  static exportSummaryReport(reports, meta = {}) {
    const list = Array.isArray(reports) ? reports : [];
    const operatorName = localStorage.getItem('operator_name') || 'Técnico de Manutenção';
    const generatedAt = new Date();
    const generatedAtStr = generatedAt.toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const totalPhotos = list.reduce((sum, r) => sum + (Array.isArray(r.photos) ? r.photos.length : 0), 0);
    const countBy = (pred) => list.filter(pred).length;
    const stats = [
      { label: 'Intervenções', value: list.length },
      { label: 'Críticas', value: countBy(r => r.priority === 'critical') },
      { label: 'Resolvidas', value: countBy(r => r.status === 'resolved') },
      { label: 'Pendentes / Em curso', value: countBy(r => r.status !== 'resolved') },
      { label: 'Fotos anexadas', value: totalPhotos }
    ];

    const statsHtml = stats.map(s => `
      <div style="flex:1; min-width:110px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; padding:12px; text-align:center;">
        <div style="font-size:22px; font-weight:800; color:#0B132B;">${s.value}</div>
        <div style="font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:0.04em; margin-top:2px;">${s.label}</div>
      </div>
    `).join('');

    const itemsHtml = list.map((report, idx) => {
      const date = new Date(report.date || Date.now());
      const dateStr = date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const priorityInfo = PRIORITY_LABELS[report.priority] || PRIORITY_LABELS.medium;
      const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.pending;
      const photosGrid = buildPhotosGridHtml(report.photos);

      return `
        <div style="break-inside:avoid; border:1px solid #E5E7EB; border-radius:8px; padding:14px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#0B132B;">${idx + 1}. ${escHtml(report.locationName || 'Não especificado')}</div>
              <div style="font-size:11px; color:#6B7280; margin-top:2px;">${dateStr} · ${timeStr}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <span class="badge" style="background:${priorityInfo.bg}; color:${priorityInfo.color}; border:1px solid ${priorityInfo.color};">${priorityInfo.label}</span>
              <span class="badge" style="background:${statusInfo.bg}; color:${statusInfo.color}; border:1px solid ${statusInfo.color};">${statusInfo.label}</span>
            </div>
          </div>
          <div style="white-space:pre-line; color:#1F2937; font-size:12.5px;">${escHtml(report.description || 'Sem descrição.')}</div>
          ${report.materials ? `<div style="font-size:12px; color:#4B5563; margin-top:6px;"><strong>Materiais:</strong> ${escHtml(report.materials)}</div>` : ''}
          ${report.resolutionNotes ? `<div style="font-size:12px; color:#166534; margin-top:6px;"><strong>Resolução:</strong> ${escHtml(report.resolutionNotes)}</div>` : ''}
          ${photosGrid}
        </div>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permita pop-ups para gerar o relatório em PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8" />
        <title>${escHtml(meta.periodLabel || 'Relatório')} — Estádio Municipal de Leiria</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { color: #1F2937; background: #FFFFFF; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header-table { width: 100%; border-bottom: 2px solid #0B132B; padding-bottom: 14px; margin-bottom: 18px; }
          .badge { display: inline-block; padding: 3px 9px; border-radius: 4px; font-weight: 700; font-size: 10px; letter-spacing: 0.03em; white-space: nowrap; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; background:#0B132B; color:#fff; padding:12px 18px; border-radius:8px;">
          <div><strong>Relatório Pronto</strong> — Clique em Imprimir ou Guardar em PDF</div>
          <button onclick="window.print()" style="background:#10B981; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:700; cursor:pointer;">Imprimir / Guardar PDF</button>
        </div>

        <table class="header-table">
          <tr>
            <td>
              <h1 style="margin:0; font-size:18px; color:#0B132B; text-transform:uppercase; letter-spacing:0.02em;">
                Estádio Municipal de Leiria
              </h1>
              <div style="font-size:12px; color:#6B7280; margin-top:2px;">${escHtml(meta.periodLabel || 'Relatório')}</div>
            </td>
            <td style="text-align:right;">
              <div style="font-size:14px; font-weight:700; color:#0B132B;">${escHtml(meta.rangeText || '')}</div>
              <div style="font-size:12px; color:#6B7280;">${meta.sectorLabel ? `Área: ${escHtml(meta.sectorLabel)} · ` : ''}Emitido em: ${generatedAtStr}</div>
              <div style="font-size:12px; color:#6B7280;">Técnico: ${escHtml(operatorName)}</div>
            </td>
          </tr>
        </table>

        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
          ${statsHtml}
        </div>

        ${list.length === 0 ? `
          <div style="text-align:center; color:#6B7280; padding:40px 0;">Sem intervenções registadas neste período.</div>
        ` : itemsHtml}
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
