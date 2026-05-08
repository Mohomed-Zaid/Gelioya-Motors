import { useState, useEffect } from 'react'
import { BarChart3, Search, DollarSign } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { getReportStats, getLedger } from '../services/businessService'
import type { ReportStats } from '../types'
import { formatCurrency } from '../lib/utils'

export function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [inventoryValue, setInventoryValue] = useState(0)
  const [cashInHand, setCashInHand] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadData = async () => {
    try {
      const [reportData, ledger] = await Promise.all([
        getReportStats(dateFrom || undefined, dateTo ? `${dateTo}T23:59:59` : undefined),
        getLedger(),
      ])
      setStats(reportData)
      setInventoryValue(ledger?.inventory_value ?? 0)
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

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      </AppShell>
    )
  }

  if (!stats) return null

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-300 mt-0.5">Sales, purchases & movement summaries</p>
        </div>

        {/* Date Filters */}
        <div className="surface rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center">
          <Search size={16} className="text-slate-400" />
          <span className="text-sm text-slate-300 font-medium">Filter by date:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-sm text-emerald-300 hover:text-emerald-200 font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Current Position */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard title="Current Inventory Value" value={formatCurrency(inventoryValue)} icon={<BarChart3 size={20} />} color="blue" />
          <SummaryCard title="Current Cash in Hand" value={formatCurrency(cashInHand)} icon={<DollarSign size={20} />} color="green" />
        </div>

        {/* Sales Summary */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-900/30">
            <h2 className="font-semibold text-slate-100">Sales Summary</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sales</p>
              <p className="mt-1.5 text-xl font-bold text-slate-100">{formatCurrency(stats.totalSales)}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.salesCount} invoice(s)</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Sales</p>
              <p className="mt-1.5 text-xl font-bold text-emerald-300">{formatCurrency(stats.cashSales)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Credit Sales</p>
              <p className="mt-1.5 text-xl font-bold text-amber-300">{formatCurrency(stats.creditSales)}</p>
            </div>
          </div>
        </div>

        {/* Purchases Summary */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-900/30">
            <h2 className="font-semibold text-slate-100">Purchases Summary</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Purchases</p>
              <p className="mt-1.5 text-xl font-bold text-slate-100">{formatCurrency(stats.totalPurchases)}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.purchasesCount} purchase(s)</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Purchases</p>
              <p className="mt-1.5 text-xl font-bold text-emerald-300">{formatCurrency(stats.cashPurchases)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Credit Purchases</p>
              <p className="mt-1.5 text-xl font-bold text-red-300">{formatCurrency(stats.creditPurchases)}</p>
            </div>
          </div>
        </div>

        {/* Movement Summary */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-900/30">
            <h2 className="font-semibold text-slate-100">Movement Summary</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Receivable Collections</p>
              <p className="mt-1.5 text-xl font-bold text-emerald-300">{formatCurrency(stats.totalReceivableCollections)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Movement</p>
              <p className={`mt-1.5 text-xl font-bold ${stats.stockMovement >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {stats.stockMovement >= 0 ? '+' : ''}{formatCurrency(stats.stockMovement)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Purchases - Sales</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Movement</p>
              <p className={`mt-1.5 text-xl font-bold ${stats.cashMovement >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {stats.cashMovement >= 0 ? '+' : ''}{formatCurrency(stats.cashMovement)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Cash In - Cash Out</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
