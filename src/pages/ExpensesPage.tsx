import { useState, useEffect } from 'react'
import { Receipt, Plus, Search, Trash2, Pencil } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { Modal } from '../components/Modal'
import { SummaryCard } from '../components/SummaryCard'
import { createExpense, deleteExpense, getExpenses } from '../services/businessService'
import type { Expense, ExpenseCategory } from '../types'
import { formatCurrency, formatDate, parseCurrencyInput } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'transport', label: 'Transport' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'misc', label: 'Miscellaneous' },
]

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  salary: 'bg-blue-500/10 text-blue-200 border border-blue-900/30',
  rent: 'bg-purple-500/10 text-purple-200 border border-purple-900/30',
  electricity: 'bg-yellow-500/10 text-yellow-200 border border-yellow-900/30',
  transport: 'bg-cyan-500/10 text-cyan-200 border border-cyan-900/30',
  repairs: 'bg-orange-500/10 text-orange-200 border border-orange-900/30',
  misc: 'bg-slate-500/10 text-slate-200 border border-slate-800/30',
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('misc')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const loadExpenses = async () => {
    try {
      const data = await getExpenses(
        dateFrom || undefined,
        dateTo ? `${dateTo}T23:59:59` : undefined
      )
      setExpenses(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExpenses()
  }, [dateFrom, dateTo])

  const resetForm = () => {
    setTitle('')
    setCategory('misc')
    setAmount('')
    setNotes('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const amountNum = parseCurrencyInput(amount)
    if (!title.trim()) { setError('Title is required.'); return }
    if (isNaN(amountNum) || amountNum <= 0) { setError('Valid amount greater than zero is required.'); return }

    setSubmitting(true)
    try {
      await createExpense({
        title,
        category,
        amount: amountNum,
        notes: notes || undefined,
      })
      resetForm()
      setShowModal(false)
      loadExpenses()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create expense.')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = expenses.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalExpenses = filtered.reduce((sum, e) => sum + Number(e.amount), 0)
  const categoryTotals = CATEGORIES.map((cat) => ({
    ...cat,
    total: filtered.filter((e) => e.category === cat.value).reduce((sum, e) => sum + Number(e.amount), 0),
  })).filter((c) => c.total > 0)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Expenses</h1>
            <p className="text-sm text-slate-300 mt-0.5">Track and manage business expenses</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="flex items-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <Plus size={18} />
            Add Expense
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={<Receipt size={20} />} color="red" />
          <SummaryCard title="Expense Count" value={String(filtered.length)} icon={<Receipt size={20} />} color="blue" />
          <SummaryCard title="Categories" value={String(categoryTotals.length)} icon={<Receipt size={20} />} color="amber" />
        </div>

        {/* Category Breakdown */}
        {categoryTotals.length > 0 && (
          <div className="surface rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">By Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {categoryTotals.map((cat) => (
                <div key={cat.value} className="rounded-xl bg-slate-900/50 border border-slate-800/50 p-3">
                  <p className="text-xs text-slate-400 mb-1">{cat.label}</p>
                  <p className="text-sm font-bold text-slate-100">{formatCurrency(cat.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses..."
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

        {/* Table */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Title</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Category</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Notes</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No expenses found</td></tr>
                ) : (
                  filtered.map((expense) => (
                    <tr key={expense.id} className="hover:bg-emerald-950/25 transition-colors">
                      <td className="px-5 py-3.5 text-slate-100 font-medium">{expense.title}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${CATEGORY_COLORS[expense.category]}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-red-300">-{formatCurrency(expense.amount)}</td>
                      <td className="px-5 py-3.5 text-slate-400 max-w-[200px] truncate">{expense.notes || '\u2014'}</td>
                      <td className="px-5 py-3.5 text-slate-400">{formatDate(expense.created_at)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => setShowDeleteConfirm(expense.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} expense(s) · Total: {formatCurrency(totalExpenses)}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Expense">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Are you sure you want to delete this expense? The amount will be restored to Cash in Hand.</p>
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
                  await deleteExpense(showDeleteConfirm)
                  setShowDeleteConfirm(null)
                  loadExpenses()
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

      {/* Create Expense Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }} title="Add Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Rent"
              className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Amount (Rs.)</label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              min={0.01}
              className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes..."
              className="w-full px-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
