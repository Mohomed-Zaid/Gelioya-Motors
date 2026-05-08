import { useState, useEffect } from 'react'
import { HandCoins, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Users, FileText } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { Modal } from '../components/Modal'
import { SummaryCard } from '../components/SummaryCard'
import { getReceivables, collectReceivablePayment, deleteReceivablePayment, updateSale, deleteSale, getPartyOffsets } from '../services/businessService'
import type { ReceivableWithSale, PaymentType } from '../types'
import type { PartyOffsetWithPurchase } from '../services/businessService'
import { formatCurrency, formatDate, parseCurrencyInput } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'

type CustomerGroup = {
  customerName: string
  receivables: ReceivableWithSale[]
  totalSales: number
  totalPaid: number
  totalOffset: number
  totalOutstanding: number
  totalOverpaid: number
  invoiceCount: number
  pendingCount: number
}

export function ReceivablesPage() {
  const [receivables, setReceivables] = useState<ReceivableWithSale[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableWithSale | null>(null)
  const [showDeletePaymentConfirm, setShowDeletePaymentConfirm] = useState<string | null>(null)
  const [showDeleteSaleConfirm, setShowDeleteSaleConfirm] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editReceivable, setEditReceivable] = useState<ReceivableWithSale | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editTotalSales, setEditTotalSales] = useState('')
  const [editTotalCost, setEditTotalCost] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'invoice' | 'customer'>('customer')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  // Pay-all for customer
  const [showPayAllModal, setShowPayAllModal] = useState(false)
  const [payAllCustomer, setPayAllCustomer] = useState<CustomerGroup | null>(null)
  const [payAllAmount, setPayAllAmount] = useState('')
  const [payAllNotes, setPayAllNotes] = useState('')
  const [payAllDate, setPayAllDate] = useState('')
  const [payAllMethod, setPayAllMethod] = useState<'cash' | 'cheque' | 'bank' | 'other'>('cash')
  const [payAllChequeDate, setPayAllChequeDate] = useState('')
  const [payAllChequeNumber, setPayAllChequeNumber] = useState('')
  const [payAllError, setPayAllError] = useState('')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque' | 'bank' | 'other'>('cash')
  const [chequeDate, setChequeDate] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [expandedReceivable, setExpandedReceivable] = useState<string | null>(null)
  const [offsetDetails, setOffsetDetails] = useState<Record<string, PartyOffsetWithPurchase[]>>({})

  const loadReceivables = async () => {
    try {
      const data = await getReceivables()
      setReceivables(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReceivables()
  }, [])

  const handleCollect = (recv: ReceivableWithSale) => {
    setSelectedReceivable(recv)
    setPaymentAmount('')
    setPaymentNotes('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod('cash')
    setChequeDate('')
    setChequeNumber('')
    setError('')
    setShowPaymentModal(true)
  }

  const openEditSale = (recv: ReceivableWithSale) => {
    setEditReceivable(recv)
    setEditCustomerName(recv.customer_name)
    setEditTotalSales(String(recv.total_sales))
    setEditTotalCost(String(recv.total_cost))
    setEditNotes(recv.notes || '')
    setEditError('')
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editReceivable) return
    setEditError('')
    const totalSales = parseFloat(editTotalSales)
    const totalCost = parseFloat(editTotalCost)
    if (!editCustomerName.trim()) { setEditError('Customer name is required.'); return }
    if (isNaN(totalSales) || totalSales <= 0) { setEditError('Total sales must be greater than zero.'); return }
    if (isNaN(totalCost) || totalCost < 0) { setEditError('Total cost cannot be negative.'); return }
    const totalProfit = totalSales - totalCost
    // Build items from existing sale_items or a single default item
    const items = editReceivable.sale_items && editReceivable.sale_items.length > 0
      ? editReceivable.sale_items.map((si) => ({ item_name: si.item_name, quantity: si.quantity || 1, cost_price: si.cost_price, selling_price: si.selling_price, profit: si.profit }))
      : [{ item_name: editCustomerName.trim(), quantity: 1, cost_price: totalCost, selling_price: totalSales, profit: totalProfit }]
    try {
      await updateSale(editReceivable.id, {
        customer_name: editCustomerName,
        invoice_date: editReceivable.invoice_date || editReceivable.created_at.split('T')[0],
        total_cost: totalCost,
        total_sales: totalSales,
        total_profit: totalProfit,
        payment_type: 'credit' as PaymentType,
        notes: editNotes || undefined,
        items,
      })
      setShowEditModal(false)
      loadReceivables()
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update.')
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReceivable) return
    setError('')

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) { setError('Valid amount greater than zero is required.'); return }
    // Allow overpayment — excess will be tracked as overpaid

    setSubmitting(true)
    try {
      await collectReceivablePayment({
        sale_id: selectedReceivable.id,
        customer_name: selectedReceivable.customer_name,
        payment_date: paymentDate,
        method: paymentMethod,
        cheque_date: paymentMethod === 'cheque' ? chequeDate || undefined : undefined,
        cheque_number: paymentMethod === 'cheque' ? chequeNumber || undefined : undefined,
        amount,
        notes: paymentNotes || undefined,
      })
      setShowPaymentModal(false)
      loadReceivables()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = receivables.filter(
    (r) => r.customer_name.toLowerCase().includes(search.toLowerCase()) || r.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  const totalOutstanding = filtered.reduce((sum, r) => sum + Math.max(0, r.outstanding - (r.offset_total || 0)), 0)
  const totalPaid = filtered.reduce((sum, r) => sum + r.total_paid, 0)
  const totalOffsets = filtered.reduce((sum, r) => sum + (r.offset_total || 0), 0)
  const totalReceivable = filtered.reduce((sum, r) => sum + Number(r.total_sales), 0)
  const totalOverpaid = filtered.reduce((sum, r) => sum + (r.overpaid || 0), 0)

  // Group receivables by customer
  const customerGroups: CustomerGroup[] = (() => {
    const map: Record<string, CustomerGroup> = {}
    for (const r of filtered) {
      const key = r.customer_name
      if (!map[key]) {
        map[key] = { customerName: key, receivables: [], totalSales: 0, totalPaid: 0, totalOffset: 0, totalOutstanding: 0, totalOverpaid: 0, invoiceCount: 0, pendingCount: 0 }
      }
      const outstanding = Math.max(0, r.outstanding - (r.offset_total || 0))
      map[key].receivables.push(r)
      map[key].totalSales += Number(r.total_sales)
      map[key].totalPaid += r.total_paid
      map[key].totalOffset += (r.offset_total || 0)
      map[key].totalOutstanding += outstanding
      map[key].totalOverpaid += (r.overpaid || 0)
      map[key].invoiceCount++
      if (outstanding > 0) map[key].pendingCount++
    }
    return Object.values(map).sort((a, b) => b.totalOutstanding - a.totalOutstanding)
  })()

  const handleOpenPayAll = (group: CustomerGroup) => {
    setPayAllCustomer(group)
    setPayAllAmount(String(group.totalOutstanding))
    setPayAllNotes('')
    setPayAllDate(new Date().toISOString().slice(0, 10))
    setPayAllMethod('cash')
    setPayAllChequeDate('')
    setPayAllChequeNumber('')
    setPayAllError('')
    setShowPayAllModal(true)
  }

  const handlePayAllSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payAllCustomer) return
    setPayAllError('')

    const totalAmount = parseFloat(payAllAmount)
    if (isNaN(totalAmount) || totalAmount <= 0) { setPayAllError('Valid amount greater than zero is required.'); return }
    // Allow overpayment — excess will be tracked as overpaid

    setSubmitting(true)
    try {
      // Distribute payment across invoices (oldest first)
      let remaining = totalAmount
      const sorted = [...payAllCustomer.receivables]
        .filter(r => Math.max(0, r.outstanding - (r.offset_total || 0)) > 0)
        .sort((a, b) => new Date(a.invoice_date || a.created_at).getTime() - new Date(b.invoice_date || b.created_at).getTime())

      for (const r of sorted) {
        if (remaining <= 0) break
        const outstanding = Math.max(0, r.outstanding - (r.offset_total || 0))
        const payForThis = Math.min(remaining, outstanding)
        if (payForThis > 0) {
          await collectReceivablePayment({
            sale_id: r.id,
            customer_name: r.customer_name,
            payment_date: payAllDate,
            method: payAllMethod,
            cheque_date: payAllMethod === 'cheque' ? payAllChequeDate || undefined : undefined,
            cheque_number: payAllMethod === 'cheque' ? payAllChequeNumber || undefined : undefined,
            amount: payForThis,
            notes: payAllNotes || undefined,
          })
          remaining -= payForThis
        }
      }
      setShowPayAllModal(false)
      loadReceivables()
    } catch (err: unknown) {
      setPayAllError(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Receivables</h1>
          <p className="text-sm text-slate-300 mt-0.5">Track credit sales and collect payments</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <SummaryCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={<HandCoins size={20} />} color="red" />
          <SummaryCard title="Total Collected" value={formatCurrency(totalPaid)} icon={<span className="text-xs font-bold">PAY</span>} color="green" />
          <SummaryCard title="Total Offsets" value={formatCurrency(totalOffsets)} icon={<HandCoins size={20} />} color="blue" />
          <SummaryCard title="Total Credit Sales" value={formatCurrency(totalReceivable)} icon={<HandCoins size={20} />} color="amber" />
          <SummaryCard title="Total Overpaid" value={formatCurrency(totalOverpaid)} icon={<span className="text-xs font-bold">OVER</span>} color="purple" />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer or invoice..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1 surface rounded-xl p-1">
              <button
                onClick={() => setViewMode('customer')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'customer' ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-900/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Users size={14} /> By Customer
              </button>
              <button
                onClick={() => setViewMode('invoice')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'invoice' ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-900/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <FileText size={14} /> By Invoice
              </button>
            </div>
          </div>
        </div>

        {/* By Invoice View */}
        {viewMode === 'invoice' && (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Invoice</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Paid</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Offset</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Outstanding</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Overpaid</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">No credit sales found</td></tr>
                ) : (
                  filtered.map((r) => {
                    const adjustedOutstanding = Math.max(0, r.outstanding - (r.offset_total || 0))
                    const hasOffsets = (r.offset_total || 0) > 0 && r.party_id
                    const isExpanded = expandedReceivable === r.id
                    const handleToggleOffsets = async () => {
                      if (isExpanded) {
                        setExpandedReceivable(null)
                        return
                      }
                      setExpandedReceivable(r.id)
                      if (r.party_id && !offsetDetails[r.party_id]) {
                        try {
                          const details = await getPartyOffsets(r.party_id)
                          setOffsetDetails((prev) => ({ ...prev, [r.party_id!]: details }))
                        } catch { /* ignore */ }
                      }
                    }
                    return (
                      <>
                      <tr key={r.id} className="hover:bg-emerald-950/25 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-amber-200 font-semibold">{r.invoice_number}</td>
                        <td className="px-5 py-3.5 text-slate-100 font-medium">{r.customer_name}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-100">{formatCurrency(r.total_sales)}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-300 font-semibold">{formatCurrency(r.total_paid)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {hasOffsets ? (
                            <button
                              onClick={handleToggleOffsets}
                              className="inline-flex items-center gap-1 text-blue-300 font-semibold hover:text-blue-200 transition-colors"
                            >
                              {formatCurrency(r.offset_total || 0)}
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-red-300 font-bold">{formatCurrency(adjustedOutstanding)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {(r.overpaid || 0) > 0 ? (
                            <span className="text-purple-300 font-bold">{formatCurrency(r.overpaid)}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            (r.overpaid || 0) > 0
                              ? 'bg-purple-500/10 text-purple-200 border-purple-900/30'
                              : adjustedOutstanding <= 0
                                ? 'bg-emerald-500/10 text-emerald-200 border-emerald-900/30'
                                : 'bg-amber-500/10 text-amber-200 border-amber-900/30'
                          }`}>
                            {(r.overpaid || 0) > 0 ? 'Overpaid' : adjustedOutstanding <= 0 ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {adjustedOutstanding > 0 && (
                              <button
                                onClick={() => handleCollect(r)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 transition-all"
                                title="Collect Payment"
                              >
                                <span className="text-[10px] font-bold">PAY</span>
                              </button>
                            )}
                            <button
                              onClick={() => openEditSale(r)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setShowDeleteSaleConfirm(r.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Offset detail row */}
                      {isExpanded && r.party_id && offsetDetails[r.party_id] && (
                        <tr key={`${r.id}-offsets`} className="bg-blue-950/10">
                          <td colSpan={9} className="px-5 py-3">
                            <div className="ml-8 space-y-1.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Purchase Offsets for {r.customer_name}</h4>
                              {offsetDetails[r.party_id].map((offset) => (
                                <div key={offset.id} className="flex items-center gap-4 text-sm bg-blue-950/20 border border-blue-800/30 rounded-lg px-4 py-2.5">
                                  <div className="flex-1">
                                    <span className="text-slate-400">Purchase</span>
                                    <span className="ml-2 font-mono text-amber-200 font-semibold">{offset.purchase_number || '—'}</span>
                                    {offset.supplier_name && (
                                      <span className="ml-2 text-slate-500">from {offset.supplier_name}</span>
                                    )}
                                  </div>
                                  <div className="text-slate-400">
                                    Purchase Total: <span className="text-slate-200 font-medium">{formatCurrency(offset.purchase_total || 0)}</span>
                                  </div>
                                  <div className="text-slate-400">
                                    Offset: <span className="text-blue-300 font-semibold">{formatCurrency(offset.amount)}</span>
                                  </div>
                                  <div className="text-xs text-slate-500">{formatDate(offset.created_at)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} credit sale(s) · Outstanding: {formatCurrency(totalOutstanding)}
            </div>
          )}
        </div>
        )}

        {/* By Customer View */}
        {viewMode === 'customer' && (
          <div className="space-y-4">
            {loading ? (
              <div className="surface rounded-2xl p-12 text-center text-slate-400">Loading...</div>
            ) : customerGroups.length === 0 ? (
              <div className="surface rounded-2xl p-12 text-center text-slate-400">No credit sales found</div>
            ) : customerGroups.map((group) => {
              const isExpanded = expandedCustomer === group.customerName
              return (
                <div key={group.customerName} className="surface rounded-2xl overflow-hidden">
                  {/* Customer Header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-emerald-950/25 transition-colors"
                    onClick={() => setExpandedCustomer(isExpanded ? null : group.customerName)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-900/40 flex items-center justify-center text-emerald-200 font-bold text-sm">
                        {group.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{group.customerName}</h3>
                        <p className="text-xs text-slate-400">{group.invoiceCount} invoice(s) · {group.pendingCount} pending</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Sales</p>
                        <p className="text-sm font-semibold text-slate-100">{formatCurrency(group.totalSales)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Paid</p>
                        <p className="text-sm font-semibold text-emerald-300">{formatCurrency(group.totalPaid)}</p>
                      </div>
                      {group.totalOffset > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Offset</p>
                          <p className="text-sm font-semibold text-blue-300">{formatCurrency(group.totalOffset)}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Outstanding</p>
                        <p className="text-sm font-bold text-red-300">{formatCurrency(group.totalOutstanding)}</p>
                      </div>
                      {group.totalOverpaid > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Overpaid</p>
                          <p className="text-sm font-bold text-purple-300">{formatCurrency(group.totalOverpaid)}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {group.totalOutstanding > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenPayAll(group) }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold gradient-warning hover:shadow-lg hover:shadow-amber-500/20 text-white transition-all"
                          >
                            PAY ALL
                          </button>
                        )}
                        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Invoice List */}
                  {isExpanded && (
                    <div className="border-t border-emerald-900/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-emerald-950/30 border-b border-emerald-900/20">
                            <th className="text-left px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Invoice</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Paid</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Offset</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Outstanding</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Overpaid</th>
                            <th className="text-center px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                            <th className="text-center px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                            <th className="text-center px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-900/15">
                          {group.receivables.map((r) => {
                            const outstanding = Math.max(0, r.outstanding - (r.offset_total || 0))
                            return (
                              <tr key={r.id} className="hover:bg-emerald-950/20 transition-colors">
                                <td className="px-5 py-3 font-mono text-amber-200 font-semibold">{r.invoice_number}</td>
                                <td className="px-5 py-3 text-right font-bold text-slate-100">{formatCurrency(r.total_sales)}</td>
                                <td className="px-5 py-3 text-right text-emerald-300 font-semibold">{formatCurrency(r.total_paid)}</td>
                                <td className="px-5 py-3 text-right text-blue-300 font-semibold">{formatCurrency(r.offset_total || 0)}</td>
                                <td className="px-5 py-3 text-right text-red-300 font-bold">{formatCurrency(outstanding)}</td>
                                <td className="px-5 py-3 text-right">
                                  {(r.overpaid || 0) > 0 ? (
                                    <span className="text-purple-300 font-bold">{formatCurrency(r.overpaid)}</span>
                                  ) : (
                                    <span className="text-slate-500">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                    (r.overpaid || 0) > 0
                                      ? 'bg-purple-500/10 text-purple-200 border-purple-900/30'
                                      : outstanding <= 0
                                        ? 'bg-emerald-500/10 text-emerald-200 border-emerald-900/30'
                                        : 'bg-amber-500/10 text-amber-200 border-amber-900/30'
                                  }`}>
                                    {(r.overpaid || 0) > 0 ? 'Overpaid' : outstanding <= 0 ? 'Paid' : 'Pending'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center text-slate-400 text-xs">{formatDate(r.invoice_date || r.created_at)}</td>
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {outstanding > 0 && (
                                      <button
                                        onClick={() => handleCollect(r)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 transition-all"
                                        title="Collect Payment"
                                      >
                                        <span className="text-[10px] font-bold">PAY</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openEditSale(r)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                                      title="Edit"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={() => setShowDeleteSaleConfirm(r.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {/* Payment History for this customer */}
                      {group.receivables.some(r => r.payments.length > 0) && (
                        <div className="px-5 py-4 border-t border-emerald-900/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Payment History</h4>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {group.receivables.flatMap(r => r.payments.map(p => ({ ...p, invoiceNumber: r.invoice_number }))).map((p) => (
                              <div key={p.id} className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/20 rounded-lg px-3 py-2">
                                <div className="text-sm">
                                  <span className="text-emerald-300 font-semibold">{formatCurrency(p.amount)}</span>
                                  <span className="text-slate-400 ml-2">{formatDate(p.created_at)}</span>
                                  <span className="text-amber-200 ml-2 font-mono text-xs">{p.invoiceNumber}</span>
                                  {p.method && <span className="text-slate-500 ml-2 text-xs">({p.method})</span>}
                                  {p.notes && <span className="text-slate-500 ml-2">· {p.notes}</span>}
                                </div>
                                <button
                                  onClick={() => setShowDeletePaymentConfirm(p.id)}
                                  className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-950/40 transition-all"
                                  title="Delete Payment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="text-sm text-slate-400 px-1">
              {customerGroups.length} customer(s) · Outstanding: {formatCurrency(totalOutstanding)}
            </div>
          </div>
        )}

      </div>

      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Collect Receivable Payment" maxWidth="max-w-2xl">
        {selectedReceivable && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-semibold text-slate-100">{selectedReceivable.customer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Invoice</span>
                  <span className="font-mono text-emerald-300">{selectedReceivable.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Invoice Total</span>
                  <span className="font-medium text-slate-100">{formatCurrency(selectedReceivable.total_sales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Already Paid</span>
                  <span className="text-emerald-300">{formatCurrency(selectedReceivable.total_paid)}</span>
                </div>
                {(selectedReceivable.offset_total || 0) > 0 && (
                  <div className="flex justify-between text-sm col-span-2">
                    <span className="text-slate-400">Purchase Offset</span>
                    <span className="text-blue-300">{formatCurrency(selectedReceivable.offset_total || 0)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-sm border-t border-emerald-900/30 pt-2 mt-2">
                <span className="text-slate-200 font-medium">Outstanding</span>
                <span className="font-bold text-red-300">{formatCurrency(Math.max(0, selectedReceivable.outstanding - (selectedReceivable.offset_total || 0)))}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3.5 h-[54px] input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Method</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`w-full h-[54px] px-3.5 rounded-xl text-xs font-semibold border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/15 border-emerald-900/40 text-emerald-200' : 'border-emerald-900/30 text-slate-300 hover:bg-emerald-950/30'}`}
                  >
                    CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cheque')}
                    className={`w-full h-[54px] px-3.5 rounded-xl text-xs font-semibold border transition-all ${paymentMethod === 'cheque' ? 'bg-emerald-500/15 border-emerald-900/40 text-emerald-200' : 'border-emerald-900/30 text-slate-300 hover:bg-emerald-950/30'}`}
                  >
                    CHEQUE
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`w-full h-[54px] px-3.5 rounded-xl text-xs font-semibold border transition-all ${paymentMethod === 'bank' ? 'bg-emerald-500/15 border-emerald-900/40 text-emerald-200' : 'border-emerald-900/30 text-slate-300 hover:bg-emerald-950/30'}`}
                  >
                    BANK
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('other')}
                    className={`w-full h-[54px] px-3.5 rounded-xl text-xs font-semibold border transition-all ${paymentMethod === 'other' ? 'bg-emerald-500/15 border-emerald-900/40 text-emerald-200' : 'border-emerald-900/30 text-slate-300 hover:bg-emerald-950/30'}`}
                  >
                    OTHER
                  </button>
                </div>
              </div>
            </div>

            {paymentMethod === 'cheque' && (
              <div className="surface-2 rounded-xl p-4 space-y-3 border border-emerald-900/20">
                <div className="text-sm font-semibold text-slate-100">Cheque</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Cheque Date</label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Cheque Number</label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Enter cheque number"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedReceivable.payments.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Payment History</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {selectedReceivable.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/20 rounded-lg px-3 py-2">
                      <div className="text-sm">
                        <span className="text-emerald-300 font-semibold">{formatCurrency(p.amount)}</span>
                        <span className="text-slate-400 ml-2">{formatDate(p.created_at)}</span>
                        {p.notes && <span className="text-slate-500 ml-2">· {p.notes}</span>}
                      </div>
                      <button
                        onClick={() => setShowDeletePaymentConfirm(p.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-950/40 transition-all"
                        title="Delete Payment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payment Amount</label>
              <CurrencyInput
                value={paymentAmount}
                onChange={setPaymentAmount}
                placeholder="0.00"
                min={0.01}
                max={selectedReceivable.outstanding}
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Notes (optional)</label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Payment reference..."
                rows={2}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {error && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 gradient-warning hover:shadow-lg hover:shadow-amber-500/30 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200" disabled:opacity-50>
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Sale Confirmation Modal */}
      <Modal isOpen={!!showDeleteSaleConfirm} onClose={() => setShowDeleteSaleConfirm(null)} title="Delete Credit Sale">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this credit sale? This will reverse all ledger impacts including any collected payments and cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteSaleConfirm(null)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!showDeleteSaleConfirm) return
                try {
                  await deleteSale(showDeleteSaleConfirm)
                  setShowDeleteSaleConfirm(null)
                  loadReceivables()
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to delete.')
                }
              }}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Payment Confirmation Modal */}
      <Modal isOpen={!!showDeletePaymentConfirm} onClose={() => setShowDeletePaymentConfirm(null)} title="Delete Payment">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this payment? The ledger will be reversed accordingly.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeletePaymentConfirm(null)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!showDeletePaymentConfirm) return
                try {
                  await deleteReceivablePayment(showDeletePaymentConfirm)
                  setShowDeletePaymentConfirm(null)
                  loadReceivables()
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to delete payment.')
                }
              }}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Credit Sale Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Credit Sale">
        {editReceivable && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Invoice</span>
                <span className="font-mono text-emerald-300">{editReceivable.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Already Paid</span>
                <span className="text-emerald-300">{formatCurrency(editReceivable.total_paid)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Customer Name</label>
              <input
                type="text"
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Total Sales</label>
                <CurrencyInput
                  value={editTotalSales}
                  onChange={setEditTotalSales}
                  placeholder="0.00"
                  min={0.01}
                  className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Total Cost</label>
                <CurrencyInput
                  value={editTotalCost}
                  onChange={setEditTotalCost}
                  placeholder="0.00"
                  min={0}
                  className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Notes (optional)</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            {editError && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3">{editError}</div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all">Cancel</button>
              <button type="submit" className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/20">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Pay All Modal */}
      <Modal isOpen={showPayAllModal} onClose={() => setShowPayAllModal(false)} title="Pay All Outstanding" maxWidth="max-w-2xl">
        {payAllCustomer && (
          <form onSubmit={handlePayAllSubmit} className="space-y-4">
            <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-900/40 flex items-center justify-center text-emerald-200 font-bold text-sm">
                  {payAllCustomer.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{payAllCustomer.customerName}</h3>
                  <p className="text-xs text-slate-400">{payAllCustomer.invoiceCount} invoice(s) · {payAllCustomer.pendingCount} pending</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Sales</span>
                  <span className="font-medium text-slate-100">{formatCurrency(payAllCustomer.totalSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Already Paid</span>
                  <span className="text-emerald-300">{formatCurrency(payAllCustomer.totalPaid)}</span>
                </div>
                {payAllCustomer.totalOffset > 0 && (
                  <div className="flex justify-between text-sm col-span-2">
                    <span className="text-slate-400">Purchase Offsets</span>
                    <span className="text-blue-300">{formatCurrency(payAllCustomer.totalOffset)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-sm border-t border-emerald-900/30 pt-2 mt-2">
                <span className="text-slate-200 font-medium">Total Outstanding</span>
                <span className="font-bold text-red-300">{formatCurrency(payAllCustomer.totalOutstanding)}</span>
              </div>
              {payAllCustomer.totalOverpaid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Overpaid</span>
                  <span className="font-bold text-purple-300">{formatCurrency(payAllCustomer.totalOverpaid)}</span>
                </div>
              )}
            </div>

            {/* Invoice breakdown */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {payAllCustomer.receivables
                .filter(r => Math.max(0, r.outstanding - (r.offset_total || 0)) > 0)
                .sort((a, b) => new Date(a.invoice_date || a.created_at).getTime() - new Date(b.invoice_date || b.created_at).getTime())
                .map(r => {
                  const outstanding = Math.max(0, r.outstanding - (r.offset_total || 0))
                  return (
                    <div key={r.id} className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/20 rounded-lg px-3 py-2">
                      <div className="text-sm">
                        <span className="font-mono text-amber-200 font-semibold">{r.invoice_number}</span>
                        <span className="text-slate-400 ml-2 text-xs">{formatDate(r.invoice_date || r.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-red-300">{formatCurrency(outstanding)}</span>
                        {(r.overpaid || 0) > 0 && (
                          <span className="text-sm font-bold text-purple-300">Overpaid: {formatCurrency(r.overpaid)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payment Date</label>
                <input
                  type="date"
                  value={payAllDate}
                  onChange={(e) => setPayAllDate(e.target.value)}
                  className="w-full px-4 py-3.5 h-[54px] input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'cheque', 'bank', 'other'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayAllMethod(m)}
                      className={`w-full h-[54px] px-3.5 rounded-xl text-xs font-semibold border transition-all ${payAllMethod === m ? 'bg-emerald-500/15 border-emerald-900/40 text-emerald-200' : 'border-emerald-900/30 text-slate-300 hover:bg-emerald-950/30'}`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {payAllMethod === 'cheque' && (
              <div className="surface-2 rounded-xl p-4 space-y-3 border border-emerald-900/20">
                <div className="text-sm font-semibold text-slate-100">Cheque</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Cheque Date</label>
                    <input
                      type="date"
                      value={payAllChequeDate}
                      onChange={(e) => setPayAllChequeDate(e.target.value)}
                      className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Cheque Number</label>
                    <input
                      type="text"
                      value={payAllChequeNumber}
                      onChange={(e) => setPayAllChequeNumber(e.target.value)}
                      className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Enter cheque number"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payment Amount</label>
              <CurrencyInput
                value={payAllAmount}
                onChange={setPayAllAmount}
                placeholder="0.00"
                min={0.01}
                max={payAllCustomer.totalOutstanding}
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Payment will be distributed across invoices (oldest first)</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Notes (optional)</label>
              <textarea
                value={payAllNotes}
                onChange={(e) => setPayAllNotes(e.target.value)}
                placeholder="Payment reference..."
                rows={2}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {payAllError && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3">{payAllError}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowPayAllModal(false)} className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 gradient-warning hover:shadow-lg hover:shadow-amber-500/30 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50">
                {submitting ? 'Recording...' : `Pay ${formatCurrency(parseFloat(payAllAmount) || 0)}`}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  )
}
