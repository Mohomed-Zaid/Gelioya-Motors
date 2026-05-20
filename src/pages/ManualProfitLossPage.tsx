import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookMarked,
  CalendarRange,
  Eraser,
  FileDown,
  Filter,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import {
  archiveAndClearManualProfitLoss,
  createManualProfitLossEntry,
  deleteManualProfitLossEntry,
  getManualProfitLossEntries,
  updateManualProfitLossEntry,
} from '../services/businessService'
import type { ManualProfitLoss, ManualProfitLossInput } from '../types'
import { downloadManualProfitLossPdf } from '../lib/manualProfitLossPdf'
import { formatCurrency, todayISO } from '../lib/utils'

function rowProfit(sales: number, cost: number, expense: number): number {
  return (Number(sales) || 0) - (Number(cost) || 0) - (Number(expense) || 0)
}

function profitColorClass(p: number): string {
  if (p > 0) return 'text-emerald-400 font-semibold'
  if (p < 0) return 'text-red-400 font-semibold'
  return 'text-slate-500 font-medium'
}

function profitBgClass(p: number): string {
  if (p > 0) return 'bg-emerald-950/35'
  if (p < 0) return 'bg-red-950/25'
  return 'bg-slate-900/40'
}

/** Spreadsheet cell: flat, grid-aligned */
const cellInput =
  'w-full min-w-[4.75rem] bg-transparent border-0 px-2 py-2 text-sm text-slate-100 font-mono tabular-nums shadow-none rounded-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/50 focus:bg-slate-950/50 placeholder:text-slate-600'

const textCell =
  'w-full min-w-[7rem] bg-transparent border-0 px-2 py-2 text-sm text-slate-100 shadow-none rounded-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/50 focus:bg-slate-950/50 placeholder:text-slate-600'

const gridTh =
  'px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-r border-slate-700/70 last:border-r-0 bg-slate-950/80'

const gridTd = 'border-r border-b border-slate-800/90 last:border-r-0 align-middle p-0'

export function ManualProfitLossPage() {
  const [rows, setRows] = useState<ManualProfitLoss[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showClearAll, setShowClearAll] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [clearSuccess, setClearSuccess] = useState('')

  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getManualProfitLossEntries(dateFrom || undefined, dateTo || undefined)
      setRows(data)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not load manual P&L entries.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const d = (r.description || '').toLowerCase()
      const n = (r.notes || '').toLowerCase()
      return d.includes(q) || n.includes(q)
    })
  }, [rows, search])

  const totals = useMemo(() => {
    let sales = 0
    let cost = 0
    let expense = 0
    for (const r of visibleRows) {
      sales += Number(r.sales_amount) || 0
      cost += Number(r.cost_amount) || 0
      expense += Number(r.expense_amount) || 0
    }
    const net = sales - cost - expense
    return { sales, cost, expense, net }
  }, [visibleRows])

  const filterActive = Boolean(dateFrom || dateTo || search.trim())
  const rowCountLabel = loading ? '…' : `${visibleRows.length} line${visibleRows.length === 1 ? '' : 's'}`

  const patchRow = (id: string, patch: Partial<ManualProfitLoss>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        next.profit_amount = rowProfit(next.sales_amount, next.cost_amount, next.expense_amount)
        return next
      })
    )
  }

  const persistRow = async (row: ManualProfitLoss) => {
    const input: ManualProfitLossInput = {
      entry_date: row.entry_date,
      description: row.description,
      sales_amount: Number(row.sales_amount) || 0,
      cost_amount: Number(row.cost_amount) || 0,
      expense_amount: Number(row.expense_amount) || 0,
      notes: row.notes,
    }
    setSavingId(row.id)
    try {
      const updated = await updateManualProfitLossEntry(row.id, input)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Save failed.')
      await load()
    } finally {
      setSavingId(null)
    }
  }

  const flushRow = (id: string) => {
    const cur = rowsRef.current.find((r) => r.id === id)
    if (cur) void persistRow(cur)
  }

  const handleAddRow = async () => {
    setError('')
    try {
      const created = await createManualProfitLossEntry({
        entry_date: todayISO(),
        description: '',
        sales_amount: 0,
        cost_amount: 0,
        expense_amount: 0,
        notes: null,
      })
      setRows((prev) => [created, ...prev])
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not add row.')
    }
  }

  const handleDelete = async (id: string) => {
    setError('')
    try {
      await deleteManualProfitLossEntry(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
      setDeleteId(null)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  const handleDownloadPdf = () => {
    if (visibleRows.length === 0) {
      setError('No rows to export. Add entries or adjust your filters.')
      return
    }
    setError('')
    setExportingPdf(true)
    try {
      downloadManualProfitLossPdf({
        rows: visibleRows,
        totals,
        dateFrom,
        dateTo,
        search,
      })
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not create PDF.')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleClearAll = async () => {
    setError('')
    setClearingAll(true)
    try {
      const archived = await archiveAndClearManualProfitLoss()
      setRows([])
      setShowClearAll(false)
      setSearch('')
      setDateFrom('')
      setDateTo('')
      if (archived) {
        setClearSuccess(
          `"${archived.title}" saved to Reports. You can review it anytime under Manual P&L archives.`
        )
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not clear notebook.')
    } finally {
      setClearingAll(false)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col min-h-[calc(100vh-6rem)] max-w-[1680px] mx-auto gap-5 animate-fade-in pb-2">
        {/* Header band — ledger / workbook */}
        <header className="relative overflow-hidden rounded-2xl surface-2 px-5 py-5 sm:px-6 sm:py-6 shrink-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-emerald-600/10 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-800/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">
                  Manual ledger
                </span>
                {!loading && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {rowCountLabel}
                    {filterActive && visibleRows.length !== rows.length && (
                      <span className="text-slate-600"> · {rows.length} loaded</span>
                    )}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-800/40 bg-gradient-to-br from-amber-950/80 to-slate-950 shadow-inner">
                  <BookMarked className="text-amber-400" size={22} strokeWidth={1.75} />
                </span>
                <span>
                  Manual Profit &amp; Loss
                  <span className="block text-sm font-normal text-slate-500 mt-1 max-w-xl leading-relaxed">
                    Notebook-style sheet: enter dates and amounts by hand. Row profit = sales − cost − expense. Does not
                    post to sales, cash, or expenses.
                  </span>
                </span>
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={exportingPdf || loading || visibleRows.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-100 border border-slate-600/80 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {exportingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setShowClearAll(true)}
                disabled={loading || rows.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-900/60 hover:bg-red-950/50 text-amber-200/90 border border-amber-900/40 hover:border-red-800/50 hover:text-red-200 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Eraser size={18} />
                Clear all
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-b from-emerald-600 to-emerald-800 text-white border border-emerald-500/40 shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-emerald-700 transition-colors"
              >
                <Plus size={18} strokeWidth={2.25} />
                Add row
              </button>
            </div>
          </div>
        </header>

        {/* Filters toolbar */}
        <div className="surface rounded-2xl p-4 sm:p-5 flex flex-col xl:flex-row flex-wrap gap-4 items-stretch xl:items-end shrink-0">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 min-w-0">
            <div className="flex items-center gap-2 text-slate-500">
              <CalendarRange size={16} className="text-emerald-500/80 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">Date range</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 input-surface rounded-lg text-sm text-slate-200 min-h-[2.5rem]"
                aria-label="From date"
              />
              <span className="text-xs text-slate-600 font-medium px-0.5">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 input-surface rounded-lg text-sm text-slate-200 min-h-[2.5rem]"
                aria-label="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 border border-slate-700/80 hover:bg-slate-800/60 hover:text-slate-200 transition-colors"
                >
                  Reset range
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-[14rem] flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-slate-500">
              <Filter size={16} className="text-emerald-500/80 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">Search</span>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by description or notes…"
                className="w-full pl-10 pr-3 py-2.5 input-surface rounded-lg text-sm text-slate-200 placeholder:text-slate-600 min-h-[2.5rem]"
              />
            </div>
          </div>
        </div>

        {clearSuccess && (
          <div className="rounded-xl border border-emerald-800/45 bg-emerald-950/35 text-emerald-100 text-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{clearSuccess}</span>
            <Link
              to="/reports#manual-pnl-archives"
              className="shrink-0 text-sm font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
            >
              View in Reports →
            </Link>
          </div>
        )}

        {error && (
          <div
            className="rounded-xl border border-red-900/45 bg-red-950/35 text-red-100/95 text-sm px-4 py-3 flex items-start gap-3"
            role="alert"
          >
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        {/* Spreadsheet shell */}
        <div className="flex-1 min-h-[320px] flex flex-col rounded-2xl border border-slate-700/60 bg-[#050f0e] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_-28px_rgba(0,0,0,0.75)]">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/90 bg-slate-950/90">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 pl-1">
              Worksheet · manual_pnl
            </span>
            {savingId && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400/90 pr-1">
                <Loader2 size={12} className="animate-spin" />
                Saving…
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="p-4 space-y-0 border-collapse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 border-b border-slate-800/80 bg-slate-900/20 animate-pulse"
                    style={{ opacity: 1 - i * 0.12 }}
                  />
                ))}
              </div>
            ) : (
              <table className="w-full min-w-[980px] text-sm border-collapse table-fixed">
                <colgroup>
                  <col className="w-[2.75rem]" />
                  <col className="w-[9.5rem]" />
                  <col />
                  <col className="w-[7.25rem]" />
                  <col className="w-[7.25rem]" />
                  <col className="w-[7.25rem]" />
                  <col className="w-[8.25rem]" />
                  <col className="min-w-[7rem]" />
                  <col className="w-[4.25rem]" />
                </colgroup>
                <thead className="sticky top-0 z-20 shadow-[0_1px_0_rgba(15,118,110,0.25)]">
                  <tr>
                    <th className={`${gridTh} w-11 text-center text-slate-600`}>#</th>
                    <th className={gridTh}>Date</th>
                    <th className={gridTh}>Description</th>
                    <th className={`${gridTh} text-right text-sky-400/90`}>Sales</th>
                    <th className={`${gridTh} text-right text-amber-200/85`}>Cost</th>
                    <th className={`${gridTh} text-right text-orange-300/90`}>Expense</th>
                    <th className={`${gridTh} text-right text-emerald-400/90`}>Profit</th>
                    <th className={gridTh}>Notes</th>
                    <th className={`${gridTh} text-center w-[4.25rem]`}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border-b border-slate-800/80 px-6 py-20 text-center">
                        <div className="max-w-md mx-auto space-y-4">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/50 text-slate-600">
                            <BookMarked size={32} strokeWidth={1.25} />
                          </div>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            No rows match this view. Start the notebook with a blank line — you type every figure.
                          </p>
                          <button
                            type="button"
                            onClick={handleAddRow}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-800/80 hover:bg-emerald-700 text-white border border-emerald-600/30"
                          >
                            <Plus size={16} />
                            Add first row
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, idx) => {
                      const p = rowProfit(row.sales_amount, row.cost_amount, row.expense_amount)
                      const busy = savingId === row.id
                      const zebra = idx % 2 === 0 ? 'bg-slate-950/35' : 'bg-slate-900/25'
                      return (
                        <tr
                          key={row.id}
                          className={`group ${zebra} hover:bg-teal-950/20 transition-colors`}
                        >
                          <td
                            className={`${gridTd} text-center font-mono text-[11px] tabular-nums text-slate-600 group-hover:text-slate-500`}
                          >
                            {idx + 1}
                          </td>
                          <td className={`${gridTd} bg-slate-950/20`}>
                            <input
                              type="date"
                              className={`${cellInput} w-full`}
                              value={row.entry_date?.slice(0, 10) || ''}
                              onChange={(e) => patchRow(row.id, { entry_date: e.target.value })}
                              onBlur={() => flushRow(row.id)}
                            />
                          </td>
                          <td className={gridTd}>
                            <input
                              type="text"
                              className={textCell}
                              value={row.description}
                              onChange={(e) => patchRow(row.id, { description: e.target.value })}
                              onBlur={() => flushRow(row.id)}
                              placeholder="Description"
                            />
                          </td>
                          <td className={`${gridTd} bg-sky-950/15`}>
                            <input
                              type="number"
                              step="any"
                              className={`${cellInput} text-right`}
                              value={Number.isFinite(row.sales_amount) ? row.sales_amount : 0}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Number(e.target.value)
                                patchRow(row.id, { sales_amount: Number.isFinite(v) ? v : 0 })
                              }}
                              onBlur={() => flushRow(row.id)}
                            />
                          </td>
                          <td className={`${gridTd} bg-amber-950/12`}>
                            <input
                              type="number"
                              step="any"
                              className={`${cellInput} text-right`}
                              value={Number.isFinite(row.cost_amount) ? row.cost_amount : 0}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Number(e.target.value)
                                patchRow(row.id, { cost_amount: Number.isFinite(v) ? v : 0 })
                              }}
                              onBlur={() => flushRow(row.id)}
                            />
                          </td>
                          <td className={`${gridTd} bg-orange-950/12`}>
                            <input
                              type="number"
                              step="any"
                              className={`${cellInput} text-right`}
                              value={Number.isFinite(row.expense_amount) ? row.expense_amount : 0}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Number(e.target.value)
                                patchRow(row.id, { expense_amount: Number.isFinite(v) ? v : 0 })
                              }}
                              onBlur={() => flushRow(row.id)}
                            />
                          </td>
                          <td
                            className={`${gridTd} ${profitBgClass(p)} border-l border-l-slate-700/50 px-3 py-2 text-right font-mono tabular-nums text-[15px] leading-tight ${profitColorClass(p)}`}
                          >
                            {formatCurrency(p)}
                          </td>
                          <td className={gridTd}>
                            <input
                              type="text"
                              className={textCell}
                              value={row.notes || ''}
                              onChange={(e) => patchRow(row.id, { notes: e.target.value || null })}
                              onBlur={() => flushRow(row.id)}
                              placeholder="Notes"
                            />
                          </td>
                          <td className={`${gridTd} text-center p-0`}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDeleteId(row.id)}
                              className="w-full h-full min-h-[2.75rem] flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
                              title="Delete row"
                            >
                              {busy ? <Loader2 size={16} className="animate-spin text-emerald-500/80" /> : <Trash2 size={15} />}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals — ledger footer */}
          <footer className="shrink-0 sticky bottom-0 z-30 border-t-2 border-amber-700/25 bg-gradient-to-b from-slate-900/98 to-slate-950 backdrop-blur-md px-4 py-4 sm:px-5 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total sales</p>
                <p className="text-base sm:text-lg font-mono font-bold text-sky-300 tabular-nums mt-1">
                  {formatCurrency(totals.sales)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total cost</p>
                <p className="text-base sm:text-lg font-mono font-bold text-amber-200/90 tabular-nums mt-1">
                  {formatCurrency(totals.cost)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total expenses</p>
                <p className="text-base sm:text-lg font-mono font-bold text-orange-300 tabular-nums mt-1">
                  {formatCurrency(totals.expense)}
                </p>
              </div>
              <div className="col-span-2 lg:col-span-2 rounded-xl border border-emerald-800/35 bg-gradient-to-br from-emerald-950/40 to-slate-950/60 px-4 py-3 text-right ring-1 ring-inset ring-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">Net profit</p>
                <p className={`text-xl sm:text-2xl font-mono font-bold tabular-nums mt-0.5 ${profitColorClass(totals.net)}`}>
                  {formatCurrency(totals.net)}
                </p>
                <p className="text-[10px] text-slate-500 mt-2 leading-snug">
                  Sales − cost − expenses · {filterActive ? 'filtered lines only' : 'all loaded lines'}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {showClearAll && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-[2px] p-4">
          <div
            className="surface-2 rounded-2xl max-w-md w-full p-6 sm:p-7 border border-amber-900/40 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpl-clear-title"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950/50 border border-amber-900/40 mb-4">
              <Eraser className="text-amber-400" size={20} />
            </div>
            <h2 id="mpl-clear-title" className="text-lg font-bold text-slate-50">
              Clear entire notebook?
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              This saves <strong className="text-slate-300">all {rows.length} lines</strong> to{' '}
              <strong className="text-slate-300">Reports → Manual P&amp;L archives</strong>, then empties the live
              notebook. Download a PDF first if you also want a file on your device.
            </p>
            <p className="text-sm text-amber-200/80 mt-3 leading-relaxed">
              Use this when starting a fresh report for a new month. Sales, purchases, and cash are not affected.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
              <button
                type="button"
                onClick={() => setShowClearAll(false)}
                disabled={clearingAll}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-800/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleClearAll()}
                disabled={clearingAll}
                className="flex-1 py-3 rounded-xl bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white text-sm font-semibold border border-red-500/30 shadow-lg shadow-red-950/30 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {clearingAll ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                Clear all records
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-[2px] p-4">
          <div
            className="surface-2 rounded-2xl max-w-md w-full p-6 sm:p-7 border border-slate-600/80 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpl-delete-title"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950/50 border border-red-900/40 mb-4">
              <Trash2 className="text-red-400" size={20} />
            </div>
            <h2 id="mpl-delete-title" className="text-lg font-bold text-slate-50">
              Delete this row?
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              This removes only this notebook line. It does not change sales, purchases, or the main ledger.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-800/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteId && handleDelete(deleteId)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white text-sm font-semibold border border-red-500/30 shadow-lg shadow-red-950/30"
              >
                Delete row
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
