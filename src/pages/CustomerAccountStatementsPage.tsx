import { useState, useEffect } from 'react'
import { Users, Search, FileText, Download, Phone, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { Modal } from '../components/Modal'
import { getPartyDetails, getCustomerLedgerTransactions } from '../services/businessService'
import type { PartyDetail } from '../services/businessService'
import type { CustomerLedgerTransaction, CustomerLedgerSummary, CustomerLedgerTransactionType } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TRANSACTION_TYPES: { value: CustomerLedgerTransactionType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'sale', label: 'Sale' },
  { value: 'payment', label: 'Payment' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'return', label: 'Return' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'offset', label: 'Offset' },
]

export function CustomerAccountStatementsPage() {
  const [parties, setParties] = useState<PartyDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedParty, setSelectedParty] = useState<PartyDetail | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [transactions, setTransactions] = useState<CustomerLedgerTransaction[]>([])
  const [summary, setSummary] = useState<CustomerLedgerSummary | null>(null)
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<CustomerLedgerTransactionType | ''>('')

  useEffect(() => {
    loadParties()
  }, [])

  const loadParties = async () => {
    try {
      const data = await getPartyDetails()
      setParties(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerTransactions = async (party: PartyDetail) => {
    setSelectedParty(party)
    setShowModal(true)
    setLoadingLedger(true)
    try {
      const result = await getCustomerLedgerTransactions(
        party.id,
        dateFrom || undefined,
        dateTo || undefined,
        typeFilter || undefined
      )
      setTransactions(result.transactions)
      setSummary(result.summary)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingLedger(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!selectedParty || !summary) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Gelioya Motors', 14, 16)

    doc.setFontSize(14)
    doc.text('Customer Account Statement', 14, 24)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Customer: ${selectedParty.name}`, 14, 32)
    if (selectedParty.phone) doc.text(`Phone: ${selectedParty.phone}`, 14, 38)
    if (selectedParty.address) doc.text(`Address: ${selectedParty.address}`, 14, 44)

    const dateRangeText = dateFrom || dateTo
      ? `${dateFrom ? `From: ${formatDate(dateFrom)}` : ''} ${dateTo ? `To: ${formatDate(dateTo)}` : ''}`
      : 'All Dates'
    doc.text(dateRangeText, 14, 50)
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 56)
    doc.setTextColor(0, 0, 0)

    // Calculate running balance for PDF
    let runningBalance = 0
    const tableData = transactions.map((t) => {
      runningBalance += t.debit - t.credit
      return [
        formatDate(t.date),
        t.type.charAt(0).toUpperCase() + t.type.slice(1),
        t.description,
        t.debit > 0 ? Number(t.debit).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        t.credit > 0 ? Number(t.credit).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        Number(runningBalance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]
    })

    autoTable(doc, {
      startY: 62,
      head: [['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      foot: [
        [
          '',
          '',
          'Totals',
          Number(summary.totalCreditSales).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(summary.totalPaymentsReceived + summary.totalOffsets).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(summary.netBalance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 20 },
        2: { cellWidth: 68 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 24 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 62
    if (finalY < doc.internal.pageSize.getHeight() - 30) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 14, finalY + 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Total Credit Sales: ${formatCurrency(summary.totalCreditSales)}`, 14, finalY + 16)
      doc.text(`Total Payments Received: ${formatCurrency(summary.totalPaymentsReceived)}`, 14, finalY + 21)
      doc.text(`Total Offsets: ${formatCurrency(summary.totalOffsets)}`, 14, finalY + 26)
      doc.text(`Net Balance: ${formatCurrency(summary.netBalance)}`, 14, finalY + 31)
    }

    doc.save(`customer-statement-${selectedParty.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const filteredParties = parties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.toLowerCase().includes(search.toLowerCase()))
  )

  let runningBalance = 0
  const transactionsWithBalance = transactions.map((t) => {
    runningBalance += t.debit - t.credit
    return { ...t, runningBalance }
  })

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Customer Account Statements</h1>
          <p className="text-sm text-slate-300 mt-0.5">View and download customer financial statements</p>
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search customers by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Credit Sales</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Payments</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Offsets</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Outstanding</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filteredParties.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No customers found</td></tr>
                ) : (
                  filteredParties.map((party) => (
                    <tr key={party.id} className="hover:bg-emerald-950/25 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-900/40 flex items-center justify-center text-sm font-bold text-emerald-300">
                            {party.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-100">{party.name}</div>
                            {party.phone && (
                              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                <Phone size={10} />
                                {party.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-amber-300 font-medium">{formatCurrency(party.total_credit_sales)}</td>
                      <td className="px-5 py-3.5 text-right text-emerald-300 font-medium">{formatCurrency(party.total_payments_received)}</td>
                      <td className="px-5 py-3.5 text-right text-blue-300 font-medium">{formatCurrency(party.total_offsets)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${party.outstanding > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                          {formatCurrency(party.outstanding)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => loadCustomerTransactions(party)}
                          className="inline-flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                        >
                          <FileText size={16} />
                          View Statement
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredParties.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filteredParties.length} customer{filteredParties.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={selectedParty ? `${selectedParty.name} - Account Statement` : 'Account Statement'} wide={true}>
        {selectedParty && summary && (
          <div className="space-y-6">
            <div className="surface rounded-xl p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-100">{selectedParty.name}</h3>
                  {selectedParty.phone && (
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                      <Phone size={14} />
                      {selectedParty.phone}
                    </div>
                  )}
                  {selectedParty.address && (
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                      <MapPin size={14} />
                      {selectedParty.address}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-5 py-2.5 gradient-primary text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {loadingLedger ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="surface rounded-xl p-5">
                    <div className="h-4 w-28 bg-emerald-950/30 rounded animate-pulse mb-3" />
                    <div className="h-6 w-24 bg-emerald-950/30 rounded animate-pulse" />
                  </div>
                ))
              ) : (
                <>
                  <SummaryCard
                    title="Total Credit Sales"
                    value={formatCurrency(summary.totalCreditSales)}
                    icon={<FileText size={20} />}
                    color="blue"
                  />
                  <SummaryCard
                    title="Total Payments"
                    value={formatCurrency(summary.totalPaymentsReceived)}
                    icon={<FileText size={20} />}
                    color="green"
                  />
                  <SummaryCard
                    title="Total Purchases"
                    value={formatCurrency(summary.totalPurchases)}
                    icon={<FileText size={20} />}
                    color="amber"
                  />
                  <SummaryCard
                    title="Total Offsets"
                    value={formatCurrency(summary.totalOffsets)}
                    icon={<FileText size={20} />}
                    color="purple"
                  />
                  <SummaryCard
                    title="Net Balance"
                    value={formatCurrency(summary.netBalance)}
                    icon={<Users size={20} />}
                    color={summary.netBalance > 0 ? 'red' : 'green'}
                  />
                </>
              )}
            </div>

            <div className="surface rounded-xl p-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="From Date"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="To Date"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as CustomerLedgerTransactionType | '')}
                    className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {TRANSACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => loadCustomerTransactions(selectedParty)}
                  disabled={loadingLedger}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {loadingLedger ? 'Loading...' : 'Apply Filters'}
                </button>
              </div>
            </div>

            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                      <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Date</th>
                      <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Type</th>
                      <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Description</th>
                      <th className="text-right px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Debit</th>
                      <th className="text-right px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Credit</th>
                      <th className="text-right px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-900/20">
                    {loadingLedger ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-5 py-4">
                            <div className="h-4 w-24 bg-emerald-950/30 rounded animate-pulse" />
                          </td>
                          <td className="px-5 py-4">
                            <div className="h-4 w-16 bg-emerald-950/30 rounded animate-pulse" />
                          </td>
                          <td className="px-5 py-4">
                            <div className="h-4 w-48 bg-emerald-950/30 rounded animate-pulse" />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="h-4 w-20 bg-emerald-950/30 rounded animate-pulse ml-auto" />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="h-4 w-20 bg-emerald-950/30 rounded animate-pulse ml-auto" />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="h-4 w-24 bg-emerald-950/30 rounded animate-pulse ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : transactionsWithBalance.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No transactions found for this period</td></tr>
                    ) : (
                      transactionsWithBalance.map((t) => (
                        <tr key={t.id} className="hover:bg-emerald-950/25 transition-colors">
                          <td className="px-5 py-4 text-slate-300 whitespace-nowrap">{formatDate(t.date)}</td>
                          <td className="px-5 py-4 text-slate-200 font-medium whitespace-nowrap">
                            {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                          </td>
                          <td className="px-5 py-4 text-slate-300">{t.description}</td>
                          <td className="px-5 py-4 text-right text-amber-300 font-medium whitespace-nowrap">
                            {t.debit > 0 ? formatCurrency(t.debit) : ''}
                          </td>
                          <td className="px-5 py-4 text-right text-emerald-300 font-medium whitespace-nowrap">
                            {t.credit > 0 ? formatCurrency(t.credit) : ''}
                          </td>
                          <td className="px-5 py-4 text-right font-bold whitespace-nowrap">
                            <span className={t.runningBalance > 0 ? 'text-red-300' : 'text-emerald-300'}>
                              {formatCurrency(t.runningBalance)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
