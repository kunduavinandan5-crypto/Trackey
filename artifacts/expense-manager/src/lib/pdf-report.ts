import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfExpenseItem {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  notes?: string;
}

export interface GeneratePdfOptions {
  userName: string;
  userEmail: string;
  monthKey: string;
  monthLabel: string;
  salary: number;
  expenses: PdfExpenseItem[];
  categories: string[];
}

const formatCurrencyPdf = (amt: number) => {
  return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amt))}`;
};

const formatDatePdf = (dateStr: string) => {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return dateStr;
  }
};

export function exportMonthlyExpensePdf({
  userName,
  userEmail,
  monthLabel,
  salary,
  expenses,
  categories,
}: GeneratePdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = salary - totalSpent;
  const spentPct = salary > 0 ? Math.round((totalSpent / salary) * 100) : 0;
  const nowFormatted = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  // ── Header Banner ──
  doc.setFillColor(79, 70, 229); // Primary Indigo
  doc.rect(0, 0, pageWidth, 38, 'F');

  // App Logo / Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PAISA', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Personal Expense & Finance Statement', 14, 25);

  // Statement Month on Header Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(monthLabel.toUpperCase(), pageWidth - 14, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated on ${nowFormatted}`, pageWidth - 14, 25, { align: 'right' });

  // ── User Information Block ──
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ACCOUNT HOLDER:', 14, 48);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(userName || 'Avinandan Kundu', 14, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(userEmail || 'kunduavinandan5@gmail.com', 14, 60);

  // ── KPI Summary Cards Box ──
  const kpiBoxY = 66;
  const kpiBoxHeight = 22;
  const cardWidth = (pageWidth - 28 - 9) / 4;

  const kpis = [
    { label: 'MONTHLY SALARY', value: salary > 0 ? formatCurrencyPdf(salary) : 'Not Set', bg: [238, 242, 255], border: [199, 210, 254], text: [67, 56, 202] },
    { label: 'TOTAL EXPENSES', value: formatCurrencyPdf(totalSpent), bg: [254, 242, 242], border: [254, 202, 202], text: [185, 28, 28] },
    { label: balance < 0 ? 'OVER BUDGET' : 'REMAINING SAVINGS', value: formatCurrencyPdf(Math.abs(balance)), bg: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
    { label: 'BUDGET PACE', value: `${spentPct}% Spent`, bg: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.roundedRect(x, kpiBoxY, cardWidth, kpiBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, kpiBoxY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.value, x + 3, kpiBoxY + 15);
  });

  // ── Category Breakdown Table ──
  const categoryMap: Record<string, { total: number; count: number }> = {};
  expenses.forEach((e) => {
    if (!categoryMap[e.category]) categoryMap[e.category] = { total: 0, count: 0 };
    categoryMap[e.category].total += e.amount;
    categoryMap[e.category].count += 1;
  });

  const categoryRows = Object.entries(categoryMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, data]) => [
      cat,
      `${data.count} items`,
      totalSpent > 0 ? `${Math.round((data.total / totalSpent) * 100)}%` : '0%',
      formatCurrencyPdf(data.total),
    ]);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Category Summary Breakdown', 14, 98);

  autoTable(doc, {
    startY: 102,
    head: [['Category', 'Transactions', 'Share of Total', 'Amount Spent']],
    body: categoryRows.length ? categoryRows : [['No data recorded', '-', '-', 'Rs. 0']],
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Itemized Expenses Table ──
  const lastY = (doc as any).lastAutoTable?.finalY || 140;

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Complete Itemized Transaction Record', 14, lastY + 10);

  const sortedExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const expenseRows = sortedExpenses.map((e, index) => [
    `${index + 1}`,
    formatDatePdf(e.date),
    e.description || 'Expense',
    e.category,
    e.notes || '-',
    formatCurrencyPdf(e.amount),
  ]);

  autoTable(doc, {
    startY: lastY + 14,
    head: [['#', 'Date', 'Description', 'Category', 'Notes / Context', 'Amount']],
    body: expenseRows.length ? expenseRows : [['-', '-', 'No expense entries for this month', '-', '-', 'Rs. 0']],
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 24 },
      2: { fontStyle: 'bold', cellWidth: 'auto' },
      3: { cellWidth: 26 },
      4: { cellWidth: 40, fontStyle: 'italic', textColor: [100, 116, 139] },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    foot: [
      ['', '', 'TOTAL EXPENDITURE', `${expenses.length} Records`, '', formatCurrencyPdf(totalSpent)],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    margin: { left: 14, right: 14, bottom: 20 },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      doc.text(
        'Paisa — Personal Expense Manager · Encrypted & Private Financial Statement',
        14,
        pageHeight - 8,
      );

      const pageNumber = (doc as any).internal.getNumberOfPages();
      doc.text(`Page ${data.pageNumber} of ${pageNumber}`, pageWidth - 14, pageHeight - 8, {
        align: 'right',
      });
    },
  });

  // Save the PDF file
  const fileName = `Paisa-Expense-Report-${monthLabel.replace(/\s+/g, '-')}.pdf`;
  doc.save(fileName);
}
