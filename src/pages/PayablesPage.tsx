import { useState, useEffect } from 'react'
import { HandCoins, Search, Trash2, ChevronDown, ChevronUp, FileText, Plus, Users } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { Modal } from '../components/Modal'
import { SummaryCard } from '../components/SummaryCard'
import { getPayables, createPayablePayment, deletePayablePayment, deletePurchase, getPartyOffsets, clearPayableCheque, createPurchase, getNextNumber, createPartyIfMissing, getClient } from '../services/businessService'
import type { PayableWithPurchase } from '../types'
import type { PartyOffsetWithPurchase } from '../services/businessService'
import { formatCurrency, formatDate, formatChequeNumber, parseChequeNumber, generateInvoiceNumber } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'

export function PayablesPage() {
  const [payables, setPayables] = useState<PayableWithPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPayable, setSelectedPayable] = useState<PayableWithPurchase | null>(null)
  const [showDeletePaymentConfirm, setShowDeletePaymentConfirm] = useState<string | null>(null)
  const [showDeletePayableConfirm, setShowDeletePayableConfirm] = useState<string | null>(null)
  const [clearingCheque, setClearingCheque] = useState<string | null>(null)
  const [showManualPayableModal, setShowManualPayableModal] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'invoice' | 'supplier'>('supplier')
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  const [manualPayableSupplier, setManualPayableSupplier] = useState('')
  const [manualPayableAmount, setManualPayableAmount] = useState('')
  const [manualPayableNotes, setManualPayableNotes] = useState('')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque' | 'bank' | 'other'>('cash')
  const [chequeDate, setChequeDate] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [expandedPayable, setExpandedPayable] = useState<string | null>(null)
  const [offsetDetails, setOffsetDetails] = useState<Record<string, PartyOffsetWithPurchase[]>>({})

  const loadPayables = async () => {
    try {
      const data = await getPayables()
      setPayables(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayables()
  }, [])

  const handleCreateManualPayable = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(manualPayableAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Valid amount greater than zero is required.')
      return
    }
    if (!manualPayableSupplier.trim()) {
      setError('Supplier name is required.')
      return
    }

    setSubmitting(true)
    try {
      const nextSeq = await getNextNumber('purchases', 'purchase_number', 'PO')
      const purchaseNumber = generateInvoiceNumber('PO', nextSeq)

      const partyId = await createPartyIfMissing(manualPayableSupplier.trim())

      const { error } = await getClient()
        .from('purchases')
        .insert({
          purchase_number: purchaseNumber,
          supplier_name: manualPayableSupplier.trim(),
          party_id: partyId,
          total_amount: amount,
          payment_type: 'credit',
          notes: manualPayableNotes || 'Manual payable entry',
        })
      if (error) throw error

      setShowManualPayableModal(false)
      setManualPayableSupplier('')
      setManualPayableAmount('')
      setManualPayableNotes('')
      setError('')
      loadPayables()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to create payable.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePay = (payable: PayableWithPurchase) => {
    setSelectedPayable(payable)
    setPaymentAmount('')
    setPaymentNotes('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod('cash')
    setChequeDate('')
    setChequeNumber('')
    setError('')
    setShowPaymentModal(true)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPayable) return
    setError('')

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) { setError('Valid amount greater than zero is required.'); return }
    if (amount > Math.max(0, selectedPayable.outstanding - (selectedPayable.offset_total || 0))) {
      setError(`Amount cannot exceed outstanding balance of ${formatCurrency(Math.max(0, selectedPayable.outstanding - (selectedPayable.offset_total || 0)))}`)
      return
    }

    setSubmitting(true)
    try {
      await createPayablePayment({
        purchase_id: selectedPayable.id,
        supplier_name: selectedPayable.supplier_name,
        payment_date: paymentDate,
        method: paymentMethod,
        cheque_date: paymentMethod === 'cheque' ? chequeDate || undefined : undefined,
        cheque_number: paymentMethod === 'cheque' ? chequeNumber || undefined : undefined,
        amount,
        notes: paymentNotes || undefined,
      })
      setShowPaymentModal(false)
      loadPayables()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearCheque = async (paymentId: string) => {
    if (!confirm('Clear this cheque? This will move the amount from On Cheque to Cash in Hand.')) return
    setClearingCheque(paymentId)
    try {
      await clearPayableCheque(paymentId)
      await loadPayables()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to clear cheque.')
    } finally {
      setClearingCheque(null)
    }
  }

  const filtered = payables.filter(
    (p) => p.supplier_name.toLowerCase().includes(search.toLowerCase()) || p.purchase_number.toLowerCase().includes(search.toLowerCase())
  )

  // Group by supplier
  const supplierGroups = filtered.reduce((acc, p) => {
    const supplier = p.supplier_name
    if (!acc[supplier]) {
      acc[supplier] = {
        supplierName: supplier,
        invoices: [],
        totalAmount: 0,
        totalPaid: 0,
        totalOffset: 0,
        totalOutstanding: 0
      }
    }
    acc[supplier].invoices.push(p)
    acc[supplier].totalAmount += Number(p.total_amount)
    acc[supplier].totalPaid += p.total_paid
    acc[supplier].totalOffset += p.offset_total || 0
    acc[supplier].totalOutstanding += Math.max(0, p.outstanding - (p.offset_total || 0))
    return acc
  }, {} as Record<string, any>)

  const supplierGroupsArray = Object.values(supplierGroups).map((g: any) => ({
    supplierName: g.supplierName,
    invoices: g.invoices,
    invoiceCount: g.invoices.length,
    totalAmount: g.totalAmount,
    totalPaid: g.totalPaid,
    totalOffset: g.totalOffset,
    totalOutstanding: g.totalOutstanding
  }))

  const totalOutstanding = filtered.reduce((sum, p) => sum + Math.max(0, p.outstanding - (p.offset_total || 0)), 0)
  const totalPaid = filtered.reduce((sum, p) => sum + p.total_paid, 0)
  const totalOffsets = filtered.reduce((sum, p) => sum + (p.offset_total || 0), 0)
  const totalPayable = filtered.reduce((sum, p) => sum + Number(p.total_amount), 0)

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Payables</h1>
          <p className="text-sm text-slate-300 mt-0.5">Track credit purchases and make supplier payments</p>
        </div>

        <button
          onClick={() => setShowManualPayableModal(true)}
          className="flex items-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus size={16} /> Manual Payable
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={<HandCoins size={20} />} color="red" />
          <SummaryCard title="Total Paid" value={formatCurrency(totalPaid)} icon={<span className="text-xs font-bold">PAY</span>} color="green" />
          <SummaryCard title="Total Offsets" value={formatCurrency(totalOffsets)} icon={<HandCoins size={20} />} color="blue" />
          <SummaryCard title="Total Credit Purchases" value={formatCurrency(totalPayable)} icon={<HandCoins size={20} />} color="amber" />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by supplier or purchase number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1 surface rounded-xl p-1">
              <button
                onClick={() => setViewMode('supplier')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'supplier' ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-900/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Users size={14} /> By Supplier
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
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Purchase</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Supplier</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Paid</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Offset</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Outstanding</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">No credit purchases found</td></tr>
                ) : (
                  filtered.map((p) => {
                    const adjustedOutstanding = Math.max(0, p.outstanding - (p.offset_total || 0))
                    const hasOffsets = (p.offset_total || 0) > 0 && p.party_id
                    const isExpanded = expandedPayable === p.id
                    const handleToggleOffsets = async () => {
                      if (isExpanded) {
                        setExpandedPayable(null)
                        return
                      }
                      setExpandedPayable(p.id)
                      if (p.party_id && !offsetDetails[p.party_id]) {
                        try {
                          const details = await getPartyOffsets(p.party_id)
                          setOffsetDetails((prev) => ({ ...prev, [p.party_id!]: details }))
                        } catch { /* ignore */ }
                      }
                    }
                    return (
                      <>
                      <tr key={p.id} className="hover:bg-emerald-950/25 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-amber-200 font-semibold">{p.purchase_number}</td>
                        <td className="px-5 py-3.5 text-slate-100 font-medium">{p.supplier_name}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-100">{formatCurrency(p.total_amount)}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-300 font-semibold">{formatCurrency(p.total_paid)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {hasOffsets ? (
                            <button
                              onClick={handleToggleOffsets}
                              className="inline-flex items-center gap-1 text-blue-300 font-semibold hover:text-blue-200 transition-colors"
                            >
                              {formatCurrency(p.offset_total || 0)}
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-red-300 font-bold">{formatCurrency(adjustedOutstanding)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            adjustedOutstanding <= 0
                              ? 'bg-emerald-500/10 text-emerald-200 border-emerald-900/30'
                              : 'bg-amber-500/10 text-amber-200 border-amber-900/30'
                          }`}>
                            {adjustedOutstanding <= 0 ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {adjustedOutstanding > 0 && (
                              <button
                                onClick={() => handlePay(p)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 transition-all"
                                title="Make Payment"
                              >
                                <span className="text-[10px] font-bold">PAY</span>
                              </button>
                            )}
                            <button
                              onClick={() => setShowDeletePayableConfirm(p.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                              title="Delete Payable"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Offset detail row */}
                      {isExpanded && p.party_id && offsetDetails[p.party_id] && (
                        <tr key={`${p.id}-offsets`} className="bg-blue-950/10">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="ml-8 space-y-1.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Receivable Offsets for {p.supplier_name}</h4>
                              {offsetDetails[p.party_id].map((offset) => (
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
              {filtered.length} credit purchase(s) · Outstanding: {formatCurrency(totalOutstanding)}
            </div>
          )}
        </div>
        )}

        {/* By Supplier View */}
        {viewMode === 'supplier' && (
          <div className="space-y-4">
            {loading ? (
              <div className="surface rounded-2xl p-12 text-center text-slate-400">Loading...</div>
            ) : supplierGroupsArray.length === 0 ? (
              <div className="surface rounded-2xl p-12 text-center text-slate-400">No credit purchases found</div>
            ) : supplierGroupsArray.map((group) => {
              const isExpanded = expandedSupplier === group.supplierName
              return (
                <div key={group.supplierName} className="surface rounded-2xl overflow-hidden">
                  {/* Supplier Header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-emerald-950/25 transition-colors"
                    onClick={() => setExpandedSupplier(isExpanded ? null : group.supplierName)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-900/40 flex items-center justify-center text-amber-200 font-bold text-sm">
                        {group.supplierName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{group.supplierName}</h3>
                        <p className="text-xs text-slate-400">{group.invoiceCount} invoice(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Purchases</p>
                        <p className="text-sm font-semibold text-slate-100">{formatCurrency(group.totalAmount)}</p>
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
                      {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded Invoice List */}
                  {isExpanded && (
                    <div className="border-t border-emerald-900/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-emerald-950/30 border-b border-emerald-900/20">
                            <th className="text-left px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Purchase</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Paid</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Offset</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Outstanding</th>
                            <th className="text-center px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-900/20">
                          {group.invoices.map((p: PayableWithPurchase) => {
                            const adjustedOutstanding = Math.max(0, p.outstanding - (p.offset_total || 0))
                            return (
                              <tr key={p.id} className="hover:bg-emerald-950/25 transition-colors">
                                <td className="px-5 py-3 font-mono text-amber-200 font-semibold">{p.purchase_number}</td>
                                <td className="px-5 py-3 text-right font-bold text-slate-100">{formatCurrency(p.total_amount)}</td>
                                <td className="px-5 py-3 text-right text-emerald-300 font-semibold">{formatCurrency(p.total_paid)}</td>
                                <td className="px-5 py-3 text-right text-blue-300 font-semibold">{formatCurrency(p.offset_total || 0)}</td>
                                <td className="px-5 py-3 text-right text-red-300 font-bold">{formatCurrency(adjustedOutstanding)}</td>
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {adjustedOutstanding > 0 && (
                                      <button
                                        onClick={() => handlePay(p)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 transition-all"
                                        title="Make Payment"
                                      >
                                        <span className="text-[10px] font-bold">PAY</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setShowDeletePayableConfirm(p.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                                      title="Delete Payable"
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Make Supplier Payment">
        {selectedPayable && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Supplier</span>
                <span className="font-semibold text-slate-100">{selectedPayable.supplier_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Purchase</span>
                <span className="font-mono text-emerald-300">{selectedPayable.purchase_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Purchase Total</span>
                <span className="font-medium text-slate-100">{formatCurrency(selectedPayable.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Already Paid</span>
                <span className="text-emerald-300">{formatCurrency(selectedPayable.total_paid)}</span>
              </div>
              {(selectedPayable.offset_total || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Receivable Offset</span>
                  <span className="text-blue-300">{formatCurrency(selectedPayable.offset_total || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-emerald-900/30 pt-2">
                <span className="text-slate-200 font-medium">Outstanding</span>
                <span className="font-bold text-red-300">{formatCurrency(Math.max(0, selectedPayable.outstanding - (selectedPayable.offset_total || 0)))}</span>
              </div>
            </div>

            {selectedPayable.payments.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Payment History</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {selectedPayable.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/20 rounded-lg px-3 py-2">
                      <div className="text-sm">
                        <span className="text-emerald-300 font-semibold">{formatCurrency(p.amount)}</span>
                        <span className="text-slate-400 ml-2">{formatDate(p.created_at)}</span>
                        {p.method && <span className="text-slate-500 ml-2 text-xs">({p.method})</span>}
                        {p.method === 'cheque' && p.cheque_number && <span className="text-blue-300 ml-2 font-mono text-xs">{formatChequeNumber(p.cheque_number)}</span>}
                        {p.method === 'cheque' && p.cheque_status && <span className={`ml-2 text-xs font-semibold ${p.cheque_status === 'cleared' ? 'text-green-400' : 'text-yellow-400'}`}>{p.cheque_status.toUpperCase()}</span>}
                        {p.notes && <span className="text-slate-500 ml-2">· {p.notes}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {p.method === 'cheque' && p.cheque_status === 'pending' && (
                          <button
                            onClick={() => handleClearCheque(p.id)}
                            disabled={clearingCheque === p.id}
                            className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                            title="Clear Cheque"
                          >
                            <FileText size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => setShowDeletePaymentConfirm(p.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-950/40 transition-all"
                          title="Delete Payment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
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
                max={selectedPayable.outstanding}
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
                      value={formatChequeNumber(chequeNumber)}
                      onChange={(e) => setChequeNumber(parseChequeNumber(e.target.value))}
                      placeholder="XXXXXX-XXXX-XXX"
                      maxLength={15}
                      className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

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
              <button type="submit" disabled={submitting} className="flex items-center gap-2 gradient-warning hover:shadow-lg hover:shadow-amber-500/30 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50">
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
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
                  await deletePayablePayment(showDeletePaymentConfirm)
                  setShowDeletePaymentConfirm(null)
                  loadPayables()
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

      {/* Delete Payable Confirmation Modal */}
      <Modal isOpen={!!showDeletePayableConfirm} onClose={() => setShowDeletePayableConfirm(null)} title="Delete Payable">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this payable entry? This will reverse the purchase ledger impact and remove the credit purchase.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeletePayableConfirm(null)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!showDeletePayableConfirm) return
                try {
                  await deletePurchase(showDeletePayableConfirm)
                  setShowDeletePayableConfirm(null)
                  loadPayables()
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to delete payable.')
                }
              }}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Manual Payable Creation Modal */}
      <Modal isOpen={showManualPayableModal} onClose={() => setShowManualPayableModal(false)} title="Create Manual Payable">
        <form onSubmit={handleCreateManualPayable} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-sm text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Name</label>
            <input
              type="text"
              value={manualPayableSupplier}
              onChange={(e) => setManualPayableSupplier(e.target.value)}
              className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Amount</label>
            <CurrencyInput
              value={manualPayableAmount}
              onChange={setManualPayableAmount}
              className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
            <textarea
              value={manualPayableNotes}
              onChange={(e) => setManualPayableNotes(e.target.value)}
              className="w-full px-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              rows={3}
            />
          </div>
          <div className="bg-blue-950/30 border border-blue-900/30 rounded-xl p-3">
            <p className="text-xs text-blue-200">This creates a payable entry without affecting inventory or cash in hand. Use for manual credit entries.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowManualPayableModal(false)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Payable'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
