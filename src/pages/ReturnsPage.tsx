import { useState, useEffect } from 'react'
import { RotateCcw, Plus, Search, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { Modal } from '../components/Modal'
import { SummaryCard } from '../components/SummaryCard'
import { getReturns, createReturn, deleteReturn, getSales, getParties } from '../services/businessService'
import type { Return, ReturnItemInput, RefundMethod, Sale, Party } from '../types'
import { formatCurrency, formatDate, parseCurrencyInput, todayISO } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'
import { PartyCombobox } from '../components/PartyCombobox'

interface DraftReturnItem {
  key: string
  item_name: string
  quantity: string
  cost_price: string
  refund_price: string
}

let itemKeyCounter = 0
function newReturnItem(): DraftReturnItem {
  return { key: `item-${++itemKeyCounter}`, item_name: '', quantity: '1', cost_price: '', refund_price: '' }
}

export function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [showEntry, setShowEntry] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [customerName, setCustomerName] = useState('')
  const [partyId, setPartyId] = useState<string | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [returnDate, setReturnDate] = useState(todayISO())
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftReturnItem[]>([newReturnItem()])

  // Link to sale
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSaleId, setSelectedSaleId] = useState<string>('')
  const [showSalePicker, setShowSalePicker] = useState(false)

  const loadReturns = async () => {
    try {
      const data = await getReturns()
      setReturns(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReturns() }, [])

  const loadFormData = async () => {
    try {
      const [sl, pt] = await Promise.all([getSales(), getParties()])
      setSales(sl)
      setParties(pt)
    } catch (err) {
      console.error(err)
    }
  }

  const openEntry = () => {
    setShowEntry(true)
    resetForm()
    loadFormData()
  }

  const resetForm = () => {
    setCustomerName('')
    setPartyId(null)
    setReturnDate(todayISO())
    setRefundMethod('cash')
    setNotes('')
    setItems([newReturnItem()])
    setSelectedSaleId('')
    setShowSalePicker(false)
    setError('')
  }

  const handleLinkSale = (saleId: string) => {
    setSelectedSaleId(saleId)
    const sale = sales.find(s => s.id === saleId)
    if (sale) {
      setCustomerName(sale.customer_name)
      setPartyId(sale.party_id || null)
      // Pre-fill items from sale
      if (sale.sale_items && sale.sale_items.length > 0) {
        setItems(sale.sale_items.map(si => ({
          key: `item-${++itemKeyCounter}`,
          item_name: si.item_name,
          quantity: String(si.quantity),
          cost_price: String(si.cost_price),
          refund_price: String(si.selling_price),
        })))
      }
    }
  }

  const updateItem = (index: number, field: keyof DraftReturnItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const totalCost = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 1
    const cp = parseFloat(item.cost_price) || 0
    return sum + cp * qty
  }, 0)

  const totalRefund = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 1
    const rp = parseFloat(item.refund_price) || 0
    return sum + rp * qty
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!customerName.trim()) { setError('Customer name is required.'); return }
    if (items.length === 0) { setError('At least one item is required.'); return }

    const validItems = items.filter(i => i.item_name.trim() && i.cost_price.trim() && i.refund_price.trim())
    if (validItems.length === 0) { setError('Items must have name, cost, and refund price.'); return }

    const returnItems: ReturnItemInput[] = validItems.map(item => ({
      item_name: item.item_name.trim(),
      quantity: parseInt(item.quantity) || 1,
      cost_price: parseFloat(item.cost_price) || 0,
      refund_price: parseFloat(item.refund_price) || 0,
    }))

    setSubmitting(true)
    try {
      await createReturn({
        sale_id: selectedSaleId || null,
        customer_name: customerName.trim(),
        party_id: partyId || null,
        return_date: returnDate,
        total_cost: totalCost,
        total_refund: totalRefund,
        refund_method: refundMethod,
        notes: notes.trim() || undefined,
        items: returnItems,
      })
      setShowEntry(false)
      loadReturns()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create return.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteReturn(id)
      setShowDeleteConfirm(null)
      loadReturns()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete return.')
    }
  }

  const filtered = returns.filter(r =>
    r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    r.return_number.toLowerCase().includes(search.toLowerCase())
  )

  const totalReturnValue = filtered.reduce((s, r) => s + Number(r.total_refund), 0)
  const totalCostReturned = filtered.reduce((s, r) => s + Number(r.total_cost), 0)

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Returns</h1>
            <p className="text-sm text-slate-300 mt-0.5">Track item returns and refunds</p>
          </div>
          <button
            onClick={openEntry}
            className="flex items-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={16} /> New Return
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="Total Returns" value={formatCurrency(totalReturnValue)} icon={<RotateCcw size={20} />} color="amber" />
          <SummaryCard title="Cost Returned" value={formatCurrency(totalCostReturned)} icon={<RotateCcw size={20} />} color="blue" />
          <SummaryCard title="Return Count" value={String(filtered.length)} icon={<RotateCcw size={20} />} color="red" />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer or return number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Return #</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Cost</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Refund</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Method</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">No returns found</td></tr>
                ) : filtered.map((r) => {
                  const isExpanded = expandedReturn === r.id
                  return (
                    <>
                      <tr key={r.id} className="hover:bg-emerald-950/25 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-amber-200 font-semibold">{r.return_number}</td>
                        <td className="px-5 py-3.5 text-slate-100 font-medium">{r.customer_name}</td>
                        <td className="px-5 py-3.5 text-right text-blue-300 font-semibold">{formatCurrency(r.total_cost)}</td>
                        <td className="px-5 py-3.5 text-right text-red-300 font-bold">{formatCurrency(r.total_refund)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border bg-amber-500/10 text-amber-200 border-amber-900/30">
                            {r.refund_method.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{formatDate(r.return_date || r.created_at)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setExpandedReturn(isExpanded ? null : r.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                              title="View Items"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(r.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && r.return_items && r.return_items.length > 0 && (
                        <tr key={`${r.id}-items`} className="bg-blue-950/10">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="ml-8 space-y-1.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Returned Items</h4>
                              {r.return_items.map((ri) => (
                                <div key={ri.id} className="flex items-center gap-4 text-sm bg-blue-950/20 border border-blue-800/30 rounded-lg px-4 py-2.5">
                                  <div className="flex-1">
                                    <span className="text-slate-100 font-medium">{ri.item_name}</span>
                                    <span className="text-slate-500 ml-2">× {ri.quantity}</span>
                                  </div>
                                  <div className="text-slate-400">
                                    Cost: <span className="text-blue-300 font-semibold">{formatCurrency(ri.cost_price * ri.quantity)}</span>
                                  </div>
                                  <div className="text-slate-400">
                                    Refund: <span className="text-red-300 font-semibold">{formatCurrency(ri.refund_price * ri.quantity)}</span>
                                  </div>
                                </div>
                              ))}
                              {r.notes && (
                                <div className="text-xs text-slate-500 mt-2">Notes: {r.notes}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} return(s) · Total Refund: {formatCurrency(totalReturnValue)}
            </div>
          )}
        </div>
      </div>

      {/* New Return Modal */}
      <Modal isOpen={showEntry} onClose={() => setShowEntry(false)} title="New Return" maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Link to sale */}
          <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-200">Link to Invoice (optional)</span>
              <button
                type="button"
                onClick={() => setShowSalePicker(!showSalePicker)}
                className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
              >
                {showSalePicker ? 'Hide' : 'Select Invoice'}
              </button>
            </div>
            {showSalePicker && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search invoices by number or customer..."
                  className="w-full px-3 py-2 input-surface rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  onChange={(e) => {
                    // Simple filter - just show filtered list
                  }}
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {sales.slice(0, 20).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleLinkSale(s.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedSaleId === s.id ? 'bg-blue-500/20 border border-blue-900/40 text-blue-200' : 'hover:bg-blue-950/30 text-slate-300'}`}
                    >
                      <span className="font-mono text-amber-200 font-semibold">{s.invoice_number}</span>
                      <span className="ml-2">{s.customer_name}</span>
                      <span className="ml-2 text-slate-500">{formatCurrency(s.total_sales)}</span>
                    </button>
                  ))}
                </div>
                {selectedSaleId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedSaleId(''); resetFormFields() }}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Customer Name</label>
              <PartyCombobox
                value={customerName}
                onNameChange={setCustomerName}
                onPartySelect={(pId, name) => { setPartyId(pId); setCustomerName(name) }}
                partyId={partyId}
                parties={parties}
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Return Date</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Refund Method</label>
            <div className="grid grid-cols-4 gap-2">
              {(['cash', 'cheque', 'bank', 'other'] as RefundMethod[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRefundMethod(m)}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all ${refundMethod === m ? 'bg-emerald-500/15 border-emerald-900/40 text-emerald-200' : 'border-emerald-900/30 text-slate-300 hover:bg-emerald-950/30'}`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Return Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200">Returned Items</label>
              <button
                type="button"
                onClick={() => setItems(prev => [...prev, newReturnItem()])}
                className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.key} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {index === 0 && <label className="block text-xs text-slate-500 mb-1">Item Name</label>}
                    <input
                      type="text"
                      value={item.item_name}
                      onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                      className="w-full px-3 py-2.5 input-surface rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Item name"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-slate-500 mb-1">Qty</label>}
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2.5 input-surface rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      min="1"
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    {index === 0 && <label className="block text-xs text-slate-500 mb-1">Cost Price</label>}
                    <CurrencyInput
                      value={item.cost_price}
                      onChange={(v) => updateItem(index, 'cost_price', v)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-2 py-2.5 input-surface rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-slate-500 mb-1">Refund</label>}
                    <CurrencyInput
                      value={item.refund_price}
                      onChange={(v) => updateItem(index, 'refund_price', v)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-2 py-2.5 input-surface rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-950/40 transition-all"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Cost (back to inventory)</span>
                <span className="text-blue-300 font-semibold">{formatCurrency(totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Refund (cash out)</span>
                <span className="text-red-300 font-bold">{formatCurrency(totalRefund)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Reason for return..."
            />
          </div>

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowEntry(false)} className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 gradient-warning hover:shadow-lg hover:shadow-amber-500/30 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50">
              {submitting ? 'Processing...' : 'Process Return'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Return">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this return? The ledger will be reversed (inventory decreases, cash increases). This cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )

  function resetFormFields() {
    setCustomerName('')
    setPartyId(null)
    setItems([newReturnItem()])
  }
}
