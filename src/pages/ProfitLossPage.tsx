import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import html2pdf from 'html2pdf.js'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { getDashboardStats, getMonthlyProfitTrend, getTopProfitInvoices, getTopLossInvoices, getSales, getExpenses } from '../services/businessService'
import type { DashboardStats, MonthlyProfitTrend, Sale, Expense } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'

type MonthlyBreakdown = {
  month: string
  profit: number
  loss: number
  expenses: number
  net: number
  sales: Sale[]
  expensesList: Expense[]
}

export function ProfitLossPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trend, setTrend] = useState<MonthlyProfitTrend[]>([])
  const [topProfit, setTopProfit] = useState<Sale[]>([])
  const [topLoss, setTopLoss] = useState<Sale[]>([])
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [downloading, setDownloading] = useState(false)

  const loadData = async () => {
    try {
      const [s, t, pI, lI, sl, exp] = await Promise.all([
        getDashboardStats(), getMonthlyProfitTrend(12),
        getTopProfitInvoices(5), getTopLossInvoices(5),
        getSales(dateFrom || undefined, dateTo || undefined),
        getExpenses(dateFrom || undefined, dateTo || undefined),
      ])
      setStats(s); setTrend(t); setTopProfit(pI); setTopLoss(lI); setAllSales(sl); setAllExpenses(exp)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [dateFrom, dateTo])

  // Auto-download monthly P&L report at end of month
  useEffect(() => {
    const checkAndAutoDownload = () => {
      const now = new Date()
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      // If it's the last day of the month and we haven't downloaded yet this month
      if (now.getDate() === lastDay) {
        const key = `pnl_downloaded_${now.getFullYear()}_${now.getMonth() + 1}`
        if (!localStorage.getItem(key)) {
          // Wait for data to load, then download
          setTimeout(() => {
            handleDownloadPDF(true)
            localStorage.setItem(key, '1')
          }, 3000)
        }
      }
    }
    checkAndAutoDownload()
  }, [loading])

  const handleDownloadPDF = async (isAuto = false) => {
    setDownloading(true)
    try {
      const now = new Date()
      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })
      const filename = isAuto
        ? `PnL_Report_${monthName.replace(' ', '_')}.pdf`
        : `PnL_Report_${dateFrom || 'all'}_to_${dateTo || 'all'}.pdf`

      // Build a white-background print-friendly HTML for the PDF
      const totalProfit = hf ? fP : stats!.totalProfit
      const totalLoss = Math.abs(hf ? fL : stats!.totalLoss)
      const netProfit = hf ? fN : stats!.netProfit
      const totalExpenses = stats!.totalExpenses

      const pdfHtml = document.createElement('div')
      pdfHtml.style.cssText = 'padding:20px;font-family:Arial,sans-serif;color:#1e293b;background:#fff;width:100%;'
      pdfHtml.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="margin:0;color:#0d9488;font-size:22px;">Gelioya Motors</h1>
          <h2 style="margin:4px 0;color:#334155;font-size:16px;">Profit & Loss Report</h2>
          <p style="margin:0;color:#64748b;font-size:12px;">${dateFrom ? formatDate(dateFrom) : 'All'} to ${dateTo ? formatDate(dateTo) : 'All'} · Generated: ${now.toLocaleDateString()}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="padding:10px;border:1px solid #e2e8f0;text-align:center;background:#f0fdf4;"><strong style="color:#16a34a;">Total Profit</strong><br><span style="font-size:18px;font-weight:bold;color:#16a34a;">${formatCurrency(totalProfit)}</span></td>
            <td style="padding:10px;border:1px solid #e2e8f0;text-align:center;background:#fef2f2;"><strong style="color:#dc2626;">Total Loss</strong><br><span style="font-size:18px;font-weight:bold;color:#dc2626;">${formatCurrency(totalLoss)}</span></td>
            <td style="padding:10px;border:1px solid #e2e8f0;text-align:center;background:${netProfit >= 0 ? '#f0fdf4' : '#fef2f2'};"><strong style="color:${netProfit >= 0 ? '#16a34a' : '#dc2626'};">Net Profit</strong><br><span style="font-size:18px;font-weight:bold;color:${netProfit >= 0 ? '#16a34a' : '#dc2626'};">${formatCurrency(netProfit)}</span></td>
            <td style="padding:10px;border:1px solid #e2e8f0;text-align:center;background:#fffbeb;"><strong style="color:#d97706;">Expenses</strong><br><span style="font-size:18px;font-weight:bold;color:#d97706;">${formatCurrency(totalExpenses)}</span></td>
          </tr>
        </table>
        ${monthlyBreakdown.length > 0 ? `
        <h3 style="color:#334155;font-size:14px;margin:12px 0 8px;">Monthly Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Month</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Profit</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Loss</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Expenses</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Net</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;">Invoices</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyBreakdown.map(m => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">${m.month}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;color:#16a34a;font-weight:600;">${formatCurrency(m.profit)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;color:#dc2626;font-weight:600;">${formatCurrency(m.loss)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;color:#d97706;font-weight:600;">${formatCurrency(m.expenses)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;color:${m.net >= 0 ? '#16a34a' : '#dc2626'};">${formatCurrency(m.net)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${m.sales.length}</td>
              </tr>
            `).join('')}
            <tr style="background:#f1f5f9;font-weight:bold;">
              <td style="padding:8px;border:1px solid #e2e8f0;">Total</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#16a34a;">${formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.profit, 0))}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#dc2626;">${formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.loss, 0))}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#d97706;">${formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.expenses, 0))}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:${monthlyBreakdown.reduce((s, m) => s + m.net, 0) >= 0 ? '#16a34a' : '#dc2626'};">${formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.net, 0))}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${monthlyBreakdown.reduce((s, m) => s + m.sales.length, 0)}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}
        <h3 style="color:#334155;font-size:14px;margin:12px 0 8px;">Invoice Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Invoice</th>
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Customer</th>
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:right;">Cost</th>
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:right;">Sales</th>
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:right;">Profit</th>
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:center;">Payment</th>
              <th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${allSales.map(s => `
              <tr>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;font-weight:600;">${s.invoice_number}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;">${s.customer_name}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;">${formatCurrency(s.total_cost)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatCurrency(s.total_sales)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;color:${Number(s.total_profit) >= 0 ? '#16a34a' : '#dc2626'};">${formatCurrency(s.total_profit)}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${s.payment_type}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;">${formatDate(s.invoice_date || s.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `

      // Temporarily append to DOM for rendering
      document.body.appendChild(pdfHtml)
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(pdfHtml).save()

      // Clean up
      document.body.removeChild(pdfHtml)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setDownloading(false)
    }
  }

  // Build monthly breakdown from allSales + allExpenses
  const monthlyBreakdown: MonthlyBreakdown[] = (() => {
    const map: Record<string, MonthlyBreakdown> = {}
    for (const s of allSales) {
      const d = new Date(s.invoice_date || s.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { month: key, profit: 0, loss: 0, expenses: 0, net: 0, sales: [], expensesList: [] }
      const p = Number(s.total_profit)
      if (p >= 0) map[key].profit += p
      else map[key].loss += Math.abs(p)
      map[key].sales.push(s)
    }
    for (const e of allExpenses) {
      const d = new Date(e.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { month: key, profit: 0, loss: 0, expenses: 0, net: 0, sales: [], expensesList: [] }
      map[key].expenses += Number(e.amount)
      map[key].expensesList.push(e)
    }
    for (const k of Object.keys(map)) {
      map[k].net = map[k].profit - map[k].loss - map[k].expenses
    }
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month))
  })()

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" /></div></AppShell>
  if (!stats) return null

  const fP = allSales.reduce((s, x) => s + Math.max(0, Number(x.total_profit)), 0)
  const fL = allSales.reduce((s, x) => s + Math.min(0, Number(x.total_profit)), 0)
  const fN = allSales.reduce((s, x) => s + Number(x.total_profit), 0)
  const hf = !!(dateFrom || dateTo)

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Profit & Loss</h1>
            <p className="text-sm text-slate-300 mt-0.5">Track business profitability</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 surface rounded-xl px-3 py-2">
              <Calendar size={14} className="text-slate-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none" />
              <span className="text-slate-500 text-xs">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none" />
            </div>
            {hf && <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-sm text-emerald-300 hover:text-emerald-200 font-semibold">Clear</button>}
            <button
              onClick={() => handleDownloadPDF()}
              disabled={downloading}
              className="flex items-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Download size={16} />
              {downloading ? 'Generating...' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Total Profit" value={formatCurrency(hf ? fP : stats.totalProfit)} icon={<TrendingUp size={22} />} color="green" />
            <SummaryCard title="Total Loss" value={formatCurrency(Math.abs(hf ? fL : stats.totalLoss))} icon={<TrendingDown size={22} />} color="red" />
            <SummaryCard title="Net Profit" value={formatCurrency(hf ? fN : stats.netProfit)} icon={<DollarSign size={22} />} color={(hf ? fN : stats.netProfit) >= 0 ? 'green' : 'red'} trendLabel="Profit - Loss - Expenses" />
            <SummaryCard title="Total Expenses" value={formatCurrency(stats.totalExpenses)} icon={<BarChart3 size={22} />} color="amber" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <SummaryCard title="Today's Profit" value={formatCurrency(stats.todayProfit)} icon={<TrendingUp size={22} />} color={stats.todayProfit >= 0 ? 'green' : 'red'} />
            <SummaryCard title="Monthly Profit" value={formatCurrency(stats.monthProfit)} icon={<BarChart3 size={22} />} color={stats.monthProfit >= 0 ? 'green' : 'red'} />
            <SummaryCard title="Yearly Profit" value={formatCurrency(stats.yearProfit)} icon={<TrendingUp size={22} />} color={stats.yearProfit >= 0 ? 'green' : 'red'} />
          </div>
        </div>

        {trend.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Monthly Profit Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Area type="monotone" dataKey="profit" stroke="#34d399" fill="url(#pGrad)" strokeWidth={2} name="Profit" />
                  <Area type="monotone" dataKey="loss" stroke="#f87171" fill="url(#lGrad)" strokeWidth={2} name="Loss" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Revenue vs Cost</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trend}>
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="surface rounded-2xl p-8 text-center">
            <BarChart3 size={32} className="text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No chart data yet. Create invoices to see profit trends and revenue charts.</p>
          </div>
        )}

        {/* Top Profit & Loss Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {topProfit.length > 0 && (
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-emerald-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ArrowUpRight size={16} /> Top Profit Invoices
              </h3>
              <div className="space-y-2">
                {topProfit.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{s.customer_name}</p>
                      <p className="text-xs text-slate-400">{s.invoice_number} · {formatDate(s.invoice_date || s.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-300">+{formatCurrency(s.total_profit)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topLoss.length > 0 && (
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-red-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ArrowDownRight size={16} /> Top Loss Invoices
              </h3>
              <div className="space-y-2">
                {topLoss.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-red-950/20 border border-red-900/30">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{s.customer_name}</p>
                      <p className="text-xs text-slate-400">{s.invoice_number} · {formatDate(s.invoice_date || s.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-red-300">{formatCurrency(s.total_profit)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly Profit & Loss Breakdown */}
        {monthlyBreakdown.length > 0 && (
          <div className="surface rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-emerald-900/30">
              <h2 className="font-semibold text-slate-100">Monthly Profit & Loss Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                    <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Month</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Profit</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Loss</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Expenses</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Net</th>
                    <th className="text-center px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Invoices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-900/20">
                  {monthlyBreakdown.map((m) => (
                    <tr key={m.month} className="hover:bg-emerald-950/25 transition-colors">
                      <td className="px-5 py-3 text-slate-100 font-semibold">{m.month}</td>
                      <td className="px-5 py-3 text-right text-emerald-300 font-semibold">{formatCurrency(m.profit)}</td>
                      <td className="px-5 py-3 text-right text-red-300 font-semibold">{formatCurrency(m.loss)}</td>
                      <td className="px-5 py-3 text-right text-amber-300 font-semibold">{formatCurrency(m.expenses)}</td>
                      <td className={`px-5 py-3 text-right font-bold ${m.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(m.net)}</td>
                      <td className="px-5 py-3 text-center text-slate-400">{m.sales.length}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-950/30 border-t border-emerald-900/30">
                    <td className="px-5 py-3 font-bold text-slate-100">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-300">{formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.profit, 0))}</td>
                    <td className="px-5 py-3 text-right font-bold text-red-300">{formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.loss, 0))}</td>
                    <td className="px-5 py-3 text-right font-bold text-amber-300">{formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.expenses, 0))}</td>
                    <td className={`px-5 py-3 text-right font-bold ${monthlyBreakdown.reduce((s, m) => s + m.net, 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(monthlyBreakdown.reduce((s, m) => s + m.net, 0))}</td>
                    <td className="px-5 py-3 text-center text-slate-400">{monthlyBreakdown.reduce((s, m) => s + m.sales.length, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Invoice Profit Breakdown Table */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-900/30">
            <h2 className="font-semibold text-slate-100">Invoice Profit Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Cost</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Sales</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Profit</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Payment</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {allSales.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">No invoices found</td></tr>
                ) : allSales.map((s) => (
                  <tr key={s.id} className="hover:bg-emerald-950/25 transition-colors">
                    <td className="px-5 py-3 font-mono text-emerald-300 font-semibold">{s.invoice_number}</td>
                    <td className="px-5 py-3 text-slate-100 font-medium">{s.customer_name}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{formatCurrency(s.total_cost)}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-100">{formatCurrency(s.total_sales)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${Number(s.total_profit) > 0 ? 'text-emerald-300' : Number(s.total_profit) < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                      {formatCurrency(s.total_profit)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${s.payment_type === 'cash' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-900/30' : 'bg-amber-500/10 text-amber-200 border border-amber-900/30'}`}>
                        {s.payment_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{formatDate(s.invoice_date || s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allSales.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400 flex gap-6">
              <span>Total Cost: <strong className="text-slate-200">{formatCurrency(allSales.reduce((s, x) => s + Number(x.total_cost), 0))}</strong></span>
              <span>Total Sales: <strong className="text-blue-300">{formatCurrency(allSales.reduce((s, x) => s + Number(x.total_sales), 0))}</strong></span>
              <span>Total Profit: <strong className={fN >= 0 ? 'text-emerald-300' : 'text-red-300'}>{formatCurrency(fN)}</strong></span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
