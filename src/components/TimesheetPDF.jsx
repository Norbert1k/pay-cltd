import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, formatDateTime, formatCurrency, DAY_LABELS, generateRef } from '../lib/utils';

export function generateTimesheetPDF(timesheet, profile, site, days) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFillColor(68, 138, 64);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('CITY CONSTRUCTION', margin, 22);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('SUBCONTRACTOR TIMESHEET', margin, 32);

  const ref = generateRef(timesheet.week_ending);
  doc.setFontSize(10);
  doc.text(`Ref: ${ref}`, pageWidth - margin, 22, { align: 'right' });
  doc.text(`Week Ending: ${formatDate(timesheet.week_ending)}`, pageWidth - margin, 32, { align: 'right' });

  // Worker details section
  y = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Worker Details', margin, y);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const details = [
    ['Name', profile.full_name],
    ['UTR', profile.utr_number || 'N/A'],
    ['National Insurance', profile.national_insurance || 'N/A'],
    ['Account Number', profile.account_number || 'N/A'],
    ['Sort Code', profile.sort_code || 'N/A'],
    ['Phone', profile.phone || 'N/A'],
    ['Email', profile.email],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 45, y);
    y += 6;
  });

  // Project details
  y += 5;
  doc.setDrawColor(68, 138, 64);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Project Details', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const projectDetails = [
    ['Site', site?.site_name || 'N/A'],
    ['Address', [site?.site_address, site?.city, site?.postcode].filter(Boolean).join(', ') || 'N/A'],
    ['Approving Manager', timesheet.approving_manager || 'N/A'],
    ['Payment Method', timesheet.payment_method === 'card' ? 'PAY BY CARD' : 'PAY BY OTHER'],
  ];

  projectDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 45, y);
    y += 6;
  });

  // Daily breakdown table
  y += 8;
  doc.setDrawColor(68, 138, 64);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  const tableData = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
    const d = days.find(dd => dd.day_of_week === day);
    if (d && (parseFloat(d.gross_amount) > 0 || d.start_time)) {
      return [
        DAY_LABELS[day],
        d.start_time || '-',
        d.end_time || '-',
        d.work_type ? d.work_type.charAt(0).toUpperCase() + d.work_type.slice(1) : '-',
        formatCurrency(d.gross_amount),
        formatCurrency(d.deductions),
        formatCurrency(d.net_amount),
      ];
    }
    return [DAY_LABELS[day], '-', '-', '-', '-', '-', '-'];
  });

  doc.autoTable({
    startY: y,
    head: [['Day', 'Start', 'End', 'Type', 'Gross', 'Deductions', 'Net']],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [68, 138, 64],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 248, 245],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  // CIS Deduction (if applicable)
  y = doc.lastAutoTable.finalY + 5;

  if (timesheet.cis_rate && timesheet.cis_rate > 0) {
    // Calculate gross from days
    const grossTotal = (days || []).reduce((sum, d) => sum + parseFloat(d.gross_amount || 0), 0);
    const cisAmount = grossTotal * timesheet.cis_rate / 100;

    doc.setFillColor(254, 243, 199);
    doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`CIS DEDUCTION (${timesheet.cis_rate}%):`, margin + 5, y + 7);
    doc.text(`-${formatCurrency(cisAmount)}`, pageWidth - margin - 5, y + 7, { align: 'right' });
    y += 12;
  }

  // Total
  doc.setFillColor(68, 138, 64);
  doc.rect(margin, y, pageWidth - margin * 2, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL NET:', margin + 5, y + 8);
  doc.text(formatCurrency(timesheet.total_amount), pageWidth - margin - 5, y + 8, { align: 'right' });

  // Footer
  y += 22;
  doc.setTextColor(128, 128, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Submitted: ${formatDateTime(timesheet.submitted_at)}`, margin, y);
  doc.text(`Status: ${timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}`, margin, y + 5);

  y += 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setTextColor(128, 128, 128);
  doc.setFontSize(8);
  doc.text('City Construction Ltd', pageWidth / 2, y, { align: 'center' });
  doc.text('pay.cltd.co.uk', pageWidth / 2, y + 4, { align: 'center' });

  // Save
  const fileName = `Timesheet_${profile.full_name.replace(/\s+/g, '_')}_WE_${timesheet.week_ending}.pdf`;
  doc.save(fileName);
}
