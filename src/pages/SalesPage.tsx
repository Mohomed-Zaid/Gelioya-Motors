import { useState, useEffect } from 'react'
import { ShoppingCart, Plus, Search, FileText, Pencil, Trash2, X, ChevronDown, ChevronUp, ArrowLeft, BookOpen } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { Modal } from '../components/Modal'
import { SummaryCard } from '../components/SummaryCard'
import { createSale, updateSale, deleteSale, getSales, getParties, confirmChequeSale } from '../services/businessService'
import type { Sale, SaleItemInput, PaymentType, Party } from '../types'
import { formatCurrency, formatDate, parseCurrencyInput, todayISO, tomorrowISO } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'
import { PartyCombobox } from '../components/PartyCombobox'

interface DraftItem {
  key: string
  item_name: string
  quantity: string
  cost_price: string
  selling_price: string
}

type EntryMode = 'book' | 'lines'

const BOOK_ENTRY_DEFAULT = 'Book entry'

let itemKeyCounter = 0
function newItem(): DraftItem {
  return { key: `item-${++itemKeyCounter}`, item_name: '', quantity: '1', cost_price: '', selling_price: '' }
}

function calcItemProfit(item: DraftItem): number {
  const qty = parseInt(item.quantity) || 1
  const cp = item.cost_price.trim() !== '' ? (parseFloat(item.cost_price) || 0) : 0
  return (parseFloat(item.selling_price) || 0) * qty - cp * qty
}

/** Parses money with optional leading minus (for manual profit / loss). */
function parseSignedMoney(s: string): number {
  const t = s.trim().replace(/[^0-9.-]/g, '')
  if (t === '' || t === '-') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'entry'>('list')
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [expandedSale, setExpandedSale] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingCheque, setConfirmingCheque] = useState<string | null>(null)

  // Form state
  const [customerName, setCustomerName] = useState('')
  const [partyId, setPartyId] = useState<string | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [invoiceDate, setInvoiceDate] = useState(tomorrowISO())
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newItem()])
  const [entryMode, setEntryMode] = useState<EntryMode>('book')
  const [bookLineLabel, setBookLineLabel] = useState(BOOK_ENTRY_DEFAULT)
  const [bookCost, setBookCost] = useState('')
  const [bookPrice, setBookPrice] = useState('')
  const [bookProfit, setBookProfit] = useState('')

  const loadSales = async () => {
    try {
      const data = await getSales(
        dateFrom || undefined,
        dateTo || undefined
      )
      setSales(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [dateFrom, dateTo])

  useEffect(() => {
    getParties().then(setParties).catch(console.error)
  }, [])

  const resetForm = () => {
    setCustomerName('')
    setPartyId(null)
    setInvoiceDate(todayISO())
    setPaymentType('cash')
    setNotes('')
    setItems([newItem()])
    setEntryMode('book')
    setBookLineLabel(BOOK_ENTRY_DEFAULT)
    setBookCost('')
    setBookPrice('')
    setBookProfit('')
    setError('')
    setEditingSale(null)
  }

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale)
    setCustomerName(sale.customer_name)
    setPartyId(sale.party_id || null)
    setInvoiceDate(sale.invoice_date || todayISO())
    setPaymentType(sale.payment_type)
    setNotes(sale.notes || '')
    setError('')
    const sis = sale.sale_items && sale.sale_items.length > 0 ? sale.sale_items : null
    if (sis && sis.length === 1) {
      const si = sis[0]
      setEntryMode('book')
      setBookLineLabel(si.item_name?.trim() || BOOK_ENTRY_DEFAULT)
      setBookCost(si.cost_price > 0 ? String(si.cost_price) : '')
      setBookPrice(String(si.selling_price))
      setBookProfit(String(si.profit))
      setItems([newItem()])
    } else {
      setEntryMode('lines')
      setBookLineLabel(BOOK_ENTRY_DEFAULT)
      setBookCost('')
      setBookPrice('')
      setBookProfit('')
      const saleItems = sis
        ? sis.map((si) => ({
            key: `item-${++itemKeyCounter}`,
            item_name: si.item_name,
            quantity: String(si.quantity || 1),
            cost_price: si.cost_price > 0 ? String(si.cost_price / (si.quantity || 1)) : '',
            selling_price: String(si.selling_price / (si.quantity || 1)),
          }))
        : [{ key: `item-${++itemKeyCounter}`, item_name: '', quantity: '1', cost_price: sale.total_cost > 0 ? String(sale.total_cost) : '', selling_price: String(sale.total_sales) }]
      setItems(saleItems)
    }
    setMode('entry')
  }

  const openCreateModal = () => {
    resetForm()
    setMode('entry')
  }

  const handleConfirmCheque = async (saleId: string) => {
    if (!confirm('Confirm this cheque sale? This will transfer the amount to Cash in Hand.')) return
    setConfirmingCheque(saleId)
    try {
      console.log('Confirming cheque sale:', saleId)
      await confirmChequeSale(saleId)
      console.log('Cheque confirmed successfully, reloading sales...')
      await loadSales()
      console.log('Sales reloaded successfully')
    } catch (err) {
      console.error('Error confirming cheque sale:', err)
      // Check if the confirmation actually succeeded by checking if the error is from loadSales
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm cheque sale.'
      alert(errorMessage)
    } finally {
      setConfirmingCheque(null)
    }
  }

  // Item management
  const addItem = () => setItems([...items, newItem()])

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof DraftItem, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  // Live totals (unit price × qty) — cost only counts if entered and > 0
  const totalCost = items.reduce((sum, item) => {
    if (item.cost_price.trim() !== '') {
      return sum + (parseFloat(item.cost_price) || 0) * (parseInt(item.quantity) || 1)
    }
    return sum
  }, 0)
  const totalSales = items.reduce((sum, item) => sum + (parseFloat(item.selling_price) || 0) * (parseInt(item.quantity) || 1), 0)
  const totalProfit = totalSales - totalCost

  const bookCostNum = parseCurrencyInput(bookCost)
  const bookPriceNum = parseCurrencyInput(bookPrice)
  const bookProfitNum = parseSignedMoney(bookProfit)
  const bookSuggestedProfit = bookPriceNum - bookCostNum

  const switchToLinesMode = () => {
    if (entryMode === 'lines') return
    const calc = bookPriceNum - bookCostNum
    if (Math.abs(bookProfitNum - calc) > 0.02) {
      if (!confirm('Line items mode calculates profit as selling price minus cost on each row. Your typed profit will not carry over exactly—continue?')) return
    }
    const label = bookLineLabel.trim() || BOOK_ENTRY_DEFAULT
    setItems([
      {
        key: `item-${++itemKeyCounter}`,
        item_name: label,
        quantity: '1',
        cost_price: bookCostNum > 0 ? String(bookCostNum) : '',
        selling_price: bookPriceNum > 0 ? String(bookPriceNum) : '',
      },
    ])
    setEntryMode('lines')
  }

  const switchToBookMode = () => {
    if (entryMode === 'book') return
    setBookLineLabel(items[0]?.item_name?.trim() || BOOK_ENTRY_DEFAULT)
    setBookCost(totalCost > 0 ? String(totalCost) : '')
    setBookPrice(totalSales > 0 ? String(totalSales) : '')
    setBookProfit(String(totalProfit))
    setEntryMode('book')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!customerName.trim()) { setError('Customer name is required.'); return }

    let saleItems: SaleItemInput[]
    let inputTotalCost: number
    let inputTotalSales: number
    let inputTotalProfit: number

    if (entryMode === 'book') {
      if (bookPriceNum <= 0) { setError('Selling price (invoice total) must be greater than zero.'); return }
      if (bookCostNum < 0) { setError('Book cost cannot be negative.'); return }
      const lineName = bookLineLabel.trim() || BOOK_ENTRY_DEFAULT
      inputTotalCost = bookCostNum
      inputTotalSales = bookPriceNum
      inputTotalProfit = bookProfitNum
      saleItems = [
        {
          item_name: lineName,
          quantity: 1,
          cost_price: bookCostNum,
          selling_price: bookPriceNum,
          profit: bookProfitNum,
        },
      ]
    } else {
      if (items.length === 0) { setError('Add at least one item.'); return }
      const hasEmpty = items.some((item) => !item.item_name.trim())
      if (hasEmpty) { setError('Item name is required for all rows.'); return }

      saleItems = items.map((item) => {
        const qty = parseInt(item.quantity) || 1
        const cp = item.cost_price.trim() !== '' ? parseFloat(item.cost_price) || 0 : 0
        const sp = parseFloat(item.selling_price) || 0
        return {
          item_name: item.item_name,
          quantity: qty,
          cost_price: cp * qty,
          selling_price: sp * qty,
          profit: sp * qty - cp * qty,
        }
      })

      inputTotalCost = saleItems.reduce((sum, i) => sum + i.cost_price, 0)
      inputTotalSales = saleItems.reduce((sum, i) => sum + i.selling_price, 0)
      inputTotalProfit = saleItems.reduce((sum, i) => sum + i.profit, 0)

      if (inputTotalSales <= 0) { setError('Total selling price must be greater than zero.'); return }
    }

    setSubmitting(true)
    try {
      if (editingSale) {
        await updateSale(editingSale.id, {
          customer_name: customerName,
          party_id: partyId,
          invoice_date: invoiceDate,
          total_cost: inputTotalCost,
          total_sales: inputTotalSales,
          total_profit: inputTotalProfit,
          payment_type: paymentType,
          notes: notes || undefined,
          items: saleItems,
        })
      } else {
        await createSale({
          customer_name: customerName,
          party_id: partyId,
          invoice_date: invoiceDate,
          total_cost: inputTotalCost,
          total_sales: inputTotalSales,
          total_profit: inputTotalProfit,
          payment_type: paymentType,
          notes: notes || undefined,
          items: saleItems,
        })
      }
      resetForm()
      setMode('list')
      loadSales()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${editingSale ? 'update' : 'create'} sale.`)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = sales.filter(
    (s) =>
      s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  const filteredTotalSales = filtered.reduce((sum, s) => sum + Number(s.total_sales), 0)
  const filteredCashSales = filtered.filter((s) => s.payment_type === 'cash' || s.payment_type === 'chequesale').reduce((sum, s) => sum + Number(s.total_sales), 0)
  const filteredTotalProfit = filtered.reduce((sum, s) => sum + Number(s.total_profit), 0)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Sales / Invoices</h1>
            <p className="text-sm text-slate-300 mt-0.5">Create and manage sales invoices</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <BookOpen size={18} />
            New Invoice
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="Total Sales" value={formatCurrency(filteredTotalSales)} icon={<ShoppingCart size={20} />} color="blue" />
          <SummaryCard title="Cash Sales" value={formatCurrency(filteredCashSales)} icon={<FileText size={20} />} color="green" />
          <SummaryCard title="Total Profit" value={formatCurrency(filteredTotalProfit)} icon={<FileText size={20} />} color={filteredTotalProfit >= 0 ? 'amber' : 'red'} />
        </div>

        {/* Filters */}
        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
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

        {/* Invoice List Table */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider w-8"></th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total Sales</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total Cost</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Profit</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Payment</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">No invoices found</td></tr>
                ) : (
                  filtered.map((sale) => (
                    <>
                      <tr key={sale.id} className="hover:bg-emerald-950/25 transition-colors">
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {expandedSale === sale.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-emerald-300 font-semibold">{sale.invoice_number}</td>
                        <td className="px-5 py-3.5 text-slate-100 font-medium">{sale.customer_name}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-100">{formatCurrency(sale.total_sales)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-300">{formatCurrency(sale.total_cost)}</td>
                        <td className={`px-5 py-3.5 text-right font-bold ${Number(sale.total_profit) > 0 ? 'text-emerald-300' : Number(sale.total_profit) < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                          {formatCurrency(sale.total_profit)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            sale.payment_type === 'cash'
                              ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-900/30'
                              : sale.payment_type === 'chequesale'
                                ? 'bg-blue-500/10 text-blue-200 border border-blue-900/30'
                                : 'bg-amber-500/10 text-amber-200 border border-amber-900/30'
                          }`}>
                            {sale.payment_type === 'chequesale' ? 'Cheque' : sale.payment_type}
                          </span>
                          {sale.payment_type === 'credit' && sale.is_finalized === false && (
                            <span className="block text-[10px] text-amber-400/90 mt-1 font-medium">Open credit</span>
                          )}
                          {sale.payment_type === 'chequesale' && sale.cheque_confirmed === false && (
                            <span className="block text-[10px] text-yellow-400/90 mt-1 font-medium">Pending</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">{formatDate(sale.invoice_date || sale.created_at)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {sale.payment_type === 'chequesale' && sale.cheque_confirmed === false && (
                              <button
                                onClick={() => handleConfirmCheque(sale.id)}
                                disabled={confirmingCheque === sale.id}
                                className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                                title="Confirm Cheque"
                              >
                                <FileText size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(sale)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(sale.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded items */}
                      {expandedSale === sale.id && sale.sale_items && sale.sale_items.length > 0 && (
                        <tr key={`${sale.id}-items`} className="bg-emerald-950/10">
                          <td colSpan={9} className="px-5 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="text-left py-1.5 pl-8">Item</th>
                                  <th className="text-center py-1.5">Qty</th>
                                  <th className="text-right py-1.5">Cost Price</th>
                                  <th className="text-right py-1.5">Selling Price</th>
                                  <th className="text-right py-1.5 pr-4">Profit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-900/10">
                                {sale.sale_items.map((si) => (
                                  <tr key={si.id}>
                                    <td className="py-1.5 pl-8 text-slate-300">{si.item_name}</td>
                                    <td className="py-1.5 text-center text-slate-400">{si.quantity || 1}</td>
                                    <td className="py-1.5 text-right text-slate-400">{formatCurrency(si.cost_price)}</td>
                                    <td className="py-1.5 text-right text-slate-300">{formatCurrency(si.selling_price)}</td>
                                    <td className={`py-1.5 text-right pr-4 font-semibold ${Number(si.profit) > 0 ? 'text-emerald-300' : Number(si.profit) < 0 ? 'text-red-300' : 'text-slate-500'}`}>
                                      {formatCurrency(si.profit)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} invoice(s) · Total: {formatCurrency(filteredTotalSales)}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Invoice">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this invoice? This will reverse all ledger impacts and cannot be undone.</p>
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
                  await deleteSale(showDeleteConfirm)
                  setShowDeleteConfirm(null)
                  loadSales()
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

      {/* Full-Page Ledger Entry View */}
      {mode === 'entry' && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#021b1a] via-[#022c2b] to-[#021b1a] overflow-y-auto">
          <div className="lg:ml-[260px] min-h-screen">
            <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-[1100px] mx-auto">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Ledger Header */}
                <div className="flex items-center gap-4 mb-2">
                  <button
                    type="button"
                    onClick={() => { setMode('list'); resetForm() }}
                    className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                      <BookOpen size={24} className="text-emerald-400" />
                      {editingSale ? 'Edit Invoice' : 'Sales Ledger'}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {editingSale ? 'Modify invoice entries' : 'Book totals: type cost, price, and profit yourself. Or use line items for per-row math.'}
                    </p>
                  </div>
                </div>

                {/* Invoice Info Bar */}
                <div className="surface rounded-2xl p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <PartyCombobox
                        parties={parties}
                        value={customerName}
                        partyId={partyId}
                        onNameChange={setCustomerName}
                        onPartySelect={(id, name) => { setPartyId(id); setCustomerName(name) }}
                        label="Customer / Party"
                        placeholder="Type to search or enter customer name..."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Type</label>
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                        className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="cash">Cash</option>
                        <option value="chequesale">Cheque</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional notes..."
                        className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Entry style: manual book totals vs line items */}
                <div className="surface rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex rounded-xl border border-emerald-900/40 p-1 bg-slate-950/50 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (entryMode !== 'book') switchToBookMode()
                      }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        entryMode === 'book' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Book totals (manual)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (entryMode !== 'lines') switchToLinesMode()
                      }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        entryMode === 'lines' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Line items
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                    <strong className="text-slate-400">Book totals:</strong> enter book cost, selling price (invoice total), and profit or loss exactly as in your ledger—saved as you type them.
                    <span className="text-slate-600"> · </span>
                    <strong className="text-slate-400">Line items:</strong> profit on each row is selling price minus cost (quantity × unit prices).
                  </p>
                </div>

                {entryMode === 'book' ? (
                  <div className="surface rounded-2xl overflow-hidden">
                    <div className="bg-emerald-950/40 px-6 py-3 border-b border-emerald-900/30">
                      <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Invoice totals (manual)</h2>
                    </div>
                    <div className="p-6 space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description on invoice</label>
                        <input
                          type="text"
                          value={bookLineLabel}
                          onChange={(e) => setBookLineLabel(e.target.value)}
                          placeholder={BOOK_ENTRY_DEFAULT}
                          className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Book cost</label>
                          <p className="text-[11px] text-slate-500 mb-1.5">Total cost / inventory out (your figure)</p>
                          <CurrencyInput
                            value={bookCost}
                            onChange={setBookCost}
                            placeholder="0.00"
                            allowBlank
                            className="w-full pl-8 pr-2 py-3 input-surface rounded-xl text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Selling price</label>
                          <p className="text-[11px] text-slate-500 mb-1.5">Invoice total (what customer pays)</p>
                          <CurrencyInput
                            value={bookPrice}
                            onChange={setBookPrice}
                            placeholder="0.00"
                            min={0}
                            className="w-full pl-8 pr-2 py-3 input-surface rounded-xl text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Profit or loss</label>
                          <p className="text-[11px] text-slate-500 mb-1.5">Type the profit or loss for this invoice (can be negative)</p>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Rs.</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={bookProfit}
                              onChange={(e) => setBookProfit(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-12 pr-3 py-3 input-surface rounded-xl text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 border border-emerald-900/30 bg-emerald-950/20 rounded-xl px-4 py-3">
                        Reference only — <span className="text-slate-400">selling − book cost</span> ={' '}
                        <span className="font-semibold text-slate-300">{formatCurrency(bookSuggestedProfit)}</span>
                        . Your saved profit is the value you typed above, not this calculation.
                      </p>
                    </div>
                    <div className="border-t-2 border-emerald-900/40 bg-emerald-950/30">
                      <div className="px-6 py-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Summary (what you entered)</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-900/20">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Book cost</p>
                            <p className="text-xl font-bold text-slate-100">{formatCurrency(bookCostNum)}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-900/20">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Selling price</p>
                            <p className="text-xl font-bold text-blue-300">{formatCurrency(bookPriceNum)}</p>
                          </div>
                          <div className={`rounded-xl p-4 border ${bookProfitNum > 0 ? 'bg-emerald-950/40 border-emerald-900/30' : bookProfitNum < 0 ? 'bg-red-950/40 border-red-900/30' : 'bg-slate-900/50 border-emerald-900/20'}`}>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Your profit / loss</p>
                            <p className={`text-xl font-bold ${bookProfitNum > 0 ? 'text-emerald-300' : bookProfitNum < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                              {formatCurrency(bookProfitNum)}
                            </p>
                          </div>
                        </div>
                        {paymentType === 'cash' ? (
                          <p className="text-xs text-emerald-300/70 mt-3">Cash sale: inventory decreases by book cost, cash increases by selling price</p>
                        ) : paymentType === 'chequesale' ? (
                          <p className="text-xs text-blue-300/70 mt-3">Cheque sale: inventory decreases by book cost, on cheque increases by selling price</p>
                        ) : (
                          <p className="text-xs text-amber-300/70 mt-3">Credit sale: inventory decreases by book cost, receivables increase by selling price</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="surface rounded-2xl overflow-hidden">
                  <div className="bg-emerald-950/40 px-6 py-3 border-b border-emerald-900/30 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Invoice Items</h2>
                    <button
                      type="button"
                      onClick={addItem}
                      className="flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-900/30 transition-colors"
                    >
                      <Plus size={15} /> Add Row
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-emerald-900/40 bg-emerald-950/20">
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-10">#</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Item</th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-28">Qty</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-36">Cost Price</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-36">Selling Price</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-32">Profit (auto)</th>
                          <th className="w-10 px-2 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-900/20">
                        {items.map((item, index) => {
                          const profit = calcItemProfit(item)
                          return (
                            <tr key={item.key} className={`transition-colors ${profit > 0 ? 'hover:bg-emerald-950/15' : profit < 0 ? 'hover:bg-red-950/15' : 'hover:bg-emerald-950/15'}`}>
                              <td className="px-4 py-3 text-slate-500 font-mono text-xs">{index + 1}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={item.item_name}
                                  onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                                  placeholder="Item name"
                                  className="w-full px-3 py-2.5 input-surface rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                  required
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                  min={1}
                                  className="w-full px-4 py-2.5 input-surface rounded-lg text-sm text-center font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                                  style={{ MozAppearance: 'textfield' }}
                                  required
                                />
                              </td>
                              <td className="px-4 py-3">
                                <CurrencyInput
                                  value={item.cost_price}
                                  onChange={(v) => updateItem(index, 'cost_price', v)}
                                  placeholder="—"
                                  allowBlank
                                  className="w-full pl-8 pr-2 py-2.5 input-surface rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <CurrencyInput
                                  value={item.selling_price}
                                  onChange={(v) => updateItem(index, 'selling_price', v)}
                                  placeholder="0.00"
                                  min={0}
                                  className="w-full pl-8 pr-2 py-2.5 input-surface rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${profit > 0 ? 'text-emerald-300' : profit < 0 ? 'text-red-300' : 'text-slate-500'}`}>
                                {formatCurrency(profit)}
                              </td>
                              <td className="px-2 py-3">
                                {items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-950/30 transition-all"
                                    title="Remove row"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Totals Table */}
                  <div className="border-t-2 border-emerald-900/40 bg-emerald-950/30">
                    <div className="px-6 py-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Summary</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-900/20">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Cost</p>
                          <p className="text-xl font-bold text-slate-100">{formatCurrency(totalCost)}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-900/20">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Sales</p>
                          <p className="text-xl font-bold text-blue-300">{formatCurrency(totalSales)}</p>
                        </div>
                        <div className={`rounded-xl p-4 border ${totalProfit > 0 ? 'bg-emerald-950/40 border-emerald-900/30' : totalProfit < 0 ? 'bg-red-950/40 border-red-900/30' : 'bg-slate-900/50 border-emerald-900/20'}`}>
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Profit</p>
                          <p className={`text-xl font-bold ${totalProfit > 0 ? 'text-emerald-300' : totalProfit < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                            {formatCurrency(totalProfit)}
                          </p>
                        </div>
                      </div>
                      {paymentType === 'cash' ? (
                        <p className="text-xs text-emerald-300/70 mt-3">Cash sale: inventory decreases by cost, cash increases by sales amount</p>
                      ) : paymentType === 'chequesale' ? (
                        <p className="text-xs text-blue-300/70 mt-3">Cheque sale: inventory decreases by cost, on cheque increases by sales amount</p>
                      ) : (
                        <p className="text-xs text-amber-300/70 mt-3">Credit sale: inventory decreases by cost, receivables increase by sales amount</p>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {error && (
                  <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3">{error}</div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-1 pb-8">
                  <button
                    type="button"
                    onClick={() => { setMode('list'); resetForm() }}
                    className="flex-1 px-4 py-3.5 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
                  >
                    Cancel & Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3.5 gradient-primary text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {submitting ? (editingSale ? 'Saving...' : 'Creating...') : (editingSale ? 'Save Changes' : 'Save Invoice')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
