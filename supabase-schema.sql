-- Gelioya Motors - Supabase Database Schema
-- Value-based inventory and cash-flow business system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BUSINESS LEDGER (single active record)
-- ============================================
CREATE TABLE business_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  cash_in_hand NUMERIC(15,2) NOT NULL DEFAULT 0,
  receivables_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  payables_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  on_cheque NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PARTIES (customers & suppliers)
-- ============================================
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SALES / INVOICES
-- ============================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  total_sales NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  total_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit', 'chequesale')),
  invoice_status TEXT NOT NULL DEFAULT 'completed' CHECK (invoice_status IN ('completed', 'cancelled')),
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  cheque_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SALE ITEMS (per-invoice line items)
-- ============================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PURCHASES
-- ============================================
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit')),
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PAYABLE PAYMENTS (supplier payments)
-- ============================================
CREATE TABLE payable_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'cheque', 'bank', 'other')),
  cheque_date DATE,
  cheque_number TEXT,
  cheque_status TEXT DEFAULT 'pending' CHECK (cheque_status IN ('pending', 'cleared', 'bounced')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PARTY OFFSETS (purchase offsets against receivables)
-- ============================================
CREATE TABLE party_offsets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RECEIVABLE PAYMENTS
-- ============================================
CREATE TABLE receivable_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'cheque', 'bank', 'other')),
  cheque_date DATE,
  cheque_number TEXT,
  cheque_status TEXT DEFAULT 'pending' CHECK (cheque_status IN ('pending', 'cleared', 'bounced')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  is_finalized BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CASH TRANSACTIONS (audit trail)
-- ============================================
CREATE TABLE cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('sale_cash', 'sale_credit', 'sale_cheque', 'sale_cheque_confirmed', 'purchase_cash', 'purchase_credit', 'receivable_collection', 'payable_payment', 'expense', 'return', 'receivable_cheque_cleared', 'payable_cheque_cleared')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sale', 'purchase', 'receivable_payment', 'payable_payment', 'expense', 'return')),
  reference_id UUID NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RETURNS (item returns / refunds)
-- ============================================
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number TEXT NOT NULL UNIQUE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  total_refund NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_refund >= 0),
  refund_method TEXT NOT NULL DEFAULT 'cash' CHECK (refund_method IN ('cash', 'cheque', 'bank', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RETURN ITEMS (per-return line items)
-- ============================================
CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  refund_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('salary', 'rent', 'electricity', 'transport', 'repairs', 'misc')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MANUAL PROFIT & LOSS (owner-typed notebook; no auto journal)
-- ============================================
CREATE TABLE manual_profit_loss (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  sales_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  expense_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Archived manual P&L (saved when notebook is cleared for a new period)
CREATE TABLE manual_pnl_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT '',
  period_from DATE,
  period_to DATE,
  total_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MONTHLY SNAPSHOTS (saved P&L summaries)
-- ============================================
CREATE TABLE monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month_key TEXT NOT NULL UNIQUE,
  total_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_loss NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  total_sales_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_purchases NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_receivables_at_close NUMERIC(15,2) NOT NULL DEFAULT 0,
  snapshot_data JSONB,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX idx_sales_invoice_date ON sales(invoice_date DESC);
CREATE INDEX idx_sales_customer_name ON sales(customer_name);
CREATE INDEX idx_sales_payment_type ON sales(payment_type);
CREATE INDEX idx_sales_total_profit ON sales(total_profit);
CREATE INDEX idx_sales_is_finalized ON sales(is_finalized);
CREATE INDEX idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX idx_purchases_supplier_name ON purchases(supplier_name);
CREATE INDEX idx_receivable_payments_sale_id ON receivable_payments(sale_id);
CREATE INDEX idx_receivable_payments_created_at ON receivable_payments(created_at DESC);
CREATE INDEX idx_payable_payments_purchase_id ON payable_payments(purchase_id);
CREATE INDEX idx_payable_payments_created_at ON payable_payments(created_at DESC);
CREATE INDEX idx_cash_transactions_created_at ON cash_transactions(created_at DESC);
CREATE INDEX idx_cash_transactions_type ON cash_transactions(type);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX idx_manual_profit_loss_entry_date ON manual_profit_loss(entry_date DESC);
CREATE INDEX idx_manual_profit_loss_created_at ON manual_profit_loss(created_at DESC);
CREATE INDEX idx_manual_pnl_reports_archived_at ON manual_pnl_reports(archived_at DESC);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_parties_name ON parties(name);
CREATE INDEX idx_party_offsets_party_id ON party_offsets(party_id);
CREATE INDEX idx_party_offsets_purchase_id ON party_offsets(purchase_id);
CREATE INDEX idx_sales_party_id ON sales(party_id);
CREATE INDEX idx_purchases_party_id ON purchases(party_id);
CREATE INDEX idx_returns_created_at ON returns(created_at DESC);
CREATE INDEX idx_returns_customer_name ON returns(customer_name);
CREATE INDEX idx_returns_sale_id ON returns(sale_id);
CREATE INDEX idx_return_items_return_id ON return_items(return_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE business_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_profit_loss ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_pnl_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_offsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- Allow anon key access (app uses anon key, no auth login)
CREATE POLICY "Anon full access on business_ledger" ON business_ledger
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on sales" ON sales
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on purchases" ON purchases
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on receivable_payments" ON receivable_payments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on payable_payments" ON payable_payments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on cash_transactions" ON cash_transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on expenses" ON expenses
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on manual_profit_loss" ON manual_profit_loss
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on manual_pnl_reports" ON manual_pnl_reports
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on monthly_snapshots" ON monthly_snapshots
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on sale_items" ON sale_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on parties" ON parties
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on party_offsets" ON party_offsets
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on returns" ON returns
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access on return_items" ON return_items
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_ledger_updated_at
  BEFORE UPDATE ON business_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- MIGRATIONS (existing databases — safe to re-run ALTERs only)
-- ============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE monthly_snapshots ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE monthly_snapshots ADD COLUMN IF NOT EXISTS total_receivables_at_close NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Manual P&L notebook (run on existing DBs)
CREATE TABLE IF NOT EXISTS manual_profit_loss (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  sales_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  expense_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE manual_profit_loss ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anon full access on manual_profit_loss" ON manual_profit_loss FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_manual_profit_loss_entry_date ON manual_profit_loss(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_manual_profit_loss_created_at ON manual_profit_loss(created_at DESC);

-- Manual P&L archives (saved when clearing the notebook)
CREATE TABLE IF NOT EXISTS manual_pnl_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT '',
  period_from DATE,
  period_to DATE,
  total_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE manual_pnl_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anon full access on manual_pnl_reports" ON manual_pnl_reports FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_manual_pnl_reports_archived_at ON manual_pnl_reports(archived_at DESC);

-- One-time backfill after the ALTERs above (run once in SQL editor, then stop):
--   UPDATE sales SET is_finalized = true;
--   UPDATE purchases SET is_finalized = true;
-- New credit sales/credit purchases stay is_finalized = false until Close Month.
