import { supabase } from '../lib/supabaseClient'
import { generateInvoiceNumber } from '../lib/utils'
import type {
  BusinessLedger,
  Sale,
  SaleItem,
  Purchase,
  ReceivablePayment,
  PayablePayment,
  CashTransaction,
  CreateSaleInput,
  CreatePurchaseInput,
  CreateReceivablePaymentInput,
  CreatePayablePaymentInput,
  CreateExpenseInput,
  ReceivableWithSale,
  PayableWithPurchase,
  DashboardStats,
  ReportStats,
  Expense,
  ExpenseCategory,
  MonthlyProfitTrend,
  Party,
  PartyOffset,
  CreatePartyInput,
  Return,
  ReturnItem,
  CreateReturnInput,
  MonthlySnapshot,
  ManualProfitLoss,
  ManualProfitLossInput,
  ManualPnlReport,
  ManualPnlReportRow,
  ManualPnlReportSummary,
  CustomerLedgerTransaction,
  CustomerLedgerSummary,
  CustomerLedgerTransactionType,
  Cheque,
  CreateChequeInput,
  UpdateChequeInput,
} from '../types'

export function getClient() {
  if (!supabase) throw new Error('Supabase is not configured. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the .env file.')
  return supabase
}

/** All new sales (including credit) count toward P&L immediately; month close still snapshots the period. */
function isFinalizedForNewSale(_paymentType: CreateSaleInput['payment_type']): boolean {
  return true
}

function isFinalizedForNewPurchase(_paymentType: CreatePurchaseInput['payment_type']): boolean {
  return true
}

// ============================================
// LEDGER OPERATIONS
// ============================================

export async function getLedger(): Promise<BusinessLedger | null> {
  const { data, error } = await getClient()
    .from('business_ledger')
    .select('*')
    .eq('is_active', true)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function initializeLedger(
  inventoryValue: number,
  cashInHand: number,
  receivablesTotal: number,
  payablesTotal: number = 0,
  onCheque: number = 0
): Promise<BusinessLedger> {
  // Deactivate any existing ledger
  await getClient()
    .from('business_ledger')
    .update({ is_active: false })
    .eq('is_active', true)

  const { data, error } = await getClient()
    .from('business_ledger')
    .insert({
      inventory_value: inventoryValue,
      cash_in_hand: cashInHand,
      receivables_total: receivablesTotal,
      payables_total: payablesTotal,
      on_cheque: onCheque,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLedger(updates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'payables_total' | 'on_cheque'>>): Promise<BusinessLedger> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger found. Please set up opening balances first.')

  const newValues = {
    inventory_value: updates.inventory_value ?? ledger.inventory_value,
    cash_in_hand: updates.cash_in_hand ?? ledger.cash_in_hand,
    receivables_total: updates.receivables_total ?? ledger.receivables_total,
    payables_total: updates.payables_total ?? ledger.payables_total,
    on_cheque: updates.on_cheque ?? ledger.on_cheque,
  }

  const { data, error } = await getClient()
    .from('business_ledger')
    .update(newValues)
    .eq('id', ledger.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// NEXT SEQUENCE NUMBER
// ============================================

export async function getNextNumber(table: 'sales' | 'purchases', field: 'invoice_number' | 'purchase_number', prefix: string): Promise<number> {
  const currentMonth = `${prefix}${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const { data, error } = await getClient()
    .from(table)
    .select(field)
    .like(field, `${currentMonth}%`)
    .order(field, { ascending: false })
    .limit(1)

  if (error) throw error

  if (!data || data.length === 0) return 1

  const lastNumber = (data[0] as Record<string, unknown>)[field] as string
  const seqPart = parseInt(lastNumber.split('-')[1], 10)
  return isNaN(seqPart) ? 1 : seqPart + 1
}

// ============================================
// CASH TRANSACTION LOG
// ============================================

async function logCashTransaction(
  type: CashTransaction['type'],
  referenceType: CashTransaction['reference_type'],
  referenceId: string,
  amount: number,
  direction: CashTransaction['direction'],
  notes?: string
): Promise<void> {
  const { error } = await getClient()
    .from('cash_transactions')
    .insert({ type, reference_type: referenceType, reference_id: referenceId, amount, direction, notes })
  if (error) throw error
}

// ============================================
// PARTIES
// ============================================

export async function getParties(): Promise<Party[]> {
  const { data, error } = await getClient()
    .from('parties')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export interface PartyDetail extends Party {
  total_credit_sales: number
  total_payments_received: number
  total_offsets: number
  outstanding: number
  total_purchases: number
  sales_count: number
  purchases_count: number
}

export async function getPartyDetails(): Promise<PartyDetail[]> {
  const parties = await getParties()
  if (parties.length === 0) return []

  const partyIds = parties.map((p) => p.id)

  // Credit sales per party
  const { data: creditSales } = await getClient()
    .from('sales')
    .select('id, party_id, total_sales')
    .in('party_id', partyIds)
    .eq('payment_type', 'credit')

  // All sales count per party
  const { data: allSales } = await getClient()
    .from('sales')
    .select('party_id')
    .in('party_id', partyIds)

  // Payments per party's sales
  const saleIdsByParty: Record<string, string[]> = {}
  for (const s of creditSales || []) {
    if (s.party_id) {
      if (!saleIdsByParty[s.party_id]) saleIdsByParty[s.party_id] = []
      saleIdsByParty[s.party_id].push(s.id)
    }
  }

  const allSaleIds = Object.values(saleIdsByParty).flat()
  let paymentsByParty: Record<string, number> = {}
  if (allSaleIds.length > 0) {
    const { data: payments } = await getClient()
      .from('receivable_payments')
      .select('sale_id, amount')
      .in('sale_id', allSaleIds)
    // Map payments back to party
    for (const p of payments || []) {
      for (const [pid, sids] of Object.entries(saleIdsByParty)) {
        if (sids.includes(p.sale_id)) {
          paymentsByParty[pid] = (paymentsByParty[pid] || 0) + Number(p.amount)
          break
        }
      }
    }
  }

  // Offsets per party
  const { data: offsets } = await getClient()
    .from('party_offsets')
    .select('party_id, amount')
    .in('party_id', partyIds)
  const offsetsByParty: Record<string, number> = {}
  for (const o of offsets || []) {
    offsetsByParty[o.party_id] = (offsetsByParty[o.party_id] || 0) + Number(o.amount)
  }

  // Purchases per party
  const { data: purchases } = await getClient()
    .from('purchases')
    .select('party_id, total_amount')
    .in('party_id', partyIds)
  const purchasesByParty: Record<string, { total: number; count: number }> = {}
  for (const p of purchases || []) {
    if (p.party_id) {
      if (!purchasesByParty[p.party_id]) purchasesByParty[p.party_id] = { total: 0, count: 0 }
      purchasesByParty[p.party_id].total += Number(p.total_amount)
      purchasesByParty[p.party_id].count++
    }
  }

  // Sales count per party
  const salesCountByParty: Record<string, number> = {}
  for (const s of allSales || []) {
    if (s.party_id) {
      salesCountByParty[s.party_id] = (salesCountByParty[s.party_id] || 0) + 1
    }
  }

  // Credit sales total per party
  const creditSalesByParty: Record<string, number> = {}
  for (const s of creditSales || []) {
    if (s.party_id) {
      creditSalesByParty[s.party_id] = (creditSalesByParty[s.party_id] || 0) + Number(s.total_sales)
    }
  }

  return parties.map((party) => {
    const totalCreditSales = creditSalesByParty[party.id] || 0
    const totalPayments = paymentsByParty[party.id] || 0
    const totalOffsets = offsetsByParty[party.id] || 0
    const purchaseData = purchasesByParty[party.id] || { total: 0, count: 0 }
    return {
      ...party,
      total_credit_sales: totalCreditSales,
      total_payments_received: totalPayments,
      total_offsets: totalOffsets,
      outstanding: Math.max(0, totalCreditSales - totalPayments - totalOffsets),
      total_purchases: purchaseData.total,
      sales_count: salesCountByParty[party.id] || 0,
      purchases_count: purchaseData.count,
    }
  })
}

export async function createPartyIfMissing(name: string, extra?: { phone?: string; address?: string; notes?: string }): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  // Check if party already exists
  const { data: existing } = await getClient()
    .from('parties')
    .select('id')
    .ilike('name', trimmed)
    .limit(1)

  if (existing && existing.length > 0) return existing[0].id

  // Create new party
  const { data, error } = await getClient()
    .from('parties')
    .insert({
      name: trimmed,
      phone: extra?.phone?.trim() || null,
      address: extra?.address?.trim() || null,
      notes: extra?.notes?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export interface PartyOffsetWithPurchase extends PartyOffset {
  purchase_number?: string
  supplier_name?: string
  purchase_total?: number
  purchase_date?: string
}

export async function getPartyOffsets(partyId: string): Promise<PartyOffsetWithPurchase[]> {
  const { data: offsets, error } = await getClient()
    .from('party_offsets')
    .select('id, party_id, purchase_id, amount, created_at')
    .eq('party_id', partyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!offsets || offsets.length === 0) return []

  // Fetch related purchases
  const purchaseIds = offsets.map((o) => o.purchase_id)
  const { data: purchases } = await getClient()
    .from('purchases')
    .select('id, purchase_number, supplier_name, total_amount, created_at')
    .in('id', purchaseIds)

  const purchaseMap: Record<string, { purchase_number: string; supplier_name: string; total_amount: number; created_at: string }> = {}
  for (const p of purchases || []) {
    purchaseMap[p.id] = p as any
  }

  return offsets.map((o) => {
    const purchase = purchaseMap[o.purchase_id]
    return {
      ...o,
      purchase_number: purchase?.purchase_number,
      supplier_name: purchase?.supplier_name,
      purchase_total: purchase?.total_amount,
      purchase_date: purchase?.created_at,
    }
  })
}

export async function getPartyOutstandingReceivable(partyId: string): Promise<number> {
  // Credit sales for this party
  const { data: creditSales, error: salesError } = await getClient()
    .from('sales')
    .select('id, total_sales')
    .eq('party_id', partyId)
    .eq('payment_type', 'credit')
  if (salesError) throw salesError

  const totalCreditSales = (creditSales || []).reduce((sum, s) => sum + Number(s.total_sales), 0)

  // Receivable payments for sales belonging to this party
  if (!creditSales || creditSales.length === 0) {
    // No credit sales, check offsets anyway
    const { data: offsets } = await getClient()
      .from('party_offsets')
      .select('amount')
      .eq('party_id', partyId)
    const totalOffsets = (offsets || []).reduce((sum, o) => sum + Number(o.amount), 0)
    return Math.max(0, -totalOffsets) // shouldn't be negative but guard
  }

  const saleIds = (creditSales || []).map((s) => s.id).filter(Boolean) as string[]

  // Receivable payments for those sales
  let totalPayments = 0
  if (saleIds.length > 0) {
    const { data: payments } = await getClient()
      .from('receivable_payments')
      .select('amount')
      .in('sale_id', saleIds)
    totalPayments = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  }

  // Party offsets for this party
  const { data: offsets } = await getClient()
    .from('party_offsets')
    .select('amount')
    .eq('party_id', partyId)
  const totalOffsets = (offsets || []).reduce((sum, o) => sum + Number(o.amount), 0)

  const outstanding = totalCreditSales - totalPayments - totalOffsets
  return Math.max(0, outstanding)
}

export async function getPurchaseOffsetTotal(purchaseId: string): Promise<number> {
  const { data: offsets, error } = await getClient()
    .from('party_offsets')
    .select('amount')
    .eq('purchase_id', purchaseId)
  if (error) throw error
  return (offsets || []).reduce((sum, o) => sum + Number(o.amount), 0)
}

async function createPartyOffset(partyId: string, purchaseId: string, amount: number): Promise<PartyOffset> {
  const { data, error } = await getClient()
    .from('party_offsets')
    .insert({
      party_id: partyId,
      purchase_id: purchaseId,
      amount,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// SALES
// ============================================

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')
  if (input.total_sales <= 0) throw new Error('Total sales must be greater than zero.')
  if (input.total_cost < 0) throw new Error('Total cost cannot be negative.')
  if (input.total_cost > 0 && input.total_cost > ledger.inventory_value) throw new Error('Total cost exceeds current inventory value.')
  if (!input.items || input.items.length === 0) throw new Error('Invoice must have at least one item.')

  const nextSeq = await getNextNumber('sales', 'invoice_number', 'INV')
  const invoiceNumber = generateInvoiceNumber('INV', nextSeq)

  // Auto-create party if name provided and no explicit party_id
  let partyId = input.party_id || null
  if (!partyId && input.customer_name.trim()) {
    partyId = await createPartyIfMissing(input.customer_name)
  }

  // Insert sale record
  const { data: sale, error: saleError } = await getClient()
    .from('sales')
    .insert({
      invoice_number: invoiceNumber,
      customer_name: input.customer_name.trim(),
      party_id: partyId,
      invoice_date: input.invoice_date,
      total_cost: input.total_cost,
      total_sales: input.total_sales,
      total_profit: input.total_profit,
      payment_type: input.payment_type,
      invoice_status: 'completed',
      is_finalized: isFinalizedForNewSale(input.payment_type),
      cheque_confirmed: input.payment_type === 'chequesale' ? false : true,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (saleError) throw saleError

  // Insert sale items
  const saleItems = input.items.map((item) => ({
    sale_id: sale.id,
    item_name: item.item_name.trim(),
    quantity: item.quantity,
    cost_price: item.cost_price,
    selling_price: item.selling_price,
    profit: item.profit,
  }))
  const { error: itemsError } = await getClient().from('sale_items').insert(saleItems)
  if (itemsError) throw itemsError

  // Update ledger: inventory decreases by total_cost only if cost exists
  // For chequesale, don't update ledger until confirmed
  const ledgerUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'on_cheque'>> = {}
  if (input.total_cost > 0) {
    ledgerUpdates.inventory_value = ledger.inventory_value - input.total_cost
  }

  if (input.payment_type === 'cash') {
    ledgerUpdates.cash_in_hand = ledger.cash_in_hand + input.total_sales
  } else if (input.payment_type === 'chequesale') {
    // Don't update ledger for chequesale until confirmed
    // It will be pending until user confirms
  } else {
    ledgerUpdates.receivables_total = ledger.receivables_total + input.total_sales
  }

  if (Object.keys(ledgerUpdates).length > 0) {
    await updateLedger(ledgerUpdates)
  }

  if (input.payment_type !== 'chequesale') {
    await logCashTransaction(
      input.payment_type === 'cash' ? 'sale_cash' : 'sale_credit',
      'sale',
      sale.id,
      input.total_sales,
      'in',
      `Invoice ${invoiceNumber} - ${input.customer_name}`
    )
  }

  return sale
}

export async function getSales(dateFrom?: string, dateTo?: string, options?: { finalizedOnly?: boolean }): Promise<Sale[]> {
  let query = getClient().from('sales').select('*, sale_items(*)').order('invoice_date', { ascending: false }).order('created_at', { ascending: false })
  if (dateFrom) query = query.gte('invoice_date', dateFrom)
  if (dateTo) query = query.lte('invoice_date', dateTo)
  if (options?.finalizedOnly) query = query.eq('is_finalized', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const { data, error } = await getClient().from('sales').select('*, sale_items(*)').eq('id', id).single()
  if (error) throw error
  return data
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const { data, error } = await getClient().from('sale_items').select('*').eq('sale_id', saleId).order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function updateSale(id: string, input: CreateSaleInput): Promise<Sale> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')
  if (input.total_sales <= 0) throw new Error('Total sales must be greater than zero.')
  if (input.total_cost < 0) throw new Error('Total cost cannot be negative.')

  const existing = await getSaleById(id)
  if (!existing) throw new Error('Sale not found.')

  // Reverse old sale's ledger impact
  const reverseUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'on_cheque'>> = {}
  if (Number(existing.total_cost) > 0) {
    reverseUpdates.inventory_value = ledger.inventory_value + Number(existing.total_cost)
  }
  if (existing.payment_type === 'cash') {
    reverseUpdates.cash_in_hand = ledger.cash_in_hand - Number(existing.total_sales)
  } else if (existing.payment_type === 'chequesale') {
    reverseUpdates.on_cheque = ledger.on_cheque - Number(existing.total_sales)
  } else {
    reverseUpdates.receivables_total = ledger.receivables_total - Number(existing.total_sales)
  }

  // Apply new sale's ledger impact
  const newLedger = await updateLedger(reverseUpdates)
  if (input.total_cost > 0 && input.total_cost > newLedger.inventory_value) {
    throw new Error('Total cost exceeds current inventory value.')
  }

  const applyUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'on_cheque'>> = {}
  if (input.total_cost > 0) {
    applyUpdates.inventory_value = newLedger.inventory_value - input.total_cost
  }
  if (input.payment_type === 'cash') {
    applyUpdates.cash_in_hand = newLedger.cash_in_hand + input.total_sales
  } else if (input.payment_type === 'chequesale') {
    applyUpdates.on_cheque = newLedger.on_cheque + input.total_sales
  } else {
    applyUpdates.receivables_total = newLedger.receivables_total + input.total_sales
  }

  await updateLedger(applyUpdates)

  // Delete old cash transaction and sale items
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'sale')
  await getClient().from('sale_items').delete().eq('sale_id', id)

  // Re-insert sale items
  const saleItems = input.items.map((item) => ({
    sale_id: id,
    item_name: item.item_name.trim(),
    quantity: item.quantity,
    cost_price: item.cost_price,
    selling_price: item.selling_price,
    profit: item.profit,
  }))
  const { error: itemsError } = await getClient().from('sale_items').insert(saleItems)
  if (itemsError) throw itemsError

  await logCashTransaction(
    input.payment_type === 'cash' ? 'sale_cash' : input.payment_type === 'chequesale' ? 'sale_cheque' : 'sale_credit',
    'sale',
    id,
    input.total_sales,
    'in',
    `Invoice ${existing.invoice_number} - ${input.customer_name}`
  )

  // Auto-create party if needed
  let partyId = input.party_id || null
  if (!partyId && input.customer_name.trim()) {
    partyId = await createPartyIfMissing(input.customer_name)
  }

  // Update sale record
  const { data, error } = await getClient()
    .from('sales')
    .update({
      customer_name: input.customer_name.trim(),
      party_id: partyId,
      invoice_date: input.invoice_date,
      total_cost: input.total_cost,
      total_sales: input.total_sales,
      total_profit: input.total_profit,
      payment_type: input.payment_type,
      is_finalized: isFinalizedForNewSale(input.payment_type),
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .select('*, sale_items(*)')
    .single()
  if (error) throw error
  return data
}

export async function deleteSale(id: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const existing = await getSaleById(id)
  if (!existing) throw new Error('Sale not found.')

  // Check for receivable payments on this sale
  const { data: payments } = await getClient()
    .from('receivable_payments')
    .select('id, amount')
    .eq('sale_id', id)

  if (payments && payments.length > 0) {
    // Reverse each payment's ledger impact first
    for (const p of payments) {
      const pLedger = await getLedger()
      if (pLedger) {
        await updateLedger({
          cash_in_hand: pLedger.cash_in_hand - Number(p.amount),
          receivables_total: pLedger.receivables_total + Number(p.amount),
        })
        await getClient().from('cash_transactions').delete().eq('reference_id', p.id).eq('reference_type', 'receivable_payment')
      }
    }
    await getClient().from('receivable_payments').delete().eq('sale_id', id)
  }

  // Reverse sale's ledger impact
  const currentLedger = await getLedger()
  if (currentLedger) {
    const reverseUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'on_cheque'>> = {}
    if (Number(existing.total_cost) > 0) {
      reverseUpdates.inventory_value = currentLedger.inventory_value + Number(existing.total_cost)
    }
    if (existing.payment_type === 'cash') {
      reverseUpdates.cash_in_hand = currentLedger.cash_in_hand - Number(existing.total_sales)
    } else if (existing.payment_type === 'chequesale') {
      reverseUpdates.on_cheque = currentLedger.on_cheque - Number(existing.total_sales)
    } else {
      reverseUpdates.receivables_total = currentLedger.receivables_total - Number(existing.total_sales)
    }
    await updateLedger(reverseUpdates)
  }

  // Delete cash transaction log and sale items
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'sale')
  await getClient().from('sale_items').delete().eq('sale_id', id)

  // Delete sale
  const { error } = await getClient().from('sales').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// PURCHASES
// ============================================

export async function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')
  if (input.total_amount <= 0) throw new Error('Purchase amount must be greater than zero.')

  const nextSeq = await getNextNumber('purchases', 'purchase_number', 'PUR')
  const purchaseNumber = generateInvoiceNumber('PUR', nextSeq)

  // Auto-create party if supplier name provided and no explicit party_id
  let partyId = input.party_id || null
  if (!partyId && input.supplier_name.trim()) {
    partyId = await createPartyIfMissing(input.supplier_name)
  }

  // Calculate offset if party has outstanding receivable and offset is enabled
  let offsetAmount = 0
  let remainingAmount = input.total_amount

  if (partyId && input.offset_enabled !== false) {
    const outstanding = await getPartyOutstandingReceivable(partyId)
    if (outstanding > 0) {
      offsetAmount = Math.min(outstanding, input.total_amount)
      remainingAmount = input.total_amount - offsetAmount
    }
  }

  // Cash validation: only check remaining amount (after offset) for cash purchases
  // If party has receivables, offset covers as much as possible — only remainder hits cash
  if (input.payment_type === 'cash' && remainingAmount > 0 && remainingAmount > ledger.cash_in_hand) {
    throw new Error('Cash payment exceeds Cash in Hand balance.')
  }

  const { data: purchase, error: purchaseError } = await getClient()
    .from('purchases')
    .insert({
      purchase_number: purchaseNumber,
      supplier_name: input.supplier_name.trim(),
      party_id: partyId,
      total_amount: input.total_amount,
      payment_type: input.payment_type,
      is_finalized: isFinalizedForNewPurchase(input.payment_type),
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (purchaseError) throw purchaseError

  // Create party offset if applicable
  if (offsetAmount > 0 && partyId) {
    await createPartyOffset(partyId, purchase.id, offsetAmount)
    // Offset reduces receivables
    await updateLedger({
      receivables_total: ledger.receivables_total - offsetAmount,
    })
  }

  // Update ledger: inventory always increases by full purchase amount
  const currentLedger = await getLedger()
  const ledgerUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'payables_total'>> = {
    inventory_value: currentLedger!.inventory_value + input.total_amount,
  }

  // Cash only decreases if there's a remaining amount after offset (credit customer offset takes priority)
  if (input.payment_type === 'cash' && remainingAmount > 0) {
    ledgerUpdates.cash_in_hand = currentLedger!.cash_in_hand - remainingAmount
  }

  // Credit purchases increase payables by the remaining amount (after offset)
  if (input.payment_type === 'credit' && remainingAmount > 0) {
    ledgerUpdates.payables_total = currentLedger!.payables_total + remainingAmount
  }

  await updateLedger(ledgerUpdates)

  // Log cash transaction — only for the actual cash movement
  if (input.payment_type === 'cash' && remainingAmount > 0) {
    await logCashTransaction(
      'purchase_cash',
      'purchase',
      purchase.id,
      remainingAmount,
      'out',
      `Purchase ${purchaseNumber} - ${input.supplier_name}${offsetAmount > 0 ? ` (offset Rs. ${offsetAmount.toFixed(2)})` : ''}`
    )
  } else if (input.payment_type === 'credit' && remainingAmount > 0) {
    // Credit purchase — log for record
    await logCashTransaction(
      'purchase_credit',
      'purchase',
      purchase.id,
      remainingAmount,
      'out',
      `Purchase ${purchaseNumber} - ${input.supplier_name} (credit)${offsetAmount > 0 ? ` + offset Rs. ${offsetAmount.toFixed(2)}` : ''}`
    )
  } else if (offsetAmount > 0) {
    // Fully offset — no cash movement, just log for record
    await logCashTransaction(
      'purchase_credit',
      'purchase',
      purchase.id,
      offsetAmount,
      'out',
      `Purchase ${purchaseNumber} - ${input.supplier_name} (offset Rs. ${offsetAmount.toFixed(2)})`
    )
  }

  return purchase
}

export async function getPurchases(dateFrom?: string, dateTo?: string): Promise<Purchase[]> {
  let query = getClient().from('purchases').select('*').order('created_at', { ascending: false })
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  const { data, error } = await getClient().from('purchases').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function updatePurchase(id: string, input: CreatePurchaseInput): Promise<Purchase> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')
  if (input.total_amount <= 0) throw new Error('Purchase amount must be greater than zero.')

  const existing = await getPurchaseById(id)
  if (!existing) throw new Error('Purchase not found.')

  // Reverse old purchase's ledger impact including any offset
  const { data: oldOffsets } = await getClient()
    .from('party_offsets')
    .select('amount')
    .eq('purchase_id', id)
  const oldOffsetTotal = (oldOffsets || []).reduce((sum, o) => sum + Number(o.amount), 0)

  const reverseUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'payables_total'>> = {
    inventory_value: ledger.inventory_value - Number(existing.total_amount),
  }
  if (oldOffsetTotal > 0) {
    reverseUpdates.receivables_total = ledger.receivables_total + oldOffsetTotal
  }
  if (existing.payment_type === 'cash') {
    // Old cash was only for remaining amount (total - offset)
    const oldRemaining = Number(existing.total_amount) - oldOffsetTotal
    if (oldRemaining > 0) {
      reverseUpdates.cash_in_hand = ledger.cash_in_hand + oldRemaining
    }
  }
  if (existing.payment_type === 'credit') {
    // Old credit was only for remaining amount (total - offset)
    const oldRemaining = Number(existing.total_amount) - oldOffsetTotal
    if (oldRemaining > 0) {
      reverseUpdates.payables_total = ledger.payables_total - oldRemaining
    }
  }

  // Delete old offsets
  await getClient().from('party_offsets').delete().eq('purchase_id', id)

  // Apply new purchase with fresh offset logic
  const newLedger = await updateLedger(reverseUpdates)

  let partyId = input.party_id || null
  if (!partyId && input.supplier_name.trim()) {
    partyId = await createPartyIfMissing(input.supplier_name)
  }

  let offsetAmount = 0
  let remainingAmount = input.total_amount

  if (partyId && input.offset_enabled !== false) {
    const outstanding = await getPartyOutstandingReceivable(partyId)
    if (outstanding > 0) {
      offsetAmount = Math.min(outstanding, input.total_amount)
      remainingAmount = input.total_amount - offsetAmount
    }
  }

  if (input.payment_type === 'cash' && remainingAmount > 0 && remainingAmount > newLedger!.cash_in_hand) {
    throw new Error('Cash payment exceeds Cash in Hand balance.')
  }

  const applyUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'payables_total'>> = {
    inventory_value: newLedger!.inventory_value + input.total_amount,
  }
  if (offsetAmount > 0) {
    applyUpdates.receivables_total = newLedger!.receivables_total - offsetAmount
  }
  // Cash only decreases if there's a remaining amount after offset
  if (input.payment_type === 'cash' && remainingAmount > 0) {
    applyUpdates.cash_in_hand = newLedger!.cash_in_hand - remainingAmount
  }
  // Credit purchases increase payables by remaining amount
  if (input.payment_type === 'credit' && remainingAmount > 0) {
    applyUpdates.payables_total = newLedger!.payables_total + remainingAmount
  }

  await updateLedger(applyUpdates)

  // Create new offset if applicable
  if (offsetAmount > 0 && partyId) {
    await createPartyOffset(partyId, id, offsetAmount)
  }

  // Delete old cash transaction and log new one
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'purchase')
  if (input.payment_type === 'cash' && remainingAmount > 0) {
    await logCashTransaction(
      'purchase_cash',
      'purchase',
      id,
      remainingAmount,
      'out',
      `Purchase ${existing.purchase_number} - ${input.supplier_name}${offsetAmount > 0 ? ` (offset Rs. ${offsetAmount.toFixed(2)})` : ''}`
    )
  } else if (offsetAmount > 0) {
    await logCashTransaction(
      'purchase_credit',
      'purchase',
      id,
      offsetAmount,
      'out',
      `Purchase ${existing.purchase_number} - ${input.supplier_name} (offset Rs. ${offsetAmount.toFixed(2)})`
    )
  }

  // Update purchase record
  const { data, error } = await getClient()
    .from('purchases')
    .update({
      supplier_name: input.supplier_name.trim(),
      party_id: partyId,
      total_amount: input.total_amount,
      payment_type: input.payment_type,
      is_finalized: isFinalizedForNewPurchase(input.payment_type),
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePurchase(id: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const existing = await getPurchaseById(id)
  if (!existing) throw new Error('Purchase not found.')

  // Reverse any party offsets for this purchase
  const { data: offsets } = await getClient()
    .from('party_offsets')
    .select('amount')
    .eq('purchase_id', id)
  const offsetTotal = (offsets || []).reduce((sum, o) => sum + Number(o.amount), 0)

  const reverseUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'receivables_total' | 'payables_total'>> = {
    inventory_value: ledger.inventory_value - Number(existing.total_amount),
  }
  if (offsetTotal > 0) {
    reverseUpdates.receivables_total = ledger.receivables_total + offsetTotal
  }
  if (existing.payment_type === 'cash') {
    // Cash was only deducted for remaining amount (total - offset)
    const remaining = Number(existing.total_amount) - offsetTotal
    if (remaining > 0) {
      reverseUpdates.cash_in_hand = ledger.cash_in_hand + remaining
    }
  }
  if (existing.payment_type === 'credit') {
    // Credit was only for remaining amount (total - offset)
    const remaining = Number(existing.total_amount) - offsetTotal
    if (remaining > 0) {
      reverseUpdates.payables_total = ledger.payables_total - remaining
    }
  }

  await updateLedger(reverseUpdates)

  // Delete offsets, cash transaction log, then purchase
  await getClient().from('party_offsets').delete().eq('purchase_id', id)
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'purchase')

  const { error } = await getClient().from('purchases').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// RECEIVABLES
// ============================================

export async function getReceivables(): Promise<ReceivableWithSale[]> {
  const { data: creditSales, error } = await getClient()
    .from('sales')
    .select('*')
    .eq('payment_type', 'credit')
    .order('created_at', { ascending: false })
  if (error) throw error

  const { data: payments, error: paymentsError } = await getClient()
    .from('receivable_payments')
    .select('*')
    .order('created_at', { ascending: false })
  if (paymentsError) throw paymentsError

  // Get all party offsets grouped by party
  const { data: allOffsets, error: offsetsError } = await getClient()
    .from('party_offsets')
    .select('party_id, amount')
  if (offsetsError) throw offsetsError

  // Build a map of party_id -> total offset amount
  const partyOffsetMap: Record<string, number> = {}
  for (const o of allOffsets || []) {
    partyOffsetMap[o.party_id] = (partyOffsetMap[o.party_id] || 0) + Number(o.amount)
  }

  // We need to process sales by party and distribute offsets to invoices (FIFO)
  // First group sales by party
  const salesByParty: Record<string, typeof creditSales> = {}
  for (const sale of creditSales) {
    if (sale.party_id) {
      if (!salesByParty[sale.party_id]) salesByParty[sale.party_id] = []
      salesByParty[sale.party_id].push(sale)
    }
  }

  // Create a map to track offset usage per sale
  const saleOffsetMap: Record<string, number> = {}
  
  // Process each party's sales to distribute offsets
  for (const [partyId, partySales] of Object.entries(salesByParty)) {
    let remainingOffset = partyOffsetMap[partyId] || 0
    // Process sales in order (oldest first, to be FIFO)
    const sortedSales = [...partySales].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (const sale of sortedSales) {
      if (remainingOffset <= 0) break
      const salePayments = payments.filter((p) => p.sale_id === sale.id)
      const totalPaid = salePayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const saleOutstandingAfterPayments = Number(sale.total_sales) - totalPaid
      if (saleOutstandingAfterPayments > 0) {
        const offsetForThisSale = Math.min(remainingOffset, saleOutstandingAfterPayments)
        saleOffsetMap[sale.id] = offsetForThisSale
        remainingOffset -= offsetForThisSale
      }
    }
  }

  return creditSales.map((sale) => {
    const salePayments = payments.filter((p) => p.sale_id === sale.id)
    const totalPaid = salePayments.reduce((sum, p) => sum + Number(p.amount), 0)

    // Get offset for this specific sale
    const offsetForSale = saleOffsetMap[sale.id] || 0

    // Calculate outstanding after payments and offset
    const totalDeductions = totalPaid + offsetForSale
    const outstanding = Number(sale.total_sales) - totalDeductions
    const overpaid = Math.max(0, -outstanding)

    return {
      ...sale,
      total_paid: totalPaid,
      offset_total: offsetForSale,
      outstanding: Math.max(0, outstanding),
      overpaid,
      payments: salePayments,
    }
  })
}

export async function collectReceivablePayment(input: CreateReceivablePaymentInput): Promise<ReceivablePayment> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')
  if (input.amount <= 0) throw new Error('Payment amount must be greater than zero.')

  // Get the sale and calculate outstanding
  const sale = await getSaleById(input.sale_id)
  if (!sale) throw new Error('Sale not found.')
  if (sale.payment_type !== 'credit') throw new Error('This is not a credit sale.')

  // Calculate total already paid
  const { data: existingPayments } = await getClient()
    .from('receivable_payments')
    .select('amount')
    .eq('sale_id', input.sale_id)

  const totalPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const outstanding = Number(sale.total_sales) - totalPaid

  // Allow overpayment — the excess is tracked as overpaid

  // Insert payment
  const { data: payment, error: paymentError } = await getClient()
    .from('receivable_payments')
    .insert({
      sale_id: input.sale_id,
      customer_name: input.customer_name.trim(),
      payment_date: input.payment_date || undefined,
      method: input.method || 'cash',
      cheque_date: input.method === 'cheque' ? input.cheque_date || undefined : null,
      cheque_number: input.method === 'cheque' ? input.cheque_number?.trim() || undefined : null,
      amount: input.amount,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (paymentError) throw paymentError

  // Update ledger: receivables always decrease
  // Cheque payments go to on_cheque, others go to cash_in_hand
  const ledgerUpdates: Partial<Pick<BusinessLedger, 'cash_in_hand' | 'receivables_total' | 'on_cheque'>> = {
    receivables_total: ledger.receivables_total - input.amount,
  }
  if (input.method === 'cheque') {
    ledgerUpdates.on_cheque = ledger.on_cheque + input.amount
  } else {
    ledgerUpdates.cash_in_hand = ledger.cash_in_hand + input.amount
  }

  await updateLedger(ledgerUpdates)

  // Log cash transaction
  await logCashTransaction(
    'receivable_collection',
    'receivable_payment',
    payment.id,
    input.amount,
    'in',
    `Receivable collection${input.method ? ` (${input.method})` : ''} - ${input.customer_name} - Invoice ${sale.invoice_number}`
  )

  // If overpayment, create a payable entry with customer as supplier
  const overpaymentAmount = totalPaid + input.amount - Number(sale.total_sales)
  console.log('Overpayment check:', { totalPaid, inputAmount: input.amount, saleTotal: sale.total_sales, overpaymentAmount })
  if (overpaymentAmount > 0) {
    console.log('Creating payable for overpayment:', overpaymentAmount)
    const nextSeq = await getNextNumber('purchases', 'purchase_number', 'PO')
    const purchaseNumber = generateInvoiceNumber('PO', nextSeq)

    // Auto-create party if name provided
    let partyId = sale.party_id || null
    if (!partyId && input.customer_name.trim()) {
      partyId = await createPartyIfMissing(input.customer_name)
    }

    const { error: payableError } = await getClient()
      .from('purchases')
      .insert({
        purchase_number: purchaseNumber,
        supplier_name: input.customer_name.trim(),
        party_id: partyId,
        total_amount: overpaymentAmount,
        payment_type: 'credit',
        notes: `Overpayment from receivable - Invoice ${sale.invoice_number}`,
      })
    if (payableError) {
      console.error('Failed to create payable for overpayment:', payableError)
      throw payableError
    }
    console.log('Payable created successfully for overpayment')
  }

  return payment
}

export async function getReceivablePayments(dateFrom?: string, dateTo?: string): Promise<ReceivablePayment[]> {
  let query = getClient().from('receivable_payments').select('*').order('created_at', { ascending: false })
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteReceivablePayment(id: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  // Get the payment
  const { data: payment, error: fetchError } = await getClient()
    .from('receivable_payments')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  if (!payment) throw new Error('Payment not found.')

  // Reverse payment's ledger impact
  // Cheque payments reverse from on_cheque, others from cash_in_hand
  const reverseUpdates: Partial<Pick<BusinessLedger, 'cash_in_hand' | 'receivables_total' | 'on_cheque'>> = {
    receivables_total: ledger.receivables_total + Number(payment.amount),
  }
  if (payment.method === 'cheque') {
    reverseUpdates.on_cheque = ledger.on_cheque - Number(payment.amount)
  } else {
    reverseUpdates.cash_in_hand = ledger.cash_in_hand - Number(payment.amount)
  }

  await updateLedger(reverseUpdates)

  // Delete cash transaction log
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'receivable_payment')

  // Delete payment
  const { error } = await getClient().from('receivable_payments').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// PAYABLES
// ============================================

export async function getPayables(): Promise<PayableWithPurchase[]> {
  const { data: creditPurchases, error } = await getClient()
    .from('purchases')
    .select('*')
    .eq('payment_type', 'credit')
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!creditPurchases) return []

  const result: PayableWithPurchase[] = []
  for (const purchase of creditPurchases) {
    const { data: payments } = await getClient()
      .from('payable_payments')
      .select('*')
      .eq('purchase_id', purchase.id)
      .order('created_at', { ascending: false })
    const paymentList = (payments || []) as PayablePayment[]

    // Get offsets for this purchase
    const { data: offsets } = await getClient()
      .from('party_offsets')
      .select('amount')
      .eq('purchase_id', purchase.id)
    const offsetTotal = (offsets || []).reduce((sum, o) => sum + Number(o.amount), 0)

    const totalPaid = paymentList.reduce((sum, p) => sum + Number(p.amount), 0)
    const outstanding = Number(purchase.total_amount) - totalPaid - offsetTotal

    if (outstanding > 0.01) {
      result.push({
        ...purchase,
        total_paid: totalPaid,
        outstanding,
        offset_total: offsetTotal,
        payments: paymentList,
      })
    }
  }
  return result
}

export async function createPayablePayment(input: CreatePayablePaymentInput): Promise<PayablePayment> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  if (input.amount <= 0) throw new Error('Payment amount must be greater than zero.')
  if (input.amount > ledger.cash_in_hand) throw new Error('Payment amount exceeds Cash in Hand.')

  const { data, error } = await getClient()
    .from('payable_payments')
    .insert({
      purchase_id: input.purchase_id,
      supplier_name: input.supplier_name.trim(),
      payment_date: input.payment_date || undefined,
      method: input.method || 'cash',
      cheque_date: input.method === 'cheque' ? input.cheque_date || undefined : null,
      cheque_number: input.method === 'cheque' ? input.cheque_number?.trim() || undefined : null,
      amount: input.amount,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error

  // Update ledger: cash decreases, payables decreases
  // Cheque payments decrease on_cheque, others decrease cash_in_hand
  const ledgerUpdates: Partial<Pick<BusinessLedger, 'cash_in_hand' | 'payables_total' | 'on_cheque'>> = {
    payables_total: ledger.payables_total - input.amount,
  }
  if (input.method === 'cheque') {
    ledgerUpdates.on_cheque = ledger.on_cheque - input.amount
  } else {
    ledgerUpdates.cash_in_hand = ledger.cash_in_hand - input.amount
  }
  await updateLedger(ledgerUpdates)

  // Log cash transaction
  await logCashTransaction(
    'payable_payment',
    'payable_payment',
    data.id,
    input.amount,
    'out',
    `Supplier payment - ${input.supplier_name}`
  )

  return data
}

export async function deletePayablePayment(id: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const { data: payment, error: fetchError } = await getClient()
    .from('payable_payments')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  if (!payment) throw new Error('Payment not found.')

  // Reverse payment's ledger impact: cash increases, payables increases
  await updateLedger({
    cash_in_hand: ledger.cash_in_hand + Number(payment.amount),
    payables_total: ledger.payables_total + Number(payment.amount),
  })

  // Delete cash transaction log
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'payable_payment')

  // Delete payment
  const { error } = await getClient().from('payable_payments').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// CASH TRANSACTIONS
// ============================================

export async function getCashTransactions(dateFrom?: string, dateTo?: string): Promise<CashTransaction[]> {
  let query = getClient().from('cash_transactions').select('*').order('created_at', { ascending: false })
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ============================================
// DASHBOARD
// ============================================

export async function getDashboardStats(): Promise<DashboardStats> {
  const ledger = await getLedger()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

  const [
    salesToday,
    purchasesToday,
    finalizedAllSales,
    estimatedAllSales,
    allExpenses,
    todayFin,
    todayEst,
    monthFin,
    monthEst,
    yearFin,
    yearEst,
  ] = await Promise.all([
    getClient().from('sales').select('total_sales').gte('invoice_date', todayStr),
    getClient().from('purchases').select('total_amount').gte('created_at', todayStr),
    getClient().from('sales').select('total_profit').eq('is_finalized', true),
    getClient().from('sales').select('total_profit'),
    getClient().from('expenses').select('amount').eq('is_finalized', true),
    getClient().from('sales').select('total_profit').gte('invoice_date', todayStr).eq('is_finalized', true),
    getClient().from('sales').select('total_profit').gte('invoice_date', todayStr),
    getClient().from('sales').select('total_profit').gte('invoice_date', monthStart).eq('is_finalized', true),
    getClient().from('sales').select('total_profit').gte('invoice_date', monthStart),
    getClient().from('sales').select('total_profit').gte('invoice_date', yearStart).eq('is_finalized', true),
    getClient().from('sales').select('total_profit').gte('invoice_date', yearStart),
  ])

  const todaySales = (salesToday.data || []).reduce((sum, s) => sum + Number(s.total_sales), 0)
  const todayPurchases = (purchasesToday.data || []).reduce((sum, p) => sum + Number(p.total_amount), 0)

  const sumPL = (rows: { total_profit: number | string }[]) => {
    let tp = 0
    let tl = 0
    for (const s of rows) {
      const p = Number(s.total_profit)
      tp += Math.max(0, p)
      tl += Math.min(0, p)
    }
    return { tp, tl, net: tp + tl }
  }

  const finAll = sumPL((finalizedAllSales.data || []) as { total_profit: number | string }[])
  const estAll = sumPL((estimatedAllSales.data || []) as { total_profit: number | string }[])
  const totalExpenses = (allExpenses.data || []).reduce((sum, e) => sum + Number(e.amount), 0)

  const finToday = sumPL((todayFin.data || []) as { total_profit: number | string }[])
  const estToday = sumPL((todayEst.data || []) as { total_profit: number | string }[])
  const finMonth = sumPL((monthFin.data || []) as { total_profit: number | string }[])
  const estMonth = sumPL((monthEst.data || []) as { total_profit: number | string }[])
  const finYear = sumPL((yearFin.data || []) as { total_profit: number | string }[])
  const estYear = sumPL((yearEst.data || []) as { total_profit: number | string }[])

  return {
    inventoryValue: ledger?.inventory_value ?? 0,
    cashInHand: ledger?.cash_in_hand ?? 0,
    receivablesTotal: ledger?.receivables_total ?? 0,
    payablesTotal: ledger?.payables_total ?? 0,
    onCheque: ledger?.on_cheque ?? 0,
    todaySales,
    todayPurchases,
    todaySalesCount: salesToday.data?.length ?? 0,
    todayPurchasesCount: purchasesToday.data?.length ?? 0,
    totalProfit: finAll.tp,
    totalLoss: finAll.tl,
    netProfit: finAll.net - totalExpenses,
    todayProfit: finToday.net,
    monthProfit: finMonth.net,
    yearProfit: finYear.net,
    totalExpenses,
    estimatedTotalProfit: estAll.tp,
    estimatedTotalLoss: estAll.tl,
    estimatedNetProfit: estAll.net - totalExpenses,
    estimatedTodayProfit: estToday.net,
    estimatedMonthProfit: estMonth.net,
    estimatedYearProfit: estYear.net,
  }
}

export async function getMonthlyProfitTrend(months = 6, options?: { includePendingSales?: boolean }): Promise<MonthlyProfitTrend[]> {
  const start = new Date()
  start.setMonth(start.getMonth() - (months - 1))
  start.setDate(1)
  const startDate = start.toISOString().split('T')[0]

  let q = getClient()
    .from('sales')
    .select('invoice_date, total_profit, total_sales, total_cost')
    .gte('invoice_date', startDate)
    .order('invoice_date', { ascending: true })
  if (!options?.includePendingSales) q = q.eq('is_finalized', true)
  const { data, error } = await q
  if (error) throw error

  const byMonth = new Map<string, MonthlyProfitTrend>()

  for (const row of data || []) {
    const d = row.invoice_date ? new Date(row.invoice_date) : new Date()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

    const profitVal = Number(row.total_profit)
    const revenueVal = Number(row.total_sales)
    const costVal = Number(row.total_cost)

    const existing = byMonth.get(key)
    if (!existing) {
      byMonth.set(key, {
        month: label,
        profit: Math.max(0, profitVal),
        loss: Math.min(0, profitVal),
        revenue: revenueVal,
        cost: costVal,
      })
    } else {
      existing.profit += Math.max(0, profitVal)
      existing.loss += Math.min(0, profitVal)
      existing.revenue += revenueVal
      existing.cost += costVal
    }
  }

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v)
}

export async function getTopProfitInvoices(limit = 3, includePendingSales = true): Promise<Sale[]> {
  let q = getClient().from('sales').select('*').order('total_profit', { ascending: false }).limit(limit)
  if (!includePendingSales) q = q.eq('is_finalized', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getTopLossInvoices(limit = 3, includePendingSales = true): Promise<Sale[]> {
  let q = getClient().from('sales').select('*').order('total_profit', { ascending: true }).limit(limit)
  if (!includePendingSales) q = q.eq('is_finalized', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// ============================================
// REPORTS
// ============================================

export async function getReportStats(dateFrom?: string, dateTo?: string): Promise<ReportStats> {
  let salesQuery = getClient().from('sales').select('total_sales, payment_type')
  let purchasesQuery = getClient().from('purchases').select('total_amount, payment_type')
  let receivablePaymentsQuery = getClient().from('receivable_payments').select('amount')

  if (dateFrom) {
    salesQuery = salesQuery.gte('created_at', dateFrom)
    purchasesQuery = purchasesQuery.gte('created_at', dateFrom)
    receivablePaymentsQuery = receivablePaymentsQuery.gte('created_at', dateFrom)
  }
  if (dateTo) {
    salesQuery = salesQuery.lte('created_at', dateTo)
    purchasesQuery = purchasesQuery.lte('created_at', dateTo)
    receivablePaymentsQuery = receivablePaymentsQuery.lte('created_at', dateTo)
  }

  const [salesRes, purchasesRes, receivablePaymentsRes] = await Promise.all([
    salesQuery,
    purchasesQuery,
    receivablePaymentsQuery,
  ])

  const sales = salesRes.data || []
  const purchases = purchasesRes.data || []
  const receivablePayments = receivablePaymentsRes.data || []

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total_sales), 0)
  const cashSales = sales.filter((s) => s.payment_type === 'cash').reduce((sum, s) => sum + Number(s.total_sales), 0)
  const creditSales = sales.filter((s) => s.payment_type === 'credit').reduce((sum, s) => sum + Number(s.total_sales), 0)

  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0)
  const cashPurchases = purchases.filter((p) => p.payment_type === 'cash').reduce((sum, p) => sum + Number(p.total_amount), 0)
  const creditPurchases = purchases.filter((p) => p.payment_type === 'credit').reduce((sum, p) => sum + Number(p.total_amount), 0)

  const totalReceivableCollections = receivablePayments.reduce((sum, r) => sum + Number(r.amount), 0)

  return {
    totalSales,
    totalPurchases,
    totalReceivableCollections,
    cashSales,
    creditSales,
    cashPurchases,
    creditPurchases,
    stockMovement: totalPurchases - totalSales,
    cashMovement: cashSales + totalReceivableCollections - cashPurchases,
    salesCount: sales.length,
    purchasesCount: purchases.length,
  }
}

// ============================================
// RECENT TRANSACTIONS (for dashboard)
// ============================================

export interface RecentTransaction {
  id: string
  type: 'sale' | 'purchase' | 'receivable_payment' | 'expense'
  reference: string
  description: string
  amount: number
  direction: 'in' | 'out'
  created_at: string
}

export async function getRecentTransactions(limit = 10): Promise<RecentTransaction[]> {
  const [sales, purchases, receivablePayments, expenses] = await Promise.all([
    getClient().from('sales').select('*').order('created_at', { ascending: false }).limit(limit),
    getClient().from('purchases').select('*').order('created_at', { ascending: false }).limit(limit),
    getClient().from('receivable_payments').select('*').order('created_at', { ascending: false }).limit(limit),
    getClient().from('expenses').select('*').order('created_at', { ascending: false }).limit(limit),
  ])

  const transactions: RecentTransaction[] = [
    ...(sales.data || []).map((s) => ({
      id: s.id,
      type: 'sale' as const,
      reference: s.invoice_number,
      description: `Sale to ${s.customer_name}`,
      amount: Number(s.total_sales),
      direction: s.payment_type === 'cash' ? ('in' as const) : ('in' as const),
      created_at: s.created_at,
    })),
    ...(purchases.data || []).map((p) => ({
      id: p.id,
      type: 'purchase' as const,
      reference: p.purchase_number,
      description: `Purchase from ${p.supplier_name}`,
      amount: Number(p.total_amount),
      direction: 'out' as const,
      created_at: p.created_at,
    })),
    ...(receivablePayments.data || []).map((r) => ({
      id: r.id,
      type: 'receivable_payment' as const,
      reference: 'Payment',
      description: `Collection from ${r.customer_name}`,
      amount: Number(r.amount),
      direction: 'in' as const,
      created_at: r.created_at,
    })),
    ...(expenses.data || []).map((e) => ({
      id: e.id,
      type: 'expense' as const,
      reference: e.category,
      description: `Expense: ${e.title}`,
      amount: Number(e.amount),
      direction: 'out' as const,
      created_at: e.created_at,
    })),
  ]

  return transactions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

// ============================================
// EXPENSES
// ============================================

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')
  if (input.amount <= 0) throw new Error('Expense amount must be greater than zero.')
  if (input.amount > ledger.cash_in_hand) throw new Error('Expense amount exceeds Cash in Hand balance.')

  const { data: expense, error } = await getClient()
    .from('expenses')
    .insert({
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      is_finalized: true,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error

  // Update ledger: cash decreases
  await updateLedger({ cash_in_hand: ledger.cash_in_hand - input.amount })

  // Log cash transaction
  await logCashTransaction('expense', 'expense', expense.id, input.amount, 'out', `Expense: ${input.title}`)

  return expense
}

export async function getExpenses(dateFrom?: string, dateTo?: string, options?: { finalizedOnly?: boolean }): Promise<Expense[]> {
  let query = getClient().from('expenses').select('*').order('created_at', { ascending: false })
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  if (options?.finalizedOnly) query = query.eq('is_finalized', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteExpense(id: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const { data: expense, error: fetchError } = await getClient()
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  if (!expense) throw new Error('Expense not found.')

  // Reverse expense's ledger impact: cash increases
  await updateLedger({ cash_in_hand: ledger.cash_in_hand + Number(expense.amount) })

  // Delete cash transaction log
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'expense')

  // Delete expense
  const { error } = await getClient().from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// RETURNS
// ============================================

async function getNextReturnNumber(): Promise<string> {
  const prefix = 'RET'
  const currentMonth = `${prefix}${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const { data, error } = await getClient()
    .from('returns')
    .select('return_number')
    .like('return_number', `${currentMonth}%`)
    .order('return_number', { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return `${currentMonth}-001`

  const lastNumber = data[0].return_number
  const seqPart = parseInt(lastNumber.split('-')[1], 10)
  const nextSeq = isNaN(seqPart) ? 1 : seqPart + 1
  return `${currentMonth}-${String(nextSeq).padStart(3, '0')}`
}

export async function getReturns(): Promise<Return[]> {
  const { data, error } = await getClient()
    .from('returns')
    .select('*, return_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createReturn(input: CreateReturnInput): Promise<Return> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const returnNumber = await getNextReturnNumber()

  // Create return record
  const { data: ret, error: insertError } = await getClient()
    .from('returns')
    .insert({
      return_number: returnNumber,
      sale_id: input.sale_id || null,
      customer_name: input.customer_name,
      party_id: input.party_id || null,
      return_date: input.return_date,
      total_cost: input.total_cost,
      total_refund: input.total_refund,
      refund_method: input.refund_method,
      notes: input.notes || null,
    })
    .select()
    .single()
  if (insertError) throw insertError

  // Create return items
  if (input.items.length > 0) {
    const items = input.items.map((item) => ({
      return_id: ret.id,
      item_name: item.item_name,
      quantity: item.quantity,
      cost_price: item.cost_price,
      refund_price: item.refund_price,
    }))
    const { error: itemsError } = await getClient().from('return_items').insert(items)
    if (itemsError) throw itemsError
  }

  // Update ledger: inventory increases (item comes back), cash decreases (refund paid out)
  const ledgerUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'on_cheque'>> = {
    inventory_value: ledger.inventory_value + input.total_cost,
  }

  // Cash refund decreases cash_in_hand (or on_cheque for cheque refunds)
  if (input.total_refund > 0) {
    if (input.refund_method === 'cheque') {
      ledgerUpdates.on_cheque = ledger.on_cheque - input.total_refund
    } else {
      ledgerUpdates.cash_in_hand = ledger.cash_in_hand - input.total_refund
    }
  }

  await updateLedger(ledgerUpdates)

  // Log cash transaction (money going out for refund)
  if (input.total_refund > 0) {
    await logCashTransaction('return', 'return', ret.id, input.total_refund, 'out', `Return refund: ${returnNumber}`)
  }

  // Fetch with items
  const { data: fullReturn, error: fetchError } = await getClient()
    .from('returns')
    .select('*, return_items(*)')
    .eq('id', ret.id)
    .single()
  if (fetchError) throw fetchError
  return fullReturn
}

export async function deleteReturn(id: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const { data: ret, error: fetchError } = await getClient()
    .from('returns')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  if (!ret) throw new Error('Return not found.')

  // Reverse ledger impacts: inventory decreases, cash increases
  const ledgerUpdates: Partial<Pick<BusinessLedger, 'inventory_value' | 'cash_in_hand' | 'on_cheque'>> = {
    inventory_value: ledger.inventory_value - Number(ret.total_cost),
  }

  if (Number(ret.total_refund) > 0) {
    if (ret.refund_method === 'cheque') {
      ledgerUpdates.on_cheque = ledger.on_cheque + Number(ret.total_refund)
    } else {
      ledgerUpdates.cash_in_hand = ledger.cash_in_hand + Number(ret.total_refund)
    }
  }

  await updateLedger(ledgerUpdates)

  // Delete cash transaction log
  await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'return')

  // Delete return (cascade deletes return_items)
  const { error } = await getClient().from('returns').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// MONTHLY SNAPSHOTS
// ============================================

export async function getMonthlySnapshots(): Promise<MonthlySnapshot[]> {
  const { data, error } = await getClient()
    .from('monthly_snapshots')
    .select('*')
    .order('month_key', { ascending: false })

  if (error) throw error
  return (data || []) as MonthlySnapshot[]
}

export async function closeMonth(monthKey: string): Promise<MonthlySnapshot> {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (!year || !month || month < 1 || month > 12) throw new Error('Invalid month key. Use YYYY-MM.')

  const { data: existing, error: exErr } = await getClient()
    .from('monthly_snapshots')
    .select('id')
    .eq('month_key', monthKey)
    .maybeSingle()
  if (exErr) throw exErr
  if (existing) throw new Error(`Month ${monthKey} is already closed. Snapshots are immutable.`)

  const dateFrom = `${yearStr}-${monthStr}-13`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const dateTo = `${nextYear}-${String(nextMonth).padStart(2, '0')}-12`

  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const dateToEnd = `${dateTo}T23:59:59.999Z`
  const dateFromStart = `${dateFrom}T00:00:00.000Z`

  const { error: sFinErr } = await getClient()
    .from('sales')
    .update({ is_finalized: true })
    .gte('invoice_date', dateFrom)
    .lte('invoice_date', dateTo)
  if (sFinErr) throw sFinErr

  const { error: pFinErr } = await getClient()
    .from('purchases')
    .update({ is_finalized: true })
    .gte('created_at', dateFromStart)
    .lte('created_at', dateToEnd)
  if (pFinErr) throw pFinErr

  const { error: eFinErr } = await getClient()
    .from('expenses')
    .update({ is_finalized: true })
    .gte('created_at', dateFromStart)
    .lte('created_at', dateToEnd)
  if (eFinErr) throw eFinErr

  const sales = await getSales(dateFrom, dateTo)
  const expenses = await getExpenses(dateFromStart, dateToEnd, { finalizedOnly: true })
  const purchases = await getPurchases(dateFromStart, dateToEnd)

  const totalProfit = sales.reduce((s, x) => s + Math.max(0, Number(x.total_profit)), 0)
  const totalLoss = sales.reduce((s, x) => s + Math.abs(Math.min(0, Number(x.total_profit))), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const netProfit = totalProfit - totalLoss - totalExpenses
  const invoiceCount = sales.length
  const totalSalesAmount = sales.reduce((s, x) => s + Number(x.total_sales), 0)
  const totalCostAmount = sales.reduce((s, x) => s + Number(x.total_cost), 0)
  const totalPurchasesSum = purchases.reduce((s, p) => s + Number(p.total_amount), 0)

  const freshLedger = await getLedger()
  const receivablesAtClose = freshLedger?.receivables_total ?? 0

  const snapshotData = {
    sales: sales.map((s) => ({
      invoice_number: s.invoice_number,
      customer_name: s.customer_name,
      total_cost: Number(s.total_cost),
      total_sales: Number(s.total_sales),
      total_profit: Number(s.total_profit),
      payment_type: s.payment_type,
      invoice_date: s.invoice_date,
      is_finalized: true,
    })),
    expenses: expenses.map((e) => ({
      title: e.title,
      category: e.category,
      amount: Number(e.amount),
      created_at: e.created_at,
    })),
    purchases: purchases.map((p) => ({
      purchase_number: p.purchase_number,
      supplier_name: p.supplier_name,
      total_amount: Number(p.total_amount),
      payment_type: p.payment_type,
      created_at: p.created_at,
    })),
  }

  const { data, error } = await getClient()
    .from('monthly_snapshots')
    .insert({
      month_key: monthKey,
      total_profit: totalProfit,
      total_loss: totalLoss,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      invoice_count: invoiceCount,
      total_sales_amount: totalSalesAmount,
      total_cost_amount: totalCostAmount,
      total_purchases: totalPurchasesSum,
      total_receivables_at_close: receivablesAtClose,
      snapshot_data: snapshotData,
    })
    .select()
    .single()

  if (error) throw error
  return data as MonthlySnapshot
}

export async function deleteMonthlySnapshot(id: string): Promise<void> {
  const { error } = await getClient().from('monthly_snapshots').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// MANUAL PROFIT & LOSS (notebook — typed only)
// ============================================

function computeManualProfit(sales: number, cost: number, expense: number): number {
  return Number(sales) - Number(cost) - Number(expense)
}

function mapManualProfitLossRow(row: Record<string, unknown>): ManualProfitLoss {
  return {
    id: String(row.id),
    entry_date: String(row.entry_date),
    description: String(row.description ?? ''),
    sales_amount: Number(row.sales_amount ?? 0),
    cost_amount: Number(row.cost_amount ?? 0),
    expense_amount: Number(row.expense_amount ?? 0),
    profit_amount: Number(row.profit_amount ?? 0),
    notes: row.notes != null ? String(row.notes) : null,
    created_at: String(row.created_at),
  }
}

export async function getManualProfitLossEntries(dateFrom?: string, dateTo?: string): Promise<ManualProfitLoss[]> {
  let q = getClient()
    .from('manual_profit_loss')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (dateFrom) q = q.gte('entry_date', dateFrom)
  if (dateTo) q = q.lte('entry_date', dateTo)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((r) => mapManualProfitLossRow(r as Record<string, unknown>))
}

export async function createManualProfitLossEntry(input?: Partial<ManualProfitLossInput>): Promise<ManualProfitLoss> {
  const sales = input?.sales_amount ?? 0
  const cost = input?.cost_amount ?? 0
  const expense = input?.expense_amount ?? 0
  const profit = computeManualProfit(sales, cost, expense)
  const { data, error } = await getClient()
    .from('manual_profit_loss')
    .insert({
      entry_date: input?.entry_date ?? new Date().toISOString().split('T')[0],
      description: input?.description?.trim() ?? '',
      sales_amount: sales,
      cost_amount: cost,
      expense_amount: expense,
      profit_amount: profit,
      notes: input?.notes?.trim() ? input.notes.trim() : null,
    })
    .select()
    .single()
  if (error) throw error
  return mapManualProfitLossRow(data as Record<string, unknown>)
}

export async function updateManualProfitLossEntry(id: string, input: ManualProfitLossInput): Promise<ManualProfitLoss> {
  const sales = Number.isFinite(Number(input.sales_amount)) ? Number(input.sales_amount) : 0
  const cost = Number.isFinite(Number(input.cost_amount)) ? Number(input.cost_amount) : 0
  const expense = Number.isFinite(Number(input.expense_amount)) ? Number(input.expense_amount) : 0
  const profit = computeManualProfit(sales, cost, expense)
  const { data, error } = await getClient()
    .from('manual_profit_loss')
    .update({
      entry_date: input.entry_date,
      description: input.description.trim(),
      sales_amount: sales,
      cost_amount: cost,
      expense_amount: expense,
      profit_amount: profit,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapManualProfitLossRow(data as Record<string, unknown>)
}

export async function deleteManualProfitLossEntry(id: string): Promise<void> {
  const { error } = await getClient().from('manual_profit_loss').delete().eq('id', id)
  if (error) throw error
}

/** Removes every manual P&L notebook row (for starting a new month/report). */
export async function clearAllManualProfitLossEntries(): Promise<void> {
  const { error } = await getClient()
    .from('manual_profit_loss')
    .delete()
    .gte('entry_date', '1900-01-01')
  if (error) throw error
}

function buildManualPnlReportTitle(periodFrom: string, periodTo: string): string {
  const dFrom = new Date(`${periodFrom}T12:00:00`)
  const dTo = new Date(`${periodTo}T12:00:00`)
  if (periodFrom.slice(0, 7) === periodTo.slice(0, 7)) {
    return dFrom.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(dFrom)} – ${fmt(dTo)}`
}

function mapManualPnlReportRow(item: unknown): ManualPnlReportRow {
  const r = item as Record<string, unknown>
  return {
    entry_date: String(r.entry_date ?? ''),
    description: String(r.description ?? ''),
    sales_amount: Number(r.sales_amount ?? 0),
    cost_amount: Number(r.cost_amount ?? 0),
    expense_amount: Number(r.expense_amount ?? 0),
    profit_amount: Number(r.profit_amount ?? 0),
    notes: r.notes != null ? String(r.notes) : null,
  }
}

function mapManualPnlReport(row: Record<string, unknown>, includeData: boolean): ManualPnlReport {
  const raw = row.report_data
  const report_data = includeData && Array.isArray(raw) ? raw.map(mapManualPnlReportRow) : []
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    period_from: row.period_from != null ? String(row.period_from) : null,
    period_to: row.period_to != null ? String(row.period_to) : null,
    total_sales: Number(row.total_sales ?? 0),
    total_cost: Number(row.total_cost ?? 0),
    total_expenses: Number(row.total_expenses ?? 0),
    net_profit: Number(row.net_profit ?? 0),
    row_count: Number(row.row_count ?? 0),
    report_data,
    archived_at: String(row.archived_at),
  }
}

function mapManualPnlReportSummary(row: Record<string, unknown>): ManualPnlReportSummary {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    period_from: row.period_from != null ? String(row.period_from) : null,
    period_to: row.period_to != null ? String(row.period_to) : null,
    total_sales: Number(row.total_sales ?? 0),
    total_cost: Number(row.total_cost ?? 0),
    total_expenses: Number(row.total_expenses ?? 0),
    net_profit: Number(row.net_profit ?? 0),
    row_count: Number(row.row_count ?? 0),
    archived_at: String(row.archived_at),
  }
}

/** Saves the full notebook to reports, then clears live rows. */
export async function archiveAndClearManualProfitLoss(): Promise<ManualPnlReport | null> {
  const rows = await getManualProfitLossEntries()
  if (rows.length === 0) {
    await clearAllManualProfitLossEntries()
    return null
  }

  let totalSales = 0
  let totalCost = 0
  let totalExpenses = 0
  const dates = rows.map((r) => r.entry_date.slice(0, 10)).sort()
  const periodFrom = dates[0]
  const periodTo = dates[dates.length - 1]

  const report_data: ManualPnlReportRow[] = rows.map((r) => {
    totalSales += Number(r.sales_amount) || 0
    totalCost += Number(r.cost_amount) || 0
    totalExpenses += Number(r.expense_amount) || 0
    return {
      entry_date: r.entry_date.slice(0, 10),
      description: r.description,
      sales_amount: Number(r.sales_amount) || 0,
      cost_amount: Number(r.cost_amount) || 0,
      expense_amount: Number(r.expense_amount) || 0,
      profit_amount: Number(r.profit_amount) || 0,
      notes: r.notes,
    }
  })

  const netProfit = totalSales - totalCost - totalExpenses
  const title = buildManualPnlReportTitle(periodFrom, periodTo)

  const { data, error } = await getClient()
    .from('manual_pnl_reports')
    .insert({
      title,
      period_from: periodFrom,
      period_to: periodTo,
      total_sales: totalSales,
      total_cost: totalCost,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      row_count: rows.length,
      report_data,
    })
    .select()
    .single()

  if (error) throw error
  await clearAllManualProfitLossEntries()
  return mapManualPnlReport(data as Record<string, unknown>, true)
}

export async function getManualPnlReportSummaries(): Promise<ManualPnlReportSummary[]> {
  const { data, error } = await getClient()
    .from('manual_pnl_reports')
    .select(
      'id, title, period_from, period_to, total_sales, total_cost, total_expenses, net_profit, row_count, archived_at'
    )
    .order('archived_at', { ascending: false })
  if (error) throw error
  return (data || []).map((r) => mapManualPnlReportSummary(r as Record<string, unknown>))
}

export async function getManualPnlReportById(id: string): Promise<ManualPnlReport> {
  const { data, error } = await getClient().from('manual_pnl_reports').select('*').eq('id', id).single()
  if (error) throw error
  return mapManualPnlReport(data as Record<string, unknown>, true)
}

export async function deleteManualPnlReport(id: string): Promise<void> {
  const { error } = await getClient().from('manual_pnl_reports').delete().eq('id', id)
  if (error) throw error
}

export async function clearReceivableCheque(paymentId: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const { data: payment, error: fetchError } = await getClient()
    .from('receivable_payments')
    .select('*')
    .eq('id', paymentId)
    .single()
  if (fetchError) throw fetchError
  if (!payment) throw new Error('Payment not found.')
  if (payment.method !== 'cheque') throw new Error('This is not a cheque payment.')
  if (payment.cheque_status === 'cleared') throw new Error('Cheque is already cleared.')

  // Update ledger: move from on_cheque to cash_in_hand
  await updateLedger({
    on_cheque: ledger.on_cheque - Number(payment.amount),
    cash_in_hand: ledger.cash_in_hand + Number(payment.amount),
  })

  // Update payment status
  const { error: updateError } = await getClient()
    .from('receivable_payments')
    .update({ cheque_status: 'cleared' })
    .eq('id', paymentId)
  if (updateError) throw updateError

  // Log cash transaction
  await logCashTransaction('receivable_cheque_cleared', 'receivable_payment', paymentId, Number(payment.amount), 'in', `Cheque cleared: ${payment.cheque_number || 'N/A'}`)
}

export async function clearPayableCheque(paymentId: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const { data: payment, error: fetchError } = await getClient()
    .from('payable_payments')
    .select('*')
    .eq('id', paymentId)
    .single()
  if (fetchError) throw fetchError
  if (!payment) throw new Error('Payment not found.')
  if (payment.method !== 'cheque') throw new Error('This is not a cheque payment.')
  if (payment.cheque_status === 'cleared') throw new Error('Cheque is already cleared.')

  // Update ledger: move from on_cheque to cash_in_hand (cheque was already deducted from on_cheque when paid)
  // When cleared, the amount is removed from on_cheque (it was already there) and cash_in_hand decreases
  await updateLedger({
    on_cheque: ledger.on_cheque + Number(payment.amount),
    cash_in_hand: ledger.cash_in_hand - Number(payment.amount),
  })

  // Update payment status
  const { error: updateError } = await getClient()
    .from('payable_payments')
    .update({ cheque_status: 'cleared' })
    .eq('id', paymentId)
  if (updateError) throw updateError

  // Log cash transaction
  await logCashTransaction('payable_cheque_cleared', 'payable_payment', paymentId, Number(payment.amount), 'out', `Cheque cleared: ${payment.cheque_number || 'N/A'}`)
}

export async function confirmChequeSale(saleId: string): Promise<void> {
  const ledger = await getLedger()
  if (!ledger) throw new Error('No active ledger. Set up opening balances first.')

  const { data: sale, error: fetchError } = await getClient()
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .single()
  if (fetchError) throw fetchError
  if (!sale) throw new Error('Sale not found.')
  if (sale.payment_type !== 'chequesale') throw new Error('This is not a cheque sale.')
  if (sale.cheque_confirmed) throw new Error('Cheque sale is already confirmed.')

  // Update ledger: transfer to cash_in_hand
  await updateLedger({
    cash_in_hand: ledger.cash_in_hand + Number(sale.total_sales),
  })

  // Update sale status
  const { error: updateError } = await getClient()
    .from('sales')
    .update({ cheque_confirmed: true })
    .eq('id', saleId)
  if (updateError) throw updateError

  // Log cash transaction
  await logCashTransaction('sale_cheque_confirmed', 'sale', saleId, Number(sale.total_sales), 'in', `Cheque confirmed: ${sale.invoice_number} - ${sale.customer_name}`)
}

// ============================================
// CHEQUE MANAGEMENT
// ============================================
export async function getCheques(): Promise<Cheque[]> {
  const { data, error } = await getClient().from('cheques').select('*').order('cheque_bought_date', { ascending: false })
  if (error) throw error
  return data.map((c: any) => ({
    ...c,
    amount: Number(c.amount)
  }))
}

export async function getChequeById(id: string): Promise<Cheque> {
  const { data, error } = await getClient().from('cheques').select('*').eq('id', id).single()
  if (error) throw error
  return { ...data, amount: Number(data.amount) }
}

export async function createCheque(input: CreateChequeInput): Promise<Cheque> {
  const { data, error } = await getClient().from('cheques').insert([input]).select('*').single()
  if (error) throw error
  return { ...data, amount: Number(data.amount) }
}

export async function updateCheque(id: string, input: UpdateChequeInput): Promise<Cheque> {
  const existing = await getChequeById(id)
  const wasCleared = existing.status === 'cleared'
  const willBeCleared = (input.status ?? existing.status) === 'cleared'

  // Validate: if status is not pending, need cheque_given_to_type and cheque_given_to_name
  if ((input.status && input.status !== 'pending') || (!input.status && existing.status !== 'pending')) {
    const givenToType = input.cheque_given_to_type !== undefined ? input.cheque_given_to_type : existing.cheque_given_to_type
    const givenToName = input.cheque_given_to_name !== undefined ? input.cheque_given_to_name : existing.cheque_given_to_name
    if (!givenToType || !givenToName?.trim()) {
      throw new Error('When cheque status is not pending, both "Given To Type" and "Given To Name" are required.')
    }
  }

  const ledger = await getLedger()

  if (willBeCleared && !wasCleared && ledger) {
    // If status is changing to cleared, add to cash_in_hand
    const amount = input.amount !== undefined ? Number(input.amount) : Number(existing.amount)
    await updateLedger({
      cash_in_hand: ledger.cash_in_hand + amount
    })
    await logCashTransaction('cheque_cleared', 'cheque', id, amount, 'in', `Cheque #${existing.cheque_number} cleared`)
  } else if (!willBeCleared && wasCleared && ledger) {
    // If status is changing from cleared, remove from cash_in_hand
    const amount = Number(existing.amount)
    await updateLedger({
      cash_in_hand: ledger.cash_in_hand - amount
    })
    // Delete the cash transaction for the cheque cleared
    await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'cheque')
  }

  const { data, error } = await getClient().from('cheques').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return { ...data, amount: Number(data.amount) }
}

// ============================================
// CUSTOMER LEDGER / FINANCIAL PROFILE
// ============================================
export async function getCustomerLedgerTransactions(
  partyId: string,
  dateFrom?: string,
  dateTo?: string,
  transactionType?: CustomerLedgerTransactionType
): Promise<{ transactions: CustomerLedgerTransaction[], summary: CustomerLedgerSummary }> {
  const allTransactions: CustomerLedgerTransaction[] = [];

  // 1. Fetch Credit Sales for this party
  const { data: sales } = await getClient().from('sales').select('*').eq('party_id', partyId).eq('payment_type', 'credit');
  if (sales) {
    sales.forEach((sale) => {
      allTransactions.push({
        id: sale.id,
        date: sale.invoice_date || sale.created_at.slice(0, 10),
        type: 'sale',
        description: `Invoice ${sale.invoice_number}`,
        debit: Number(sale.total_sales),
        credit: 0,
        referenceId: sale.id,
      });
    });
  }

  // 2. Fetch Receivable Payments for this party's sales
  const saleIds = (sales || []).map((s) => s.id);
  if (saleIds.length > 0) {
    const { data: payments } = await getClient().from('receivable_payments').select('*').in('sale_id', saleIds);
    if (payments) {
      payments.forEach((payment) => {
        allTransactions.push({
          id: payment.id,
          date: payment.payment_date || payment.created_at.slice(0, 10),
          type: 'payment',
          description: `Payment (${payment.method || 'cash'})`,
          debit: 0,
          credit: Number(payment.amount),
          referenceId: payment.id,
        });
      });
    }
  }

  // 3. Fetch Party Offsets
  const { data: offsets } = await getClient().from('party_offsets').select('*, purchases!inner(purchase_number)').eq('party_id', partyId);
  if (offsets) {
    (offsets as any[]).forEach((offset) => {
      allTransactions.push({
        id: offset.id,
        date: offset.created_at.slice(0, 10),
        type: 'offset',
        description: `Offset - ${offset.purchases.purchase_number}`,
        debit: 0,
        credit: Number(offset.amount),
        referenceId: offset.id,
      });
    });
  }

  // 4. Fetch Purchases from this party
  const { data: purchases } = await getClient().from('purchases').select('*').eq('party_id', partyId);
  if (purchases) {
    purchases.forEach((purchase) => {
      allTransactions.push({
        id: purchase.id,
        date: purchase.created_at.slice(0, 10),
        type: 'purchase',
        description: `Purchase ${purchase.purchase_number}`,
        debit: 0,
        credit: Number(purchase.total_amount),
        referenceId: purchase.id,
      });
    });
  }

  // 5. Fetch Returns from this party
  const { data: returns } = await getClient().from('returns').select('*').eq('party_id', partyId);
  if (returns) {
    returns.forEach((ret) => {
      allTransactions.push({
        id: ret.id,
        date: ret.return_date || ret.created_at.slice(0, 10),
        type: 'return',
        description: `Return ${ret.return_number}`,
        debit: 0,
        credit: Number(ret.total_refund),
        referenceId: ret.id,
      });
    });
  }

  // 6. Fetch Cheques from this party
  const { data: cheques } = await getClient().from('cheques').select('*').eq('given_by', (sales && sales[0]?.customer_name) || '');
  if (cheques) {
    cheques.forEach((cheque: any) => {
      allTransactions.push({
        id: cheque.id,
        date: cheque.cheque_bought_date,
        type: 'cheque',
        description: `Cheque ${cheque.cheque_number} (${cheque.status})`,
        debit: cheque.status === 'cleared' ? Number(cheque.amount) : 0,
        credit: 0,
        referenceId: cheque.id,
      });
    });
  }

  // Filter by date range
  let filteredTransactions = [...allTransactions];
  if (dateFrom) {
    filteredTransactions = filteredTransactions.filter((t) => t.date >= dateFrom);
  }
  if (dateTo) {
    filteredTransactions = filteredTransactions.filter((t) => t.date <= dateTo);
  }

  // Filter by transaction type
  if (transactionType) {
    filteredTransactions = filteredTransactions.filter((t) => t.type === transactionType);
  }

  // Sort by date
  filteredTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate summary
  const totalCreditSales = filteredTransactions.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.debit, 0);
  const totalPaymentsReceived = filteredTransactions.filter((t) => t.type === 'payment').reduce((sum, t) => sum + t.credit, 0);
  const totalPurchases = filteredTransactions.filter((t) => t.type === 'purchase').reduce((sum, t) => sum + t.credit, 0);
  const totalOffsets = filteredTransactions.filter((t) => t.type === 'offset').reduce((sum, t) => sum + t.credit, 0);
  const netBalance = totalCreditSales - totalPaymentsReceived - totalOffsets;

  const summary: CustomerLedgerSummary = {
    totalCreditSales,
    totalPaymentsReceived,
    totalPurchases,
    totalOffsets,
    netBalance,
  };

  return { transactions: filteredTransactions, summary };
}

export async function deleteCheque(id: string): Promise<void> {
  const existing = await getChequeById(id);
  if (!existing) throw new Error('Cheque not found.');

  // If cheque was cleared, reverse the cash impact
  if (existing.status === 'cleared') {
    const ledger = await getLedger();
    if (ledger) {
      await updateLedger({
        cash_in_hand: ledger.cash_in_hand - Number(existing.amount),
      });
      await getClient().from('cash_transactions').delete().eq('reference_id', id).eq('reference_type', 'cheque');
    }
  }

  const { error } = await getClient().from('cheques').delete().eq('id', id);
  if (error) throw error;
}
