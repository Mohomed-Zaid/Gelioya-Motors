import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, Banknote, HandCoins, ShoppingCart, Truck, ArrowUpRight, ArrowDownRight, Clock, Wrench, AlertCircle, Receipt } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { getDashboardStats, getRecentTransactions, getLedger } from '../services/businessService'
import type { DashboardStats, RecentTransaction } from '../types'
import { formatCurrency, formatDateTime } from '../lib/utils'

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<RecentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [noLedger, setNoLedger] = useState(false)
  const [dbError, setDbError] = useState('')

  const loadDashboard = async () => {
    try {
      const ledger = await getLedger()
      if (!ledger) {
        setNoLedger(true)
        setLoading(false)
        return
      }
      const [s, r] = await Promise.all([
        getDashboardStats(),
        getRecentTransactions(8),
      ])
      setStats(s)
      setRecent(r)
    } catch (err) {
      console.error('Dashboard load error:', err)
      setDbError(err instanceof Error ? err.message : 'Failed to connect to database')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
        </div>
      </AppShell>
    )
  }

  if (noLedger) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-fade-in">
          <div className="w-20 h-20 gradient-primary rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
            <Wrench size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Welcome to Gelioya Motors</h2>
          <p className="text-slate-300 text-sm mb-8 max-w-md">
            Set up your opening balances to get started with the business management system.
          </p>
          <button
            onClick={() => navigate('/setup')}
            className="gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Set Up Opening Balances
          </button>
        </div>
      </AppShell>
    )
  }

  if (dbError || !stats) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-fade-in">
          <div className="w-20 h-20 gradient-danger rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-red-500/30">
            <AlertCircle size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Connection Error</h2>
          <p className="text-slate-300 text-sm mb-2 max-w-md">
            Could not connect to the database. Please check your Supabase configuration.
          </p>
          <p className="text-red-200 text-xs mb-8 max-w-md bg-red-950/30 border border-red-900/40 px-4 py-2 rounded-xl">{dbError}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/setup')}
              className="gradient-primary text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/20"
            >
              Go to Setup
            </button>
            <button
              onClick={loadDashboard}
              className="border border-emerald-900/40 bg-emerald-950/20 text-slate-100 px-6 py-3 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  const netPosition = stats.cashInHand + stats.receivablesTotal + stats.onCheque - stats.payablesTotal

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
            <p className="text-sm text-slate-300 mt-0.5">Business overview at a glance</p>
          </div>
          <div className="text-xs text-slate-300 surface px-3 py-1.5 rounded-xl">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Core Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Inventory Value"
            value={formatCurrency(stats.inventoryValue)}
            icon={<Package size={22} />}
            color="blue"
          />
          <SummaryCard
            title="Cash in Hand"
            value={formatCurrency(stats.cashInHand)}
            icon={<Banknote size={22} />}
            color="green"
          />
          <SummaryCard
            title="Receivables"
            value={formatCurrency(stats.receivablesTotal)}
            icon={<HandCoins size={22} />}
            color="amber"
          />
          <SummaryCard
            title="Payables"
            value={formatCurrency(stats.payablesTotal)}
            icon={<HandCoins size={22} />}
            color="red"
          />
          <SummaryCard
            title="On Cheque"
            value={formatCurrency(stats.onCheque)}
            icon={<Banknote size={22} />}
            color="blue"
          />
          <SummaryCard
            title="Net Position"
            value={formatCurrency(netPosition)}
            icon={<Banknote size={22} />}
            color="purple"
            trendLabel="Cash + Recv. + Chq. - Pay."
          />
        </div>

        {/* Today's Activity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard
            title="Today's Sales"
            value={formatCurrency(stats.todaySales)}
            icon={<ShoppingCart size={22} />}
            color="green"
            trendLabel={`${stats.todaySalesCount} invoice(s)`}
          />
          <SummaryCard
            title="Today's Purchases"
            value={formatCurrency(stats.todayPurchases)}
            icon={<Truck size={22} />}
            color="red"
            trendLabel={`${stats.todayPurchasesCount} purchase(s)`}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/sales"
            className="flex items-center gap-3 p-4 surface rounded-2xl card-hover"
          >
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShoppingCart size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Sales</p>
              <p className="text-xs text-slate-300">Create invoice</p>
            </div>
          </Link>
          <Link
            to="/purchases"
            className="flex items-center gap-3 p-4 surface rounded-2xl card-hover"
          >
            <div className="w-10 h-10 gradient-success rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Truck size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Purchases</p>
              <p className="text-xs text-slate-300">Add stock</p>
            </div>
          </Link>
          <Link
            to="/receivables"
            className="flex items-center gap-3 p-4 surface rounded-2xl card-hover"
          >
            <div className="w-10 h-10 gradient-warning rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20">
              <HandCoins size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Receivables</p>
              <p className="text-xs text-slate-300">Collect payment</p>
            </div>
          </Link>
          <Link
            to="/expenses"
            className="flex items-center gap-3 p-4 surface rounded-2xl card-hover"
          >
            <div className="w-10 h-10 gradient-purple rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20">
              <Receipt size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Expenses</p>
              <p className="text-xs text-slate-300">Track expenses</p>
            </div>
          </Link>
        </div>

        {/* Recent Transactions */}
        <div className="surface rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-900/30 flex items-center gap-2">
            <Clock size={18} className="text-slate-300" />
            <h2 className="font-semibold text-slate-100">Recent Transactions</h2>
          </div>
          {recent.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 bg-emerald-950/40 border border-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Clock size={20} className="text-slate-300" />
              </div>
              <p className="text-slate-200 text-sm font-medium">No transactions yet</p>
              <p className="text-slate-400 text-xs mt-1">Create your first sale or purchase to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-emerald-900/20">
              {recent.map((tx) => (
                <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-emerald-950/25 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        tx.direction === 'in' ? 'bg-emerald-500/10 border border-emerald-900/30' : 'bg-red-500/10 border border-red-900/30'
                      }`}
                    >
                      {tx.direction === 'in' ? (
                        <ArrowUpRight size={16} className="text-emerald-300" />
                      ) : (
                        <ArrowDownRight size={16} className="text-red-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{tx.description}</p>
                      <p className="text-xs text-slate-400">
                        {tx.reference} · {formatDateTime(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      tx.direction === 'in' ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {tx.direction === 'in' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
