import { useState, useEffect } from 'react'
import { Users, Search, ChevronDown, ChevronUp, Phone, MapPin, FileText, ShoppingCart, Truck } from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { SummaryCard } from '../components/SummaryCard'
import { getPartyDetails } from '../services/businessService'
import type { PartyDetail } from '../services/businessService'
import { formatCurrency, formatDate } from '../lib/utils'

export function PartiesPage() {
  const [parties, setParties] = useState<PartyDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedParty, setExpandedParty] = useState<string | null>(null)

  useEffect(() => {
    loadParties()
  }, [])

  const loadParties = async () => {
    try {
      const data = await getPartyDetails()
      setParties(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.toLowerCase().includes(search.toLowerCase()))
  )

  const totalOutstanding = filtered.reduce((sum, p) => sum + p.outstanding, 0)
  const totalCreditSales = filtered.reduce((sum, p) => sum + p.total_credit_sales, 0)
  const totalOffsets = filtered.reduce((sum, p) => sum + p.total_offsets, 0)
  const totalPurchases = filtered.reduce((sum, p) => sum + p.total_purchases, 0)

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Parties</h1>
          <p className="text-sm text-slate-300 mt-0.5">Manage customers & suppliers with offset tracking</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={<Users size={20} />} color="red" />
          <SummaryCard title="Credit Sales" value={formatCurrency(totalCreditSales)} icon={<ShoppingCart size={20} />} color="amber" />
          <SummaryCard title="Total Offsets" value={formatCurrency(totalOffsets)} icon={<FileText size={20} />} color="blue" />
          <SummaryCard title="Total Purchases" value={formatCurrency(totalPurchases)} icon={<Truck size={20} />} color="green" />
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search parties by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-950/40 border-b border-emerald-900/30">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Party</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Credit Sales</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Payments</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Offsets</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Purchases</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Outstanding</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">No parties found</td></tr>
                ) : (
                  filtered.map((party) => (
                    <>
                      <tr key={party.id} className="hover:bg-emerald-950/25 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-900/40 flex items-center justify-center text-sm font-bold text-emerald-300">
                              {party.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-100">{party.name}</div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                {party.phone && (
                                  <span className="flex items-center gap-1"><Phone size={10} />{party.phone}</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <ShoppingCart size={10} />{party.sales_count} sales
                                </span>
                                <span className="flex items-center gap-1">
                                  <Truck size={10} />{party.purchases_count} purchases
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-amber-300">{formatCurrency(party.total_credit_sales)}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-300">{formatCurrency(party.total_payments_received)}</td>
                        <td className="px-5 py-3.5 text-right text-blue-300">{formatCurrency(party.total_offsets)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-300">{formatCurrency(party.total_purchases)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`font-bold ${party.outstanding > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                            {formatCurrency(party.outstanding)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setExpandedParty(expandedParty === party.id ? null : party.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-all"
                          >
                            {expandedParty === party.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {expandedParty === party.id && (
                        <tr key={`${party.id}-detail`} className="bg-emerald-950/15">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Contact Info */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Info</h4>
                                {party.phone && (
                                  <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <Phone size={14} className="text-slate-500" />
                                    {party.phone}
                                  </div>
                                )}
                                {party.address && (
                                  <div className="flex items-start gap-2 text-sm text-slate-300">
                                    <MapPin size={14} className="text-slate-500 mt-0.5" />
                                    {party.address}
                                  </div>
                                )}
                                {party.notes && (
                                  <div className="flex items-start gap-2 text-sm text-slate-300">
                                    <FileText size={14} className="text-slate-500 mt-0.5" />
                                    {party.notes}
                                  </div>
                                )}
                                {!party.phone && !party.address && !party.notes && (
                                  <div className="text-sm text-slate-500 italic">No contact info</div>
                                )}
                              </div>

                              {/* Financial Summary */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Summary</h4>
                                <div className="space-y-1.5 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Total Credit Sales</span>
                                    <span className="text-amber-300 font-medium">{formatCurrency(party.total_credit_sales)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Payments Received</span>
                                    <span className="text-emerald-300 font-medium">-{formatCurrency(party.total_payments_received)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Purchase Offsets</span>
                                    <span className="text-blue-300 font-medium">-{formatCurrency(party.total_offsets)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-emerald-900/30 pt-1.5">
                                    <span className="text-slate-200 font-semibold">Outstanding</span>
                                    <span className={`font-bold ${party.outstanding > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                                      {formatCurrency(party.outstanding)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between mt-2">
                                    <span className="text-slate-400">Total Purchases</span>
                                    <span className="text-slate-200 font-medium">{formatCurrency(party.total_purchases)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Activity */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Activity</h4>
                                <div className="space-y-1.5 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Total Sales</span>
                                    <span className="text-slate-200">{party.sales_count} invoice(s)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Total Purchases</span>
                                    <span className="text-slate-200">{party.purchases_count} purchase(s)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Created</span>
                                    <span className="text-slate-200">{formatDate(party.created_at)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-emerald-900/20 text-sm text-slate-400">
              {filtered.length} party(ies) · Outstanding: {formatCurrency(totalOutstanding)}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
