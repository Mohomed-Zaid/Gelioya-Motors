import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ManualPnlReportRow, ManualProfitLoss } from '../types'
import { formatCurrency, formatDate } from './utils'

function rowProfit(sales: number, cost: number, expense: number): number {
  return (Number(sales) || 0) - (Number(cost) || 0) - (Number(expense) || 0)
}

function amountForPdf(n: number): string {
  return Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function periodLabel(dateFrom: string, dateTo: string, search: string): string {
  const parts: string[] = []
  if (dateFrom && dateTo) parts.push(`${formatDate(dateFrom)} – ${formatDate(dateTo)}`)
  else if (dateFrom) parts.push(`From ${formatDate(dateFrom)}`)
  else if (dateTo) parts.push(`Up to ${formatDate(dateTo)}`)
  else parts.push('All dates')
  if (search.trim()) parts.push(`Search: “${search.trim()}”`)
  return parts.join(' · ')
}

function pdfFilename(dateFrom: string, dateTo: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  if (dateFrom && dateTo) return `manual-pnl-${dateFrom}_to_${dateTo}.pdf`
  if (dateFrom) return `manual-pnl-from-${dateFrom}.pdf`
  if (dateTo) return `manual-pnl-to-${dateTo}.pdf`
  return `manual-pnl-${stamp}.pdf`
}

export type ManualProfitLossPdfOptions = {
  rows: ManualProfitLoss[] | ManualPnlReportRow[]
  totals: { sales: number; cost: number; expense: number; net: number }
  dateFrom: string
  dateTo: string
  search: string
  /** Override download filename (without path). */
  filename?: string
  /** Shown under the main title, e.g. archived report name. */
  subtitle?: string
}

export function reportRowsToPdfRows(rows: ManualPnlReportRow[]): ManualProfitLoss[] {
  return rows.map((r, i) => ({
    id: `archived-${i}`,
    entry_date: r.entry_date,
    description: r.description,
    sales_amount: r.sales_amount,
    cost_amount: r.cost_amount,
    expense_amount: r.expense_amount,
    profit_amount: r.profit_amount,
    notes: r.notes,
    created_at: r.entry_date,
  }))
}

export function downloadManualProfitLossPdf(options: ManualProfitLossPdfOptions): void {
  const { rows, totals, dateFrom, dateTo, search, filename, subtitle } = options
  const pdfRows: ManualProfitLoss[] =
    rows.length > 0 && !('created_at' in rows[0])
      ? reportRowsToPdfRows(rows as ManualPnlReportRow[])
      : (rows as ManualProfitLoss[])

  const sorted = [...pdfRows].sort((a, b) => {
    const d = a.entry_date.localeCompare(b.entry_date)
    if (d !== 0) return d
    return a.created_at.localeCompare(b.created_at)
  })

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Gelioya Motors', 14, 16)

  doc.setFontSize(12)
  doc.text(subtitle ? `Manual P&L — ${subtitle}` : 'Manual Profit & Loss', 14, 24)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(periodLabel(dateFrom, dateTo, search), 14, 30)
  doc.text(`Generated ${formatDate(new Date().toISOString())}`, 14, 35)
  doc.setTextColor(0, 0, 0)

  const body = sorted.map((r, i) => {
    const p = rowProfit(r.sales_amount, r.cost_amount, r.expense_amount)
    return [
      String(i + 1),
      formatDate(r.entry_date),
      r.description || '—',
      amountForPdf(r.sales_amount),
      amountForPdf(r.cost_amount),
      amountForPdf(r.expense_amount),
      amountForPdf(p),
      r.notes || '—',
    ]
  })

  autoTable(doc, {
    startY: 40,
    head: [['#', 'Date', 'Description', 'Sales', 'Cost', 'Expense', 'Profit', 'Notes']],
    body,
    foot: [
      [
        '',
        '',
        'TOTALS',
        amountForPdf(totals.sales),
        amountForPdf(totals.cost),
        amountForPdf(totals.expense),
        amountForPdf(totals.net),
        '',
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 52 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 26 },
      7: { cellWidth: 40 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(
        'Manual notebook only — not linked to sales, cash, or expenses.',
        14,
        doc.internal.pageSize.getHeight() - 8
      )
    },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40
  if (finalY < doc.internal.pageSize.getHeight() - 20) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(`Net profit: ${formatCurrency(totals.net)}`, pageW - 14, finalY + 8, { align: 'right' })
  }

  doc.save(filename ?? pdfFilename(dateFrom, dateTo))
}
