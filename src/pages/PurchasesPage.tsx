import { useState, useEffect } from 'react'
import { Truck, Plus, Search, FileText, Pencil, Trash2 } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { Modal } from '../components/Modal'
import { SummaryCard } from '../components/SummaryCard'
import { createPurchase, updatePurchase, deletePurchase, getPurchases, getReceivables, getPartyOutstandingReceivable, getParties, getPurchaseOffsetTotal } from '../services/businessService'
import type { Purchase, PaymentType, Party } from '../types'
import { formatCurrency, formatDate, parseCurrencyInput } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'
import { PartyCombobox } from '../components/PartyCombobox'

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [supplierName, setSupplierName] = useState('')
  const [partyId, setPartyId] = useState<string | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [creditCustomers, setCreditCustomers] = useState<{ name: string; partyId: string; outstanding: number }[]>([])
  const [outstandingReceivable, setOutstandingReceivable] = useState(0)
  const [totalAmount, setTotalAmount] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [notes, setNotes] = useState('')
  const [offsetEnabled, setOffsetEnabled] = useState(true)

  const loadPurchases = async () => {
    try {
      const data = await getPurchases(
        dateFrom || undefined,
        dateTo ? `${dateTo}T23:59:59` : undefined
      )
      setPurchases(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPurchases()
  }, [dateFrom, dateTo])

  useEffect(() => {
    getParties().then(setParties).catch(console.error)
    // Load credit customers with outstanding balances
    getReceivables().then((receivables) => {
      // Group by party_id and calculate outstanding per party
      const partyMap: Record<string, { name: string; totalOutstanding: number }> = {}
      for (const r of receivables) {
        if (r.party_id) {
          if (!partyMap[r.party_id]) {
            partyMap[r.party_id] = { name: r.customer_name, totalOutstanding: 0 }
          }
          partyMap[r.party_id].totalOutstanding += Math.max(0, r.outstanding - (r.offset_total || 0))
        }
      }
      const customers = Object.entries(partyMap)
        .map(([id, data]) => ({ name: data.name, partyId: id, outstanding: data.totalOutstanding }))
        .filter((c) => c.outstanding > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
      setCreditCustomers(customers)
    }).catch(console.error)
  }, [])

  // Live offset calculation when party or amount changes
  const purchaseAmount = parseFloat(totalAmount) || 0
  const offsetAmount = outstandingReceivable > 0 ? Math.min(outstandingReceivable, purchaseAmount) : 0
  const remainingAmount = purchaseAmount - offsetAmount

  useEffect(() => {
    if (partyId) {
      getPartyOutstandingReceivable(partyId).then(setOutstandingReceivable).catch(() => setOutstandingReceivable(0))
    } else {
      setOutstandingReceivable(0)
    }
  }, [partyId])

  const resetForm = () => {
    setSupplierName('')
    setPartyId(null)
    setOutstandingReceivable(0)
    setTotalAmount('')
    setPaymentType('cash')
    setNotes('')
    setOffsetEnabled(true)
    setError('')
    setEditingPurchase(null)
  }

  const openEditModal = async (purchase: Purchase) => {
    setEditingPurchase(purchase)
    setSupplierName(purchase.supplier_name)
    setPartyId(purchase.party_id || null)
    setTotalAmount(String(purchase.total_amount))
    setPaymentType(purchase.payment_type)
    setNotes(purchase.notes || '')
    setError('')
    setOffsetEnabled(false)
    setShowModal(true)

    if (purchase.party_id) {
      try {
        const totalOffset = await getPurchaseOffsetTotal(purchase.id)
        setOffsetEnabled(totalOffset > 0)
      } catch (err) {
        console.error('Failed to load purchase offset state', err)
      }
    }
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message
    if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
      return (err as any).message
    }
    try {
      return JSON.stringify(err)
    } catch {
      return fallback
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const amount = parseFloat(totalAmount)
    if (!supplierName.trim()) { setError('Supplier name is required.'); return }
    if (isNaN(amount) || amount <= 0) { setError('Valid amount greater than zero is required.'); return }

    setSubmitting(true)
    try {
      if (editingPurchase) {
        await updatePurchase(editingPurchase.id, {
          supplier_name: supplierName,
          party_id: partyId,
          total_amount: amount,
          payment_type: paymentType,
          notes: notes || undefined,
          offset_enabled: offsetEnabled,
        })
      } else {
        await createPurchase({
          supplier_name: supplierName,
          party_id: partyId,
          total_amount: amount,
          payment_type: paymentType,
          notes: notes || undefined,
          offset_enabled: offsetEnabled,
        })
      }
      resetForm()
      setShowModal(false)
      loadPurchases()
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to ${editingPurchase ? 'update' : 'create'} purchase.`))
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = purchases.filter(
    (p) =>
      p.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      p.purchase_number.toLowerCase().includes(search.toLowerCase())
  )

  const totalPurchases = filtered.reduce((sum, p) => sum + Number(p.total_amount), 0)
  const cashPurchases = filtered.filter((p) => p.payment_type === 'cash').reduce((sum, p) => sum + Number(p.total_amount), 0)
  const creditPurchases = filtered.filter((p) => p.payment_type === 'credit').reduce((sum, p) => sum + Number(p.total_amount), 0)

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Purchases</h1>
            <p className="text-sm text-slate-300 mt-0.5">Record stock purchases from suppliers</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 gradient-success hover:shadow-lg hover:shadow-emerald-500/30 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <Plus size={18} />
            New Purchase
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="Total Purchases" value={formatCurrency(totalPurchases)} icon={<Truck size={20} />} color="blue" />
          <SummaryCard title="Cash Purchases" value={formatCurrency(cashPurchases)} icon={<FileText size={20} />} color="green" />
          <SummaryCard title="Credit Purchases" value={formatCurrency(creditPurchases)} icon={<FileText size={20} />} color="red" />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search purchases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Purchase #</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Supplier</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Payment</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Notes</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">No purchases found</td></tr>
                ) : (
                  filtered.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-emerald-950/25 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-emerald-300 font-semibold">{purchase.purchase_number}</td>
                      <td className="px-5 py-3.5 text-slate-100 font-medium">{purchase.supplier_name}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-100">{formatCurrency(purchase.total_amount)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          purchase.payment_type === 'cash'
                            ? 'bg-emerald-500/10 text-emerald-200 border-emerald-900/30'
                            : 'bg-red-500/10 text-red-200 border-red-900/30'
                        }`}>
                          {purchase.payment_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{formatDate(purchase.created_at)}</td>
                      <td className="px-5 py-3.5 text-slate-400 max-w-[200px] truncate">{purchase.notes || '\u2014'}</td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(purchase)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(purchase.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} purchase(s) · Total: {formatCurrency(totalPurchases)}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Purchase">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this purchase? This will reverse all ledger impacts and cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!showDeleteConfirm) return
                try {
                  await deletePurchase(showDeleteConfirm)
                  setShowDeleteConfirm(null)
                  loadPurchases()
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }} title={editingPurchase ? 'Edit Purchase' : 'Create Purchase'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PartyCombobox
            parties={parties}
            value={supplierName}
            partyId={partyId}
            onNameChange={(name) => {
              setSupplierName(name)
              // Auto-match to credit customer if name matches
              const match = creditCustomers.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
              if (match) {
                setPartyId(match.partyId)
              } else {
                const partyMatch = parties.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())
                if (partyMatch) {
                  setPartyId(partyMatch.id)
                } else {
                  setPartyId(null)
                }
              }
            }}
            onPartySelect={(id, name) => {
              setPartyId(id)
              setSupplierName(name)
            }}
            label="Supplier / Party"
            placeholder="Type to search or enter supplier name..."
            required
          />

          {/* Credit Customer Offset Selector */}
          {creditCustomers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Offset Credit Customer (optional)</label>
              <select
                value={partyId && creditCustomers.some((c) => c.partyId === partyId) ? partyId : ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val) {
                    const c = creditCustomers.find((ct) => ct.partyId === val)
                    setPartyId(val)
                    if (c) setSupplierName(c.name)
                  } else {
                    // Only clear partyId if it was from a credit customer
                    if (creditCustomers.some((c) => c.partyId === partyId)) {
                      setPartyId(null)
                    }
                  }
                }}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">No offset</option>
                {creditCustomers.map((c) => (
                  <option key={c.partyId} value={c.partyId}>
                    {c.name} — Outstanding: {formatCurrency(c.outstanding)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Offset Toggle */}
          {partyId && creditCustomers.some((c) => c.partyId === partyId) && (
            <div className="flex items-center gap-3 p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl">
              <input
                type="checkbox"
                id="offsetToggle"
                checked={offsetEnabled}
                onChange={(e) => setOffsetEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-emerald-900/40 bg-emerald-950/30 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <label htmlFor="offsetToggle" className="text-sm text-slate-200 cursor-pointer">
                Enable offset against receivable
              </label>
            </div>
          )}

          {/* Offset Calculation Box */}
          {partyId && outstandingReceivable > 0 && purchaseAmount > 0 && offsetEnabled && (
            <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">Party Offset Calculation</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-400">Outstanding Receivable</div>
                <div className="text-right font-semibold text-blue-300">{formatCurrency(outstandingReceivable)}</div>
                <div className="text-slate-400">Purchase Total</div>
                <div className="text-right font-semibold text-slate-200">{formatCurrency(purchaseAmount)}</div>
                <div className="text-slate-400 border-t border-blue-800/40 pt-2">Offset Amount</div>
                <div className="text-right font-semibold text-emerald-400 border-t border-blue-800/40 pt-2">{formatCurrency(offsetAmount)}</div>
                <div className="text-slate-400">Remaining Payment</div>
                <div className="text-right font-semibold text-amber-300">{formatCurrency(remainingAmount)}</div>
              </div>
              {paymentType === 'cash' && (
                <p className="text-xs text-blue-400/80 mt-1">Cash will be deducted only for remaining: {formatCurrency(remainingAmount)}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Total Amount</label>
            <CurrencyInput
              value={totalAmount}
              onChange={setTotalAmount}
              placeholder="0.00"
              min={0.01}
              className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payment Type</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all ${
                paymentType === 'cash'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200 shadow-sm'
                  : 'border-emerald-900/30 text-slate-400 hover:border-emerald-900/50'
              }`}>
                <input type="radio" name="paymentType" value="cash" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="sr-only" />
                Cash
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all ${
                paymentType === 'credit'
                  ? 'border-red-500 bg-red-500/10 text-red-200 shadow-sm'
                  : 'border-emerald-900/30 text-slate-400 hover:border-emerald-900/50'
              }`}>
                <input type="radio" name="paymentType" value="credit" checked={paymentType === 'credit'} onChange={() => setPaymentType('credit')} className="sr-only" />
                Credit
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-100 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3 font-medium">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-3 gradient-success text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-50">
              {submitting ? (editingPurchase ? 'Saving...' : 'Creating...') : (editingPurchase ? 'Save Changes' : 'Create Purchase')}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
