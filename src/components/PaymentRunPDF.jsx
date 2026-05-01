import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, formatDateCompact, formatCurrency } from '../lib/utils';

/**
 * Generate a Payment Run Report PDF for a given payment period.
 *
 * @param {Array} timesheets - All timesheets falling within the period
 * @param {Array} weekEndings - The Sunday dates covered by this payment run (1 or 2)
 * @param {Object} payment   - The payment_dates row { payment_date, cutoff_date, label }
 * @param {Object} generatedBy - { full_name }
 */
export function generatePaymentRunPDF(timesheets, weekEndings, payment, generatedBy) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // ============================================================
  // HEADER
  // ============================================================
  // Top accent line in CLTD green
  doc.setDrawColor(68, 138, 64);
  doc.setLineWidth(0.8);
  doc.line(margin, y + 24, pageWidth - margin, y + 24);

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CITY CONSTRUCTION GROUP LTD', margin, y + 4);

  doc.setTextColor(34, 34, 34);
  doc.setFontSize(16);
  doc.text('Payment Run Report', margin, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  doc.text(
    `Run: ${formatDate(payment.payment_date)}    Cutoff: ${formatDate(payment.cutoff_date)}`,
    margin, y + 20
  );

  // Right side: generated metadata
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(`Generated ${today}`, pageWidth - margin, y + 8, { align: 'right' });
  if (generatedBy?.full_name) {
    doc.text(`by ${generatedBy.full_name}`, pageWidth - margin, y + 13, { align: 'right' });
  }

  y += 32;

  // ============================================================
  // COMPUTE TOTALS
  // ============================================================
  const totals = timesheets.reduce((acc, ts) => {
    const method = ts.payment_method === 'card' ? 'bank' : 'other';
    const bucket = ts.status === 'paid' ? 'paid' : 'outstanding';
    const amt = Number(ts.total_amount) || 0;
    acc.grand.sum += amt; acc.grand.count += 1;
    acc[bucket].sum += amt; acc[bucket].count += 1;
    acc[method].sum += amt; acc[method].count += 1;
    acc[method][bucket].sum += amt; acc[method][bucket].count += 1;
    return acc;
  }, {
    grand: { sum: 0, count: 0 },
    paid: { sum: 0, count: 0 },
    outstanding: { sum: 0, count: 0 },
    bank:  { sum: 0, count: 0, paid: { sum: 0, count: 0 }, outstanding: { sum: 0, count: 0 } },
    other: { sum: 0, count: 0, paid: { sum: 0, count: 0 }, outstanding: { sum: 0, count: 0 } },
  });

  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

  // ============================================================
  // 3 SUMMARY TILES (Period Total / Paid / Outstanding)
  // ============================================================
  const tileGap = 3;
  const tileW = (pageWidth - margin * 2 - tileGap * 2) / 3;
  const tileH = 18;

  const drawTile = (x, fillR, fillG, fillB, labelColor, label, amount, sub) => {
    doc.setFillColor(fillR, fillG, fillB);
    doc.roundedRect(x, y, tileW, tileH, 1.5, 1.5, 'F');
    doc.setTextColor(...labelColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 3, y + 4.5);
    doc.setFontSize(13);
    doc.text(amount, x + 3, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(sub, x + 3, y + 16);
  };

  drawTile(margin, 245, 245, 245, [80, 80, 80],
    'Period total', formatCurrency(totals.grand.sum),
    `${totals.grand.count} timesheets`);

  drawTile(margin + tileW + tileGap, 232, 245, 232, [45, 99, 41],
    'Paid', formatCurrency(totals.paid.sum),
    `${totals.paid.count} timesheets · ${pct(totals.paid.sum, totals.grand.sum)}%`);

  drawTile(margin + (tileW + tileGap) * 2, 251, 244, 230, [138, 88, 16],
    'Outstanding', formatCurrency(totals.outstanding.sum),
    `${totals.outstanding.count} timesheets · ${pct(totals.outstanding.sum, totals.grand.sum)}%`);

  y += tileH + 3;

  // ============================================================
  // 2 PAYMENT-METHOD TILES (Bank Transfer / Other)
  // ============================================================
  const mtileW = (pageWidth - margin * 2 - tileGap) / 2;
  const mtileH = 16;

  const drawMethodTile = (x, borderRgb, labelRgb, label, total, count, paidSum, outstandingSum) => {
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.4);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, mtileW, mtileH, 1.5, 1.5, 'FD');

    doc.setTextColor(...labelRgb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 3, y + 4.5);

    doc.setTextColor(34, 34, 34);
    doc.setFontSize(11);
    doc.text(formatCurrency(total), x + 3, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`${count} ts`, x + mtileW - 3, y + 10, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(45, 99, 41);
    doc.text(`${formatCurrency(paidSum)} paid`, x + 3, y + 14);
    doc.setTextColor(138, 88, 16);
    doc.text(`${formatCurrency(outstandingSum)} outstanding`, x + mtileW - 3, y + 14, { align: 'right' });
  };

  drawMethodTile(margin, [68, 138, 64], [45, 99, 41],
    'Bank Transfer', totals.bank.sum, totals.bank.count,
    totals.bank.paid.sum, totals.bank.outstanding.sum);

  drawMethodTile(margin + mtileW + tileGap, [83, 74, 183], [58, 51, 128],
    'Other', totals.other.sum, totals.other.count,
    totals.other.paid.sum, totals.other.outstanding.sum);

  y += mtileH + 6;

  // ============================================================
  // GROUP TIMESHEETS BY WORKER
  // ============================================================
  // weekEndings is sorted oldest first
  const sortedWeeks = [...weekEndings].sort();

  const byWorker = {};
  timesheets.forEach(ts => {
    const wid = ts.worker_id;
    if (!byWorker[wid]) {
      byWorker[wid] = {
        workerId: wid,
        full_name: ts.profiles?.full_name || 'Unknown',
        site_name: ts.sites?.site_name || '-',
        method: ts.payment_method,
        weeks: {},
      };
    }
    byWorker[wid].weeks[ts.week_ending] = ts;
  });

  // Sort workers alphabetically
  const workerRows = Object.values(byWorker)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Per-week subtotals
  const weekTotals = {};
  sortedWeeks.forEach(w => { weekTotals[w] = { sum: 0, count: 0 }; });
  timesheets.forEach(ts => {
    if (weekTotals[ts.week_ending]) {
      weekTotals[ts.week_ending].sum += Number(ts.total_amount) || 0;
      weekTotals[ts.week_ending].count += 1;
    }
  });

  // ============================================================
  // BUILD TABLE BODY
  // ============================================================
  const body = workerRows.map(w => {
    const weekCells = sortedWeeks.map(week => {
      const ts = w.weeks[week];
      return ts ? formatCurrency(Number(ts.total_amount) || 0) : '—';
    }).join(' / ');

    const total = sortedWeeks.reduce((sum, week) => {
      const ts = w.weeks[week];
      return sum + (ts ? Number(ts.total_amount) || 0 : 0);
    }, 0);

    return {
      worker: w.full_name,
      site: w.site_name,
      method: w.method === 'card' ? 'Bank' : 'Other',
      methodColor: w.method === 'card' ? [68, 138, 64] : [83, 74, 183],
      weeks: weekCells,
      total: formatCurrency(total),
      // Sign-off column rendered manually by didDrawCell
      signoff: sortedWeeks.map(week => w.weeks[week] ? 'box' : 'dash').join('|'),
    };
  });

  // Column headers
  const weekHeader = sortedWeeks.length === 2
    ? `Wk ${formatDateCompact(sortedWeeks[0])} / Wk ${formatDateCompact(sortedWeeks[1])}`
    : `Wk ${formatDateCompact(sortedWeeks[0])}`;

  // ============================================================
  // RENDER TABLE WITH AUTOTABLE
  // ============================================================
  doc.autoTable({
    startY: y,
    head: [['Worker', 'Site', 'Method', weekHeader, 'Total', 'Sign-off']],
    body: body.map(r => [r.worker, r.site, r.method, r.weeks, r.total, r.signoff]),
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [60, 60, 60],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: { bottom: 0.4 },
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [240, 240, 240],
      lineWidth: { bottom: 0.2 },
      textColor: [34, 34, 34],
    },
    columnStyles: {
      0: { cellWidth: 38 },                // Worker
      1: { cellWidth: 36 },                // Site
      2: { cellWidth: 14, halign: 'center' }, // Method
      3: { cellWidth: 38, halign: 'center' }, // Weeks (£X / £Y)
      4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }, // Total
      5: { cellWidth: 'auto', halign: 'center' }, // Sign-off
    },
    didParseCell: (data) => {
      // Method cell: render coloured pill background
      if (data.section === 'body' && data.column.index === 2) {
        const r = body[data.row.index];
        data.cell.styles.fillColor = r.methodColor;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
      }
    },
    didDrawCell: (data) => {
      // Sign-off column: replace text with hand-drawable boxes
      if (data.section === 'body' && data.column.index === 5) {
        const txt = data.cell.text[0] || '';
        const types = txt.split('|');
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        const boxSize = 3.5;
        const gap = 1.5;
        const totalWidth = types.length * boxSize + (types.length - 1) * gap;
        let bx = cx - totalWidth / 2;

        // Clear the text first
        doc.setFillColor(255, 255, 255);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');

        // Draw row separator we just wiped
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height,
                 data.cell.x + data.cell.width, data.cell.y + data.cell.height);

        types.forEach(t => {
          if (t === 'box') {
            doc.setDrawColor(60, 60, 60);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([], 0);
            doc.rect(bx, cy - boxSize / 2, boxSize, boxSize);
          } else {
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([0.5, 0.5], 0);
            doc.rect(bx, cy - boxSize / 2, boxSize, boxSize);
            doc.setLineDashPattern([], 0);
          }
          bx += boxSize + gap;
        });
      }
    },
  });

  // ============================================================
  // SUBTOTALS + GRAND TOTAL (after the table)
  // ============================================================
  let yEnd = doc.lastAutoTable.finalY;

  const ensureRoom = (needed) => {
    if (yEnd + needed > pageHeight - 18) {
      doc.addPage();
      yEnd = margin;
    }
  };

  // Per-week subtotals (amber)
  sortedWeeks.forEach(week => {
    ensureRoom(8);
    doc.setFillColor(255, 251, 232);
    doc.setDrawColor(186, 117, 23);
    doc.setLineWidth(0.4);
    doc.rect(margin, yEnd, pageWidth - margin * 2, 7, 'FD');
    doc.setTextColor(138, 88, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`Subtotal · Week Ending ${formatDate(week)}`, margin + 3, yEnd + 4.6);
    doc.text(formatCurrency(weekTotals[week].sum), pageWidth - margin - 24, yEnd + 4.6, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${weekTotals[week].count} ts`, pageWidth - margin - 3, yEnd + 4.6, { align: 'right' });
    yEnd += 7;
  });

  // Grand total (green band)
  ensureRoom(10);
  yEnd += 1;
  doc.setFillColor(45, 99, 41);
  doc.rect(margin, yEnd, pageWidth - margin * 2, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`GRAND TOTAL — Payment Run ${formatDate(payment.payment_date)}`, margin + 3, yEnd + 5.7);
  doc.setFontSize(11);
  doc.text(formatCurrency(totals.grand.sum), pageWidth - margin - 24, yEnd + 5.7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${totals.grand.count} ts`, pageWidth - margin - 3, yEnd + 5.7, { align: 'right' });
  yEnd += 9;

  // ============================================================
  // FOOTER LEGEND ON EVERY PAGE
  // ============================================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      'Tick boxes by hand when paid. Solid box = week submitted, dashed = no timesheet that week.',
      margin, pageHeight - 8
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // ============================================================
  // SAVE
  // ============================================================
  const fileName = `Payment_Run_${payment.payment_date}.pdf`;
  doc.save(fileName);
}
