import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Wrench } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { getLedger, initializeLedger } from '../services/businessService'
import { formatCurrency, parseCurrencyInput } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'

export function SettingsPage() {
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof getLedger>>>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [inventoryValue, setInventoryValue] = useState('')
  const [cashInHand, setCashInHand] = useState('')
  const [receivablesTotal, setReceivablesTotal] = useState('')
  const [payablesTotal, setPayablesTotal] = useState('')
  const [onCheque, setOnCheque] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getLedger().then((l) => {
      setLedger(l)
      setLoading(false)
    })
  }, [])

  const handleEdit = () => {
    if (ledger) {
      setInventoryValue(String(ledger.inventory_value))
      setCashInHand(String(ledger.cash_in_hand))
      setReceivablesTotal(String(ledger.receivables_total))
      setPayablesTotal(String(ledger.payables_total ?? 0))
      setOnCheque(String(ledger.on_cheque ?? 0))
    }
    setEditing(true)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const inv = parseFloat(inventoryValue)
    const cash = parseFloat(cashInHand)
    const recv = parseFloat(receivablesTotal)
    const pay = parseFloat(payablesTotal) || 0
    const chq = parseFloat(onCheque) || 0

    if (isNaN(inv) || isNaN(cash) || isNaN(recv)) {
      setError('Please enter valid numbers for all fields.')
      return
    }
    if (inv < 0 || cash < 0 || recv < 0 || pay < 0 || chq < 0) {
      setError('Values cannot be negative.')
      return
    }

    setSubmitting(true)
    try {
      const updated = await initializeLedger(inv, cash, recv, pay, chq)
      setLedger(updated)
      setEditing(false)
      setSuccess('Opening balances updated successfully.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="text-sm text-slate-300 mt-0.5">Manage opening balances and system settings</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          </div>
        ) : !ledger ? (
          <div className="surface rounded-2xl p-8 text-center">
            <Wrench size={40} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-lg font-bold text-slate-100 mb-2">No Ledger Found</h2>
            <p className="text-sm text-slate-300 mb-4">Please set up your opening balances first.</p>
            <button
              onClick={handleEdit}
              className="gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            >
              Set Up Opening Balances
            </button>
          </div>
        ) : (
          <>
            {/* Current Balances */}
            <div className="surface rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-emerald-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SettingsIcon size={18} className="text-slate-400" />
                  <h2 className="font-semibold text-slate-100">Current Opening Balances</h2>
                </div>
                {!editing && (
                  <button
                    onClick={handleEdit}
                    className="text-sm text-emerald-300 hover:text-emerald-200 font-semibold"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-200 mb-1.5">Inventory Value</label>
                    <CurrencyInput
                      value={inventoryValue}
                      onChange={setInventoryValue}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-200 mb-1.5">Cash in Hand</label>
                    <CurrencyInput
                      value={cashInHand}
                      onChange={setCashInHand}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-200 mb-1.5">Receivables Total</label>
                    <CurrencyInput
                      value={receivablesTotal}
                      onChange={setReceivablesTotal}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-200 mb-1.5">Payables Total</label>
                    <CurrencyInput
                      value={payablesTotal}
                      onChange={setPayablesTotal}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-200 mb-1.5">On Cheque</label>
                    <CurrencyInput
                      value={onCheque}
                      onChange={setOnCheque}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div className="bg-amber-950/20 border border-amber-900/30 text-amber-200 text-sm rounded-xl px-4 py-3">
                    ⚠️ Updating opening balances will reset the current ledger values. Use this only for corrections.
                  </div>

                  {error && <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3 font-medium">{error}</div>}
                  {success && <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-200 text-sm rounded-xl px-4 py-3">{success}</div>}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setEditing(false)} className="flex-1 px-4 py-3 border border-emerald-900/40 bg-emerald-950/20 text-slate-100 rounded-xl text-sm font-semibold hover:bg-emerald-950/35 transition-all">Cancel</button>
                    <button type="submit" disabled={submitting} className="flex items-center justify-center gap-2 flex-1 px-4 py-3 gradient-primary text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50">
                      <Save size={16} />
                      {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center py-3.5 border-b border-emerald-900/20">
                    <span className="text-sm text-slate-400">Inventory Value</span>
                    <span className="text-sm font-semibold text-slate-100">{formatCurrency(ledger.inventory_value)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3.5 border-b border-emerald-900/20">
                    <span className="text-sm text-slate-400">Cash in Hand</span>
                    <span className="text-sm font-semibold text-slate-100">{formatCurrency(ledger.cash_in_hand)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3.5 border-b border-emerald-900/20">
                    <span className="text-sm text-slate-400">Receivables Total</span>
                    <span className="text-sm font-semibold text-slate-100">{formatCurrency(ledger.receivables_total)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3.5 border-b border-emerald-900/20">
                    <span className="text-sm text-slate-400">Payables Total</span>
                    <span className="text-sm font-semibold text-slate-100">{formatCurrency(ledger.payables_total ?? 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3.5 border-b border-emerald-900/20">
                    <span className="text-sm text-slate-400">On Cheque</span>
                    <span className="text-sm font-semibold text-slate-100">{formatCurrency(ledger.on_cheque ?? 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-slate-400">Last Updated</span>
                    <span className="text-sm text-slate-500">{new Date(ledger.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* About */}
            <div className="surface rounded-2xl p-6">
              <h2 className="font-semibold text-slate-100 mb-3">About</h2>
              <div className="space-y-2 text-sm text-slate-300">
                <p><span className="font-medium text-slate-200">System:</span> Gelioya Motors Business Manager</p>
                <p><span className="font-medium text-slate-200">Version:</span> 1.0.0</p>
                <p><span className="font-medium text-slate-200">Type:</span> Value-based inventory & cash-flow system</p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
