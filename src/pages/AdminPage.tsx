import { useState } from 'react'
import { AppShell } from '../layout/AppShell'
import { supabase } from '../lib/supabaseClient'
import { Download, Upload, Database, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

const TABLES = [
  'business_ledger',
  'parties',
  'sales',
  'sale_items',
  'purchases',
  'payable_payments',
  'party_offsets',
  'receivable_payments',
  'cash_transactions',
  'returns',
  'return_items',
  'expenses',
  'manual_profit_loss',
  'manual_pnl_reports',
  'monthly_snapshots',
  'cheques',
]

type BackupData = Record<string, unknown[]>

export function AdminPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleExport = async () => {
    if (!supabase) return
    setExporting(true)
    setMessage(null)

    try {
      const backup: BackupData = {}
      for (const table of TABLES) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) {
          console.warn(`Skipping ${table}: ${error.message}`)
          backup[table] = []
        } else {
          backup[table] = data || []
        }
      }

      const payload = {
        _meta: {
          app: 'gelioya-motors',
          version: 1,
          exportedAt: new Date().toISOString(),
          tables: TABLES,
        },
        data: backup,
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `gelioya-motors-backup-${dateStr}.json`
      a.click()
      URL.revokeObjectURL(url)

      const totalRows = Object.values(backup).reduce((s, arr) => s + arr.length, 0)
      setMessage({ type: 'success', text: `Backup exported successfully — ${totalRows} records across ${TABLES.length} tables.` })
    } catch (err) {
      setMessage({ type: 'error', text: `Export failed: ${(err as Error).message}` })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !supabase) return

    if (!confirm('This will OVERWRITE existing data in all tables. Are you sure?')) {
      e.target.value = ''
      return
    }

    setImporting(true)
    setMessage(null)

    try {
      const text = await file.text()
      const payload = JSON.parse(text)

      if (!payload._meta?.app || payload._meta.app !== 'gelioya-motors') {
        throw new Error('Invalid backup file — not a Gelioya Motors backup.')
      }

      const backup: BackupData = payload.data
      const tables = (payload._meta.tables || []) as string[]

      // Delete in reverse order (child tables first) to respect foreign keys
      const deleteOrder = [...tables].reverse()
      for (const table of deleteOrder) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) console.warn(`Clear ${table}: ${error.message}`)
      }

      // Insert in original order (parent tables first)
      let totalInserted = 0
      for (const table of tables) {
        const rows = backup[table] || []
        if (rows.length === 0) continue

        const { error } = await supabase.from(table).insert(rows)
        if (error) {
          console.warn(`Insert ${table}: ${error.message}`)
          setMessage({ type: 'error', text: `Partial restore — error on ${table}: ${error.message}` })
        } else {
          totalInserted += rows.length
        }
      }

      if (!message || message.type !== 'error') {
        setMessage({ type: 'success', text: `Backup restored — ${totalInserted} records across ${tables.length} tables.` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Import failed: ${(err as Error).message}` })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Admin</h1>
          <p className="text-sm text-slate-300 mt-0.5">System administration & backup</p>
        </div>

        {message && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            message.type === 'success'
              ? 'bg-emerald-950/30 border border-emerald-900/40 text-emerald-200'
              : 'bg-red-950/30 border border-red-900/40 text-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {message.text}
          </div>
        )}

        {/* Backup / Restore */}
        <div className="surface rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-200">
              <Database size={22} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">Backup & Restore</h2>
              <p className="text-xs text-slate-400">Export all data as JSON or restore from a backup file</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export */}
            <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Download size={18} className="text-emerald-300" />
                <h3 className="text-sm font-semibold text-slate-100">Export Backup</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Downloads a JSON file containing all records from {TABLES.length} tables. Keep this file safe — it contains your complete business data.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {exporting ? 'Exporting...' : 'Download Backup'}
              </button>
            </div>

            {/* Import */}
            <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Upload size={18} className="text-amber-300" />
                <h3 className="text-sm font-semibold text-slate-100">Restore Backup</h3>
              </div>
              <p className="text-xs text-slate-400 mb-2">
                Upload a previously exported backup file. This will <strong className="text-amber-300">overwrite all existing data</strong>.
              </p>
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-red-950/20 border border-red-900/30">
                <AlertTriangle size={14} className="text-red-300 shrink-0" />
                <p className="text-xs text-red-300/80">Current data will be deleted before restore. Export a backup first if needed.</p>
              </div>
              <label className={`w-full flex items-center justify-center gap-2 border border-amber-900/40 bg-amber-950/20 hover:bg-amber-950/35 text-amber-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {importing ? 'Restoring...' : 'Upload Backup File'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Table overview */}
        <div className="surface rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-900/30">
            <h2 className="font-semibold text-slate-100">Database Tables</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tables included in backup</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-emerald-900/10">
            {TABLES.map((table) => (
              <div key={table} className="surface p-4 flex items-center gap-3">
                <Database size={14} className="text-slate-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">{table}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
