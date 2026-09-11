import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency } from '../lib/utils';

/**
 * Job Costs report PDF.
 * @param {Object} report - { totals, sites[], trades[] } as built in AdminReports
 * @param {Object} range  - { label }
 * @param {Object} generatedBy - { full_name }
 */
export function generateJobCostsPDF(report, range, generatedBy) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // ---------- Header ----------
  doc.setDrawColor(68, 138, 64);
  doc.setLineWidth(0.8);
  doc.line(margin, y + 24, pageWidth - margin, y + 24);

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CITY CONSTRUCTION GROUP LTD', margin, y + 4);

  doc.setTextColor(34, 34, 34);
  doc.setFontSize(16);
  doc.text('Job Costs Report', margin, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  doc.text(`Period: ${range.label}    (by week-ending date, all statuses)`, margin, y + 20);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(`Generated ${today}`, pageWidth - margin, y + 8, { align: 'right' });
  if (generatedBy?.full_name) doc.text(`by ${generatedBy.full_name}`, pageWidth - margin, y + 13, { align: 'right' });

  y += 32;

  // ---------- Summary tiles ----------
  const gap = 3;
  const tileW = (pageWidth - margin * 2 - gap * 3) / 4;
  const tileH = 18;
  const tile = (x, fill, labelRgb, label, value, sub) => {
    doc.setFillColor(...fill);
    doc.roundedRect(x, y, tileW, tileH, 1.5, 1.5, 'F');
    doc.setTextColor(...labelRgb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 3, y + 4.5);
    doc.setFontSize(12);
    doc.text(value, x + 3, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(sub, x + 3, y + 16);
  };
  const t = report.totals;
  tile(margin, [245, 245, 245], [60, 60, 60], 'Gross spend', formatCurrency(t.gross), `${t.sheets} timesheets`);
  tile(margin + (tileW + gap), [251, 244, 230], [138, 88, 16], 'CIS retained', formatCurrency(t.cis), 'to HMRC');
  tile(margin + (tileW + gap) * 2, [232, 245, 232], [45, 99, 41], 'Net paid', formatCurrency(t.net), 'to workers');
  tile(margin + (tileW + gap) * 3, [245, 245, 245], [60, 60, 60], 'Active', `${t.sites} site${t.sites !== 1 ? 's' : ''}`, `${t.workers} workers · ${t.trades} trades`);
  y += tileH + 8;

  const pct = (a, b) => b > 0 ? `${Math.round((a / b) * 100)}%` : '0%';

  const commonStyles = {
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60], fontSize: 8, fontStyle: 'bold', cellPadding: 2, lineColor: [200, 200, 200], lineWidth: { bottom: 0.4 } },
    bodyStyles: { fontSize: 8, cellPadding: 2, lineColor: [240, 240, 240], lineWidth: { bottom: 0.2 }, textColor: [34, 34, 34] },
    footStyles: { fillColor: [45, 99, 41], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 22, halign: 'right', textColor: [138, 88, 16] },
      5: { cellWidth: 24, halign: 'right', textColor: [45, 99, 41] },
      6: { cellWidth: 'auto', halign: 'right', textColor: [120, 120, 120] },
    },
  };

  // ---------- Section: by site (with trade sub-rows) ----------
  doc.setTextColor(34, 34, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Spend by site', margin, y);
  y += 3;

  const siteBody = [];
  const subRowIdx = new Set();
  report.sites.forEach(s => {
    siteBody.push([`${s.name}${s.ref ? `  #${s.ref}` : ''}`, s.workers, s.sheets, formatCurrency(s.gross), formatCurrency(s.cis), formatCurrency(s.net), pct(s.gross, t.gross)]);
    s.trades.forEach(tr => {
      subRowIdx.add(siteBody.length);
      siteBody.push([`      ${tr.name}`, tr.workers, tr.sheets, formatCurrency(tr.gross), formatCurrency(tr.cis), formatCurrency(tr.net), pct(tr.gross, s.gross)]);
    });
  });

  doc.autoTable({
    ...commonStyles,
    startY: y,
    head: [['Site / trade', 'Workers', 'Sheets', 'Gross', 'CIS', 'Net', '%']],
    body: siteBody,
    foot: [['TOTAL', t.workers, t.sheets, formatCurrency(t.gross), formatCurrency(t.cis), formatCurrency(t.net), '100%']],
    didParseCell: (data) => {
      if (data.section === 'body' && subRowIdx.has(data.row.index)) {
        data.cell.styles.fontSize = 7.5;
        data.cell.styles.textColor = [110, 110, 110];
        data.cell.styles.fontStyle = 'normal';
        data.cell.styles.fillColor = [250, 250, 250];
      }
      if (data.section === 'foot') data.cell.styles.textColor = [255, 255, 255];
    },
  });

  y = doc.lastAutoTable.finalY + 10;
  if (y > pageHeight - 60) { doc.addPage(); y = margin; }

  // ---------- Section: by trade ----------
  doc.setTextColor(34, 34, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Spend by worker category', margin, y);
  y += 3;

  doc.autoTable({
    ...commonStyles,
    startY: y,
    head: [['Trade', 'Workers', 'Sheets', 'Gross', 'CIS', 'Net', '%']],
    body: report.trades.map(tr => [tr.name, tr.workers, tr.sheets, formatCurrency(tr.gross), formatCurrency(tr.cis), formatCurrency(tr.net), pct(tr.gross, t.gross)]),
    foot: [['TOTAL', t.workers, t.sheets, formatCurrency(t.gross), formatCurrency(t.cis), formatCurrency(t.net), '100%']],
    didParseCell: (data) => { if (data.section === 'foot') data.cell.styles.textColor = [255, 255, 255]; },
  });

  // ---------- Footer ----------
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Gross = net paid to worker + CIS remitted to HMRC. Figures include all timesheet statuses in the period.', margin, pageHeight - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`Job_Costs_${range.label.replace(/[^\w]+/g, '_')}.pdf`);
}
