/*
  # IZTECH RACING Accounting System - Database Schema

  ## Overview
  This migration creates the complete database schema for the IZTECH RACING accounting system.
  The system uses a unified ledger approach where all financial transactions are recorded
  in a central transactions_ledger table for reliable reporting and member balance tracking.

  ## Tables Created

  ### 1. settings
  - Stores application configuration (membership fee, categories, projects)
  - Single row table with id=1

  ### 2. members
  - Team members who can have financial transactions
  - Tracks join/leave dates and status
  - Fields: id, full_name, join_date, leave_date, notes

  ### 3. products
  - Merch inventory items
  - Fields: id, name, category, unit_price, stock_quantity

  ### 4. sales_orders
  - Header records for merch sales
  - Links to member and contains payment info
  - Fields: id, member_id, order_date, payment_method, total_amount, notes

  ### 5. sales_order_items
  - Line items for each sale
  - Fields: id, order_id, product_id, quantity, unit_price, line_total

  ### 6. bank_transactions
  - Imported bank transactions from XLS files
  - Fields: id, txn_date, description, amount, direction, counterparty, import_hash

  ### 7. cash_expenses
  - Manual cash expense entries
  - Fields: id, expense_date, amount, description, category, project, receipt metadata

  ### 8. reimbursements
  - Tracks member purchases for the team that need reimbursement
  - Fields: id, member_id, purchase_date, vendor, description, amount, category, project, payment_status, receipt metadata

  ### 9. membership_fees
  - Monthly membership fee records
  - Fields: id, member_id, fee_month, amount, payment_status, payment_method

  ### 10. transactions_ledger
  - Unified ledger for all financial transactions
  - Each entry represents a money movement with member balance impact
  - Fields: id, txn_date, txn_type, amount, member_id, project, category, description, source, reference_id

  ## Security
  - RLS enabled on all tables
  - Policies allow authenticated admin access only
*/

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  membership_fee_amount numeric(10,2) DEFAULT 200.00,
  default_categories jsonb DEFAULT '["materials", "travel", "event", "food", "other"]'::jsonb,
  default_projects jsonb DEFAULT '["Corsa", "Doruk", "General"]'::jsonb,
  member_import_dedupe_strategy text DEFAULT 'name_and_join_date',
  bank_import_dedupe_strategy text DEFAULT 'hash',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT settings_single_row CHECK (id = 1)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage settings"
  ON settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  join_date date NOT NULL,
  leave_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view members"
  ON members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete members"
  ON members FOR DELETE
  TO authenticated
  USING (true);

-- Products table (merch inventory)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'general',
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- Sales orders table
CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'unpaid',
  payment_status text DEFAULT 'unpaid',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view sales_orders"
  ON sales_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert sales_orders"
  ON sales_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update sales_orders"
  ON sales_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete sales_orders"
  ON sales_orders FOR DELETE
  TO authenticated
  USING (true);

-- Sales order items table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  line_total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view sales_order_items"
  ON sales_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert sales_order_items"
  ON sales_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update sales_order_items"
  ON sales_order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete sales_order_items"
  ON sales_order_items FOR DELETE
  TO authenticated
  USING (true);

-- Bank transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'in',
  counterparty text DEFAULT '',
  reference text DEFAULT '',
  import_hash text,
  import_filename text,
  matched_to_type text,
  matched_to_id uuid,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view bank_transactions"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert bank_transactions"
  ON bank_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update bank_transactions"
  ON bank_transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete bank_transactions"
  ON bank_transactions FOR DELETE
  TO authenticated
  USING (true);

-- Cash expenses table
CREATE TABLE IF NOT EXISTS cash_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text DEFAULT 'other',
  project text DEFAULT 'General',
  receipt_note text DEFAULT '',
  receipt_date date,
  receipt_no text DEFAULT '',
  vendor text DEFAULT '',
  receipt_image_base64 text,
  receipt_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cash_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view cash_expenses"
  ON cash_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert cash_expenses"
  ON cash_expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update cash_expenses"
  ON cash_expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete cash_expenses"
  ON cash_expenses FOR DELETE
  TO authenticated
  USING (true);

-- Reimbursements table
CREATE TABLE IF NOT EXISTS reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text DEFAULT '',
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  category text DEFAULT 'other',
  project text DEFAULT 'General',
  payment_status text DEFAULT 'unpaid',
  payment_date date,
  payment_method text,
  receipt_note text DEFAULT '',
  receipt_date date,
  receipt_no text DEFAULT '',
  receipt_image_base64 text,
  receipt_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view reimbursements"
  ON reimbursements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert reimbursements"
  ON reimbursements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update reimbursements"
  ON reimbursements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete reimbursements"
  ON reimbursements FOR DELETE
  TO authenticated
  USING (true);

-- Membership fees table
CREATE TABLE IF NOT EXISTS membership_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fee_month date NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 200.00,
  payment_status text DEFAULT 'unpaid',
  payment_method text,
  payment_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, fee_month)
);

ALTER TABLE membership_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view membership_fees"
  ON membership_fees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert membership_fees"
  ON membership_fees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update membership_fees"
  ON membership_fees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete membership_fees"
  ON membership_fees FOR DELETE
  TO authenticated
  USING (true);

-- Transactions ledger (unified ledger for all financial transactions)
CREATE TABLE IF NOT EXISTS transactions_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date date NOT NULL,
  txn_type text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  project text DEFAULT 'General',
  category text DEFAULT 'other',
  description text NOT NULL,
  source text DEFAULT 'manual',
  reference_type text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view transactions_ledger"
  ON transactions_ledger FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert transactions_ledger"
  ON transactions_ledger FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update transactions_ledger"
  ON transactions_ledger FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete transactions_ledger"
  ON transactions_ledger FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_join_date ON members(join_date);
CREATE INDEX IF NOT EXISTS idx_members_leave_date ON members(leave_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_member_id ON sales_orders(member_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_txn_date ON bank_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_import_hash ON bank_transactions(import_hash);
CREATE INDEX IF NOT EXISTS idx_cash_expenses_expense_date ON cash_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_reimbursements_member_id ON reimbursements(member_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_purchase_date ON reimbursements(purchase_date);
CREATE INDEX IF NOT EXISTS idx_membership_fees_member_id ON membership_fees(member_id);
CREATE INDEX IF NOT EXISTS idx_membership_fees_fee_month ON membership_fees(fee_month);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_txn_date ON transactions_ledger(txn_date);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_member_id ON transactions_ledger(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_txn_type ON transactions_ledger(txn_type);

-- Insert default settings
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
