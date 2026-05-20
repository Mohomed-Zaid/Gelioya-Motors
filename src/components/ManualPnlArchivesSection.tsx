import { useCallback, useEffect, useState } from 'react'
import { BookMarked, ChevronDown, ChevronUp, FileDown, Loader2, Trash2 } from 'lucide-react'
import {
  deleteManualPnlReport,
  getManualPnlReportById,
  getManualPnlReportSummaries,
} from '../services/businessService'
import type { ManualPnlReport, ManualPnlReportSummary } from '../types'
import { downloadManualProfitLossPdf } from '../lib/manualProfitLossPdf'
import { formatCurrency, formatDate, formatDateTime } from '../lib/utils'

function profitColorClass(p: number): string {
  if (p > 0) return 'text-emerald-400 font-semibold'
  if (p < 0) return 'text-red-400 font-semibold'
  return 'text-slate-500 font-medium'
}

function rowProfit(sales: number, cost: number, expense: number): number {
  return (Number(sales) || 0) - (Number(cost) || 0) - (Number(expense) || 0)
}

export function ManualPnlArchivesSection() {
  const [summaries, setSummaries] = useState<ManualPnlReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ManualPnlReport | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getManualPnlReportSummaries()
      setSummaries(data)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not load archived reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setLoadingDetail(true)
    setDetail(null)
    try {
      const full = await getManualPnlReportById(id)
      setDetail(full)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not load report.')
      setExpandedId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDownload = (report: ManualPnlReport) => {
    const from = report.period_from ?? ''
    const to = report.period_to ?? ''
    downloadManualProfitLossPdf({
      rows: report.report_data,
      totals: {
        sales: report.total_sales,
        cost: report.total_cost,
        expense: report.total_expenses,
        net: report.net_profit,
      },
      dateFrom: from,
      dateTo: to,
      search: '',
      subtitle: report.title,
      filename: `manual-pnl-archive-${from || 'report'}.pdf`,
    })
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    setError('')
    try {
      await deleteManualPnlReport(id)
      if (expandedId === id) {
        setExpandedId(null)
        setDetail(null)
      }
      setDeleteId(null)
      await load()
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not delete report.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section id="manual-pnl-archives" className="surface rounded-2xl overflow-hidden scroll-mt-6">
      <div className="px-6 py-4 border-b border-emerald-900/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-800/40 bg-amber-950/40">
            <BookMarked className="text-amber-400" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100">Manual P&amp;L archives</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved automatically when you clear the notebook for a new month
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-900/45 bg-red-950/35 text-red-200 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-emerald-400" size={28} />
          </div>
        ) : summaries.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10 leading-relaxed max-w-md mx-auto">
            No archived reports yet. When you use <strong className="text-slate-400">Clear all</strong> on Manual
            P&amp;L, that month&apos;s notebook is saved here before the sheet is emptied.
          </p>
        ) : (
          <ul className="space-y-3">
            {summaries.map((s) => {
              const open = expandedId === s.id
              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-slate-700/60 bg-slate-950/30 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => void toggleExpand(s.id)}
                    className="w-full flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 text-left hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Archived {formatDateTime(s.archived_at)}
                        {s.period_from && s.period_to && (
                          <span>
                            {' '}
                            · {formatDate(s.period_from)}
                            {s.period_from !== s.period_to && ` – ${formatDate(s.period_to)}`}
                          </span>
                        )}
                        {' '}
                        · {s.row_count} line{s.row_count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Net profit</p>
                        <p className={`font-mono font-bold tabular-nums ${profitColorClass(s.net_profit)}`}>
                          {formatCurrency(s.net_profit)}
                        </p>
                      </div>
                      {open ? (
                        <ChevronUp size={20} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={20} className="text-slate-500" />
                      )}
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-slate-800/80 px-4 py-4 bg-slate-950/40">
                      {loadingDetail ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="animate-spin text-emerald-400" size={24} />
                        </div>
                      ) : detail && detail.id === s.id ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="rounded-lg border border-slate-700/50 px-3 py-2 text-right">
                              <p className="text-[10px] uppercase text-slate-500">Sales</p>
                              <p className="font-mono text-sm text-sky-300">{formatCurrency(detail.total_sales)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-700/50 px-3 py-2 text-right">
                              <p className="text-[10px] uppercase text-slate-500">Cost</p>
                              <p className="font-mono text-sm text-amber-200">{formatCurrency(detail.total_cost)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-700/50 px-3 py-2 text-right">
                              <p className="text-[10px] uppercase text-slate-500">Expenses</p>
                              <p className="font-mono text-sm text-orange-300">
                                {formatCurrency(detail.total_expenses)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-emerald-900/40 px-3 py-2 text-right">
                              <p className="text-[10px] uppercase text-slate-500">Net</p>
                              <p className={`font-mono text-sm ${profitColorClass(detail.net_profit)}`}>
                                {formatCurrency(detail.net_profit)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-4">
                            <button
                              type="button"
                              onClick={() => handleDownload(detail)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600"
                            >
                              <FileDown size={16} />
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(s.id)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-300 border border-red-900/50 hover:bg-red-950/40"
                            >
                              <Trash2 size={16} />
                              Delete archive
                            </button>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-slate-800">
                            <table className="w-full min-w-[640px] text-sm">
                              <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Description</th>
                                  <th className="px-3 py-2 text-right">Sales</th>
                                  <th className="px-3 py-2 text-right">Cost</th>
                                  <th className="px-3 py-2 text-right">Expense</th>
                                  <th className="px-3 py-2 text-right">Profit</th>
                                  <th className="px-3 py-2">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/80">
                                {detail.report_data.map((r, i) => {
                                  const p = rowProfit(r.sales_amount, r.cost_amount, r.expense_amount)
                                  return (
                                    <tr key={i} className="text-slate-300">
                                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.entry_date)}</td>
                                      <td className="px-3 py-2">{r.description || '—'}</td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                                        {formatCurrency(r.sales_amount)}
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                                        {formatCurrency(r.cost_amount)}
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                                        {formatCurrency(r.expense_amount)}
                                      </td>
                                      <td className={`px-3 py-2 text-right font-mono tabular-nums ${profitColorClass(p)}`}>
                                        {formatCurrency(p)}
                                      </td>
                                      <td className="px-3 py-2 text-slate-500">{r.notes || '—'}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4">
          <div className="surface-2 rounded-2xl max-w-sm w-full p-6 border border-slate-600">
            <h3 className="text-lg font-bold text-slate-50">Delete this archive?</h3>
            <p className="text-sm text-slate-400 mt-2">
              The saved notebook copy will be removed. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
