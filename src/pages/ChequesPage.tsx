import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, Filter, Banknote, CreditCard, ArrowUpRight } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { Modal } from '../components/Modal'
import { getCheques, createCheque, updateCheque, deleteCheque } from '../services/businessService'
import type { Cheque, ChequeStatus, CreateChequeInput, UpdateChequeInput, ChequeGivenToType } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'

interface ChequeFormData {
  cheque_bought_date: string
  cheque_date: string
  given_by: string
  bank: string
  cheque_number: string
  amount: number
  deposited_to: string
  deposit_date: string
  status: ChequeStatus
  cheque_given_to_type: ChequeGivenToType | ''
  cheque_given_to_name: string
}

const STATUS_OPTIONS: { value: ChequeStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-amber-300 bg-amber-900/30' },
  { value: 'deposited', label: 'Deposited', color: 'text-blue-300 bg-blue-900/30' },
  { value: 'cleared', label: 'Cleared', color: 'text-emerald-300 bg-emerald-900/30' },
  { value: 'bounced', label: 'Bounced', color: 'text-red-300 bg-red-900/30' },
]

const GIVEN_TO_TYPES: { value: ChequeGivenToType | ''; label: string }[] = [
  { value: '', label: 'Select Type' },
  { value: 'bank', label: 'Bank' },
  { value: 'person', label: 'Person' },
]

export function ChequesPage() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null)
  const [statusFilter, setStatusFilter] = useState<ChequeStatus | ''>('')
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState<ChequeFormData>({
    cheque_bought_date: new Date().toISOString().split('T')[0],
    cheque_date: '',
    given_by: '',
    bank: '',
    cheque_number: '',
    amount: 0,
    deposited_to: '',
    deposit_date: '',
    status: 'pending',
    cheque_given_to_type: '',
    cheque_given_to_name: '',
  })

  useEffect(() => {
    loadCheques()
  }, [])

  const loadCheques = async () => {
    try {
      const data = await getCheques()
      setCheques(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const createPayload: CreateChequeInput = {
        cheque_bought_date: formData.cheque_bought_date,
        cheque_date: formData.cheque_date,
        given_by: formData.given_by,
        bank: formData.bank,
        cheque_number: formData.cheque_number,
        amount: Number(formData.amount),
        deposited_to: formData.deposited_to || null,
        deposit_date: formData.deposit_date || null,
        status: formData.status,
        cheque_given_to_type: formData.cheque_given_to_type || null,
        cheque_given_to_name: formData.cheque_given_to_name || null,
      }

      if (editingCheque) {
        const updatePayload: UpdateChequeInput = {
          cheque_bought_date: formData.cheque_bought_date,
          cheque_date: formData.cheque_date,
          given_by: formData.given_by,
          bank: formData.bank,
          cheque_number: formData.cheque_number,
          amount: Number(formData.amount),
          deposited_to: formData.deposited_to || null,
          deposit_date: formData.deposit_date || null,
          status: formData.status,
          cheque_given_to_type: formData.cheque_given_to_type || null,
          cheque_given_to_name: formData.cheque_given_to_name || null,
        }
        await updateCheque(editingCheque.id, updatePayload)
      } else {
        await createCheque(createPayload)
      }

      setShowModal(false)
      setEditingCheque(null)
      setFormData({
        cheque_bought_date: new Date().toISOString().split('T')[0],
        cheque_date: '',
        given_by: '',
        bank: '',
        cheque_number: '',
        amount: 0,
        deposited_to: '',
        deposit_date: '',
        status: 'pending',
        cheque_given_to_type: '',
        cheque_given_to_name: '',
      })
      loadCheques()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to save cheque')
    }
  }

  const handleEdit = (cheque: Cheque) => {
    setEditingCheque(cheque)
    setFormData({
      cheque_bought_date: cheque.cheque_bought_date,
      cheque_date: cheque.cheque_date,
      given_by: cheque.given_by,
      bank: cheque.bank,
      cheque_number: cheque.cheque_number,
      amount: cheque.amount,
      deposited_to: cheque.deposited_to || '',
      deposit_date: cheque.deposit_date || '',
      status: cheque.status,
      cheque_given_to_type: cheque.cheque_given_to_type || '',
      cheque_given_to_name: cheque.cheque_given_to_name || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (cheque: Cheque) => {
    if (!confirm(`Are you sure you want to delete cheque #${cheque.cheque_number}?`)) return
    try {
      await deleteCheque(cheque.id)
      loadCheques()
    } catch (err) {
      console.error(err)
      alert('Failed to delete cheque')
    }
  }

  const filteredCheques = cheques.filter((c) => {
    const matchesSearch =
      c.given_by.toLowerCase().includes(search.toLowerCase()) ||
      c.cheque_number.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalAmount = cheques.reduce((sum, c) => sum + c.amount, 0)
  const pendingCount = cheques.filter((c) => c.status === 'pending').length
  const clearedAmount = cheques.filter((c) => c.status === 'cleared').reduce((sum, c) => sum + c.amount, 0)
  const bouncedCount = cheques.filter((c) => c.status === 'bounced').length

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Cheques</h1>
            <p className="text-sm text-slate-300 mt-0.5">Manual cheque register</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
          >
            <Plus size={18} />
            Add Cheque
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Cheques"
            value={cheques.length.toString()}
            icon={<Banknote size={20} />}
            color="blue"
          />
          <SummaryCard
            title="Pending"
            value={pendingCount.toString()}
            icon={<CreditCard size={20} />}
            color="amber"
          />
          <SummaryCard
            title="Cleared"
            value={formatCurrency(clearedAmount)}
            icon={<ArrowUpRight size={20} />}
            color="green"
          />
          <SummaryCard
            title="Bounced"
            value={bouncedCount.toString()}
            icon={<Trash2 size={20} />}
            color="red"
          />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by given by or cheque number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-80 pl-10 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ChequeStatus | '')}
                className="px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Bought</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Cheque</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Given By</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Bank</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Given To</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filteredCheques.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">No cheques found</td></tr>
                ) : (
                  filteredCheques.map((cheque) => (
                    <tr key={cheque.id} className="hover:bg-emerald-950/25 transition-colors">
                      <td className="px-5 py-3.5 text-slate-300">{formatDate(cheque.cheque_bought_date)}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-100">#{cheque.cheque_number}</div>
                        <div className="text-xs text-slate-500">{formatDate(cheque.cheque_date)}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{cheque.given_by}</td>
                      <td className="px-5 py-3.5 text-slate-300">{cheque.bank}</td>
                      <td className="px-5 py-3.5 text-right text-emerald-300 font-medium">{formatCurrency(cheque.amount)}</td>
                      <td className="px-5 py-3.5">
                        {cheque.cheque_given_to_type && cheque.cheque_given_to_name ? (
                          <div>
                            <div className="text-xs text-slate-500">{cheque.cheque_given_to_type.charAt(0).toUpperCase() + cheque.cheque_given_to_type.slice(1)}</div>
                            <div className="text-sm text-slate-300">{cheque.cheque_given_to_name}</div>
                          </div>
                        ) : <span className="text-slate-500 text-xs">-</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_OPTIONS.find((s) => s.value === cheque.status)?.color}`}>
                          {STATUS_OPTIONS.find((s) => s.value === cheque.status)?.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(cheque)}
                            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(cheque)}
                            className="p-1.5 text-red-300 hover:text-red-200 hover:bg-red-950/30 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredCheques.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filteredCheques.length} cheque{filteredCheques.length !== 1 ? 's' : ''} • {formatCurrency(totalAmount)} total
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingCheque(null) }} title={editingCheque ? 'Edit Cheque' : 'Add Cheque'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Cheque Bought Date</label>
              <input
                type="date"
                required
                value={formData.cheque_bought_date}
                onChange={(e) => setFormData({ ...formData, cheque_bought_date: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Cheque Date</label>
              <input
                type="date"
                required
                value={formData.cheque_date}
                onChange={(e) => setFormData({ ...formData, cheque_date: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Given By</label>
              <input
                type="text"
                required
                placeholder="Customer name"
                value={formData.given_by}
                onChange={(e) => setFormData({ ...formData, given_by: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Bank</label>
              <input
                type="text"
                required
                placeholder="Bank name"
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Cheque Number</label>
              <input
                type="text"
                required
                placeholder="Cheque #"
                value={formData.cheque_number}
                onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Deposited To (optional)</label>
              <input
                type="text"
                placeholder="Bank branch"
                value={formData.deposited_to}
                onChange={(e) => setFormData({ ...formData, deposited_to: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Deposit Date (optional)</label>
              <input
                type="date"
                value={formData.deposit_date}
                onChange={(e) => setFormData({ ...formData, deposit_date: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Given To Type</label>
              <select
                value={formData.cheque_given_to_type}
                onChange={(e) => setFormData({ ...formData, cheque_given_to_type: e.target.value as 'bank' | 'person' | '' })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {GIVEN_TO_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Given To Name</label>
              <input
                type="text"
                placeholder="Name of bank or person"
                value={formData.cheque_given_to_name}
                onChange={(e) => setFormData({ ...formData, cheque_given_to_name: e.target.value })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ChequeStatus })}
                className="w-full px-3 py-2.5 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                When status is not pending, both "Given To Type" and "Given To Name" are required.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditingCheque(null) }}
              className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 gradient-primary text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
            >
              {editingCheque ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
