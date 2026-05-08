import { useState, useEffect } from 'react'
import { BookOpen, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { getCashTransactions, getLedger } from '../services/businessService'
import type { CashTransaction } from '../types'
import { formatCurrency, formatDateTime } from '../lib/utils'

const typeLabels: Record<string, string> = {
  sale_cash: 'Cash Sale',
  sale_credit: 'Credit Sale',
  purchase_cash: 'Cash Purchase',
  purchase_credit: 'Credit Purchase',
  receivable_collection: 'Receivable Collection',
}

export function CashLedgerPage() {
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [cashInHand, setCashInHand] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadData = async () => {
    try {
      const [txData, ledger] = await Promise.all([
        getCashTransactions(
          dateFrom || undefined,
          dateTo ? `${dateTo}T23:59:59` : undefined
        ),
        getLedger(),
      ])
      setTransactions(txData)
      setCashInHand(ledger?.cash_in_hand ?? 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo])

  const filtered = transactions.filter((tx) => {
    const label = typeLabels[tx.type] || tx.type
    const matchesSearch = label.toLowerCase().includes(search.toLowerCase()) || (tx.notes || '').toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const totalIn = filtered.filter((tx) => tx.direction === 'in').reduce((sum, tx) => sum + Number(tx.amount), 0)
  const totalOut = filtered.filter((tx) => tx.direction === 'out').reduce((sum, tx) => sum + Number(tx.amount), 0)

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Cash Ledger</h1>
          <p className="text-sm text-slate-300 mt-0.5">Complete cash movement history</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="Cash in Hand" value={formatCurrency(cashInHand)} icon={<BookOpen size={20} />} color="green" />
          <SummaryCard title="Total Cash In" value={formatCurrency(totalIn)} icon={<ArrowUpRight size={20} />} color="blue" />
          <SummaryCard title="Total Cash Out" value={formatCurrency(totalOut)} icon={<ArrowDownRight size={20} />} color="red" />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
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
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Reference</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Description</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Direction</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No cash transactions found</td></tr>
                ) : (
                  filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-emerald-950/25 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-100">{tx.type}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{tx.reference_type}/{tx.reference_id.slice(0,8)}</td>
                      <td className="px-5 py-3.5 text-slate-300">{tx.notes || '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          tx.direction === 'in'
                            ? 'bg-emerald-500/10 text-emerald-200 border-emerald-900/30'
                            : 'bg-red-500/10 text-red-200 border-red-900/30'
                        }`}>
                          {tx.direction === 'in' ? '↑ In' : '↓ Out'}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-right font-bold ${
                        tx.direction === 'in' ? 'text-emerald-300' : 'text-red-300'
                      }`}>
                        {tx.direction === 'in' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} transaction(s) · Cash In: {formatCurrency(totalIn)} · Cash Out: {formatCurrency(totalOut)}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
