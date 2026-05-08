import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, ArrowRight } from 'lucide-react'
import { getLedger, initializeLedger } from '../services/businessService'
import { formatCurrency, parseCurrencyInput } from '../lib/utils'
import { CurrencyInput } from '../components/CurrencyInput'

export function SetupPage() {
  const navigate = useNavigate()
  const [inventoryValue, setInventoryValue] = useState('')
  const [cashInHand, setCashInHand] = useState('')
  const [receivablesTotal, setReceivablesTotal] = useState('')
  const [payablesTotal, setPayablesTotal] = useState('')
  const [onCheque, setOnCheque] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingLedger, setExistingLedger] = useState(false)

  useEffect(() => {
    getLedger().then((ledger) => {
      if (ledger) {
        setExistingLedger(true)
        setInventoryValue(String(ledger.inventory_value))
        setCashInHand(String(ledger.cash_in_hand))
        setReceivablesTotal(String(ledger.receivables_total))
        setPayablesTotal(String(ledger.payables_total ?? 0))
        setOnCheque(String(ledger.on_cheque ?? 0))
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

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

    setLoading(true)
    try {
      await initializeLedger(inv, cash, recv, pay, chq)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initialize ledger.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#021b1a] via-[#022c2b] to-[#021b1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 rounded-3xl mb-5 shadow-2xl shadow-black/30 border border-emerald-900/30">
            <Wrench size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Gelioya Motors</h1>
          <p className="text-emerald-200/80 text-sm mt-1.5">Business Management System</p>
        </div>

        {/* Setup Card */}
        <div className="surface rounded-3xl p-8">
          <h2 className="text-xl font-bold text-slate-100 mb-1">Opening Balance Setup</h2>
          <p className="text-sm text-slate-300 mb-6">
            {existingLedger
              ? 'Update your opening balances. This will reset the current ledger.'
              : 'Enter your opening balances to get started.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Opening Inventory Value
              </label>
              <CurrencyInput
                value={inventoryValue}
                onChange={setInventoryValue}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Cash in Hand
              </label>
              <CurrencyInput
                value={cashInHand}
                onChange={setCashInHand}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Opening Receivables
              </label>
              <CurrencyInput
                value={receivablesTotal}
                onChange={setReceivablesTotal}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Opening Payables
              </label>
              <CurrencyInput
                value={payablesTotal}
                onChange={setPayablesTotal}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                On Cheque
              </label>
              <CurrencyInput
                value={onCheque}
                onChange={setOnCheque}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            {error && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-sm rounded-xl px-4 py-3 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 gradient-primary hover:shadow-lg hover:shadow-emerald-500/20 text-white font-semibold py-3.5 rounded-xl text-sm transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Saving...' : existingLedger ? 'Update Opening Balance' : 'Initialize & Start'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
