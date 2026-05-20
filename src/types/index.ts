export interface BusinessLedger {
  id: string
  inventory_value: number
  cash_in_hand: number
  receivables_total: number
  payables_total: number
  on_cheque: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PaymentType = 'cash' | 'credit' | 'chequesale'

export interface Sale {
  id: string
  invoice_number: string
  customer_name: string
  party_id?: string | null
  invoice_date?: string | null
  total_cost: number
  total_sales: number
  total_profit: number
  payment_type: PaymentType
  invoice_status: string
  /** Credit sales: false until month close; cash/cheque true. Omitted until DB migration. */
  is_finalized?: boolean
  /** Cheque sales: false until confirmed, then transfers to cash_in_hand */
  cheque_confirmed?: boolean
  notes: string | null
  created_at: string
  updated_at: string
  sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  item_name: string
  quantity: number
  cost_price: number
  selling_price: number
  profit: number
  created_at: string
}

export interface Purchase {
  id: string
  purchase_number: string
  supplier_name: string
  party_id?: string | null
  total_amount: number
  payment_type: PaymentType
  /** Credit purchases: false until month close. Omitted until DB migration. */
  is_finalized?: boolean
  notes: string | null
  created_at: string
}

export interface ReceivablePayment {
  id: string
  sale_id: string
  customer_name: string
  payment_date?: string | null
  method?: 'cash' | 'cheque' | 'bank' | 'other' | null
  cheque_date?: string | null
  cheque_number?: string | null
  cheque_status?: 'pending' | 'cleared' | 'bounced' | null
  amount: number
  notes: string | null
  created_at: string
}

export interface PayablePayment {
  id: string
  purchase_id: string
  supplier_name: string
  payment_date?: string | null
  method?: 'cash' | 'cheque' | 'bank' | 'other' | null
  cheque_date?: string | null
  cheque_number?: string | null
  cheque_status?: 'pending' | 'cleared' | 'bounced' | null
  amount: number
  notes: string | null
  created_at: string
}

export type RefundMethod = 'cash' | 'cheque' | 'bank' | 'other'

export interface ReturnItem {
  id: string
  return_id: string
  item_name: string
  quantity: number
  cost_price: number
  refund_price: number
  created_at: string
}

export interface Return {
  id: string
  return_number: string
  sale_id: string | null
  customer_name: string
  party_id: string | null
  return_date: string
  total_cost: number
  total_refund: number
  refund_method: RefundMethod
  notes: string | null
  created_at: string
  return_items?: ReturnItem[]
}

export interface ReturnItemInput {
  item_name: string
  quantity: number
  cost_price: number
  refund_price: number
}

export interface CreateReturnInput {
  sale_id?: string | null
  customer_name: string
  party_id?: string | null
  return_date: string
  total_cost: number
  total_refund: number
  refund_method: RefundMethod
  notes?: string
  items: ReturnItemInput[]
}

export type CashTransactionType = 'sale_cash' | 'sale_credit' | 'sale_cheque' | 'sale_cheque_confirmed' | 'purchase_cash' | 'purchase_credit' | 'receivable_collection' | 'payable_payment' | 'expense' | 'return' | 'receivable_cheque_cleared' | 'payable_cheque_cleared'
export type CashReferenceType = 'sale' | 'purchase' | 'receivable_payment' | 'payable_payment' | 'expense' | 'return'
export type CashDirection = 'in' | 'out'

export interface CashTransaction {
  id: string
  type: CashTransactionType
  reference_type: CashReferenceType
  reference_id: string
  amount: number
  direction: CashDirection
  notes: string | null
  created_at: string
}

export interface SaleItemInput {
  item_name: string
  quantity: number
  cost_price: number
  selling_price: number
  profit: number
}

export interface CreateSaleInput {
  customer_name: string
  party_id?: string | null
  invoice_date: string
  total_cost: number
  total_sales: number
  total_profit: number
  payment_type: PaymentType
  notes?: string
  items: SaleItemInput[]
}

export interface CreatePurchaseInput {
  supplier_name: string
  party_id?: string | null
  total_amount: number
  payment_type: PaymentType
  notes?: string
}

export interface CreateReceivablePaymentInput {
  sale_id: string
  customer_name: string
  payment_date?: string
  method?: 'cash' | 'cheque' | 'bank' | 'other'
  cheque_date?: string
  cheque_number?: string
  amount: number
  notes?: string
}

export interface ReceivableWithSale extends Sale {
  total_paid: number
  outstanding: number
  offset_total: number
  overpaid: number
  payments: ReceivablePayment[]
}

export interface PayableWithPurchase extends Purchase {
  total_paid: number
  outstanding: number
  offset_total: number
  payments: PayablePayment[]
}

export interface CreatePayablePaymentInput {
  purchase_id: string
  supplier_name: string
  payment_date?: string
  method?: 'cash' | 'cheque' | 'bank' | 'other'
  cheque_date?: string
  cheque_number?: string
  amount: number
  notes?: string
}

export interface Party {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface PartyOffset {
  id: string
  party_id: string
  purchase_id: string
  amount: number
  created_at: string
}

export interface CreatePartyInput {
  name: string
  phone?: string
  address?: string
  notes?: string
}

export type ExpenseCategory = 'salary' | 'rent' | 'electricity' | 'transport' | 'repairs' | 'misc'

export interface Expense {
  id: string
  title: string
  category: ExpenseCategory
  amount: number
  is_finalized?: boolean
  notes: string | null
  created_at: string
}

export interface CreateExpenseInput {
  title: string
  category: ExpenseCategory
  amount: number
  notes?: string
}

export interface DashboardStats {
  inventoryValue: number
  cashInHand: number
  receivablesTotal: number
  payablesTotal: number
  onCheque: number
  todaySales: number
  todayPurchases: number
  todaySalesCount: number
  todayPurchasesCount: number
  /** Profit from finalized sales only (official P&L). */
  totalProfit: number
  totalLoss: number
  netProfit: number
  todayProfit: number
  monthProfit: number
  yearProfit: number
  totalExpenses: number
  /** Includes pending credit sales (live estimate). */
  estimatedTotalProfit: number
  estimatedTotalLoss: number
  estimatedNetProfit: number
  estimatedTodayProfit: number
  estimatedMonthProfit: number
  estimatedYearProfit: number
}

export interface MonthlyProfitTrend {
  month: string
  profit: number
  loss: number
  revenue: number
  cost: number
}

export interface ReportStats {
  totalSales: number
  totalPurchases: number
  totalReceivableCollections: number
  cashSales: number
  creditSales: number
  cashPurchases: number
  creditPurchases: number
  stockMovement: number
  cashMovement: number
  salesCount: number
  purchasesCount: number
}

export interface RecentTransaction {
  id: string
  type: 'sale' | 'purchase' | 'receivable_payment' | 'payable_payment' | 'expense' | 'return'
  reference: string
  description: string
  amount: number
  direction: 'in' | 'out'
  created_at: string
}

export interface MonthlySnapshot {
  id: string
  month_key: string
  total_profit: number
  total_loss: number
  total_expenses: number
  net_profit: number
  invoice_count: number
  total_sales_amount: number
  total_cost_amount: number
  total_purchases?: number
  total_receivables_at_close?: number
  snapshot_data: Record<string, unknown> | null
  closed_at: string
}

/** Owner-typed manual P&L notebook (no link to sales/expenses tables). */
export interface ManualProfitLoss {
  id: string
  entry_date: string
  description: string
  sales_amount: number
  cost_amount: number
  expense_amount: number
  profit_amount: number
  notes: string | null
  created_at: string
}

export interface ManualProfitLossInput {
  entry_date: string
  description: string
  sales_amount: number
  cost_amount: number
  expense_amount: number
  notes: string | null
}

/** One line stored inside an archived manual P&L report. */
export interface ManualPnlReportRow {
  entry_date: string
  description: string
  sales_amount: number
  cost_amount: number
  expense_amount: number
  profit_amount: number
  notes: string | null
}

/** Saved when the manual notebook is cleared (month-end archive). */
export interface ManualPnlReport {
  id: string
  title: string
  period_from: string | null
  period_to: string | null
  total_sales: number
  total_cost: number
  total_expenses: number
  net_profit: number
  row_count: number
  report_data: ManualPnlReportRow[]
  archived_at: string
}

export interface ManualPnlReportSummary {
  id: string
  title: string
  period_from: string | null
  period_to: string | null
  total_sales: number
  total_cost: number
  total_expenses: number
  net_profit: number
  row_count: number
  archived_at: string
}
