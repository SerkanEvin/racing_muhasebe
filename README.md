# IZTECH RACING - Accounting System

A comprehensive web-based accounting system built for IZTECH Racing team to manage finances, membership fees, merchandise sales, reimbursements, and expense tracking.

## Features

### Core Modules

1. **Dashboard**
   - Overview of current month income and expenses
   - Bank transaction import count
   - Pending reimbursements tracker
   - Member balance summaries
   - Recent activity feed (latest 20 transactions)

2. **Members Management**
   - Add, edit, and manage team members
   - Track join and leave dates
   - Import members from JSON files with automatic deduplication
   - Filter by active/inactive status
   - Search functionality

3. **Membership Fees**
   - Generate monthly fees for all active members
   - Configurable fee amount (default: 200 TL)
   - Track payment status (paid/unpaid)
   - Record payment method and date
   - Automatic fee calculation based on join/leave dates

4. **Merch Sales**
   - Product inventory management
   - Track stock quantities and unit prices
   - Create sales orders with multiple line items
   - Automatic stock deduction
   - Payment tracking (paid/unpaid)
   - Link sales to members

5. **Reimbursements**
   - Record member purchases for the team
   - Track reimbursement status (paid/unpaid)
   - Categorize by expense type and project
   - Store receipt metadata (no file uploads)
   - Generate transactions when marked as paid

6. **Bank Import**
   - Upload XLS/XLSX files
   - Manual column mapping interface
   - Preview data before import
   - Automatic duplicate detection using hash
   - Support for custom bank statement formats

7. **Cash Expenses**
   - Record manual cash transactions
   - Categorize expenses (materials, travel, event, food, other)
   - Allocate to projects (Corsa, Doruk, General)
   - Store receipt metadata
   - Search and filter functionality

8. **Reports**
   - **P&L Report**: Income vs expense by category and project
   - **Member Balances**: Complete financial summary per member
   - **Cashflow**: Monthly inflow and outflow timeline
   - **Inventory**: Product stock and sales revenue
   - Export all reports to CSV

9. **Settings**
   - Configure membership fee amount
   - Manage default categories and projects
   - Add demo data for testing
   - View sample JSON formats

## Technology Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **XLS Parsing**: XLSX library
- **Icons**: Lucide React
- **Build Tool**: Vite

## Database Schema

### Tables

- **settings**: App configuration (membership fees, categories, projects)
- **members**: Team member records
- **products**: Merchandise inventory
- **sales_orders**: Sales order headers
- **sales_order_items**: Sales order line items
- **bank_transactions**: Imported bank data
- **cash_expenses**: Manual cash expense records
- **reimbursements**: Member reimbursement tracking
- **membership_fees**: Monthly membership fee records
- **transactions_ledger**: Unified financial transaction ledger

All tables use Row Level Security (RLS) with admin-only access policies.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account and project

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   The `.env` file contains your Supabase credentials and admin login:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_ADMIN_USERNAME=admin
   VITE_ADMIN_PASSWORD=iztech2024
   ```

3. **Database Setup**
   The database schema has been automatically created via Supabase migration.
   All tables, indexes, and RLS policies are configured.

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   ```

### Default Login Credentials

- **Username**: `admin`
- **Password**: `iztech2024`

You can change these in the `.env` file.

## User Guide

### Help Tooltips

Every form label, table header, and major UI section includes a "?" help icon. Hover over it to see a concise explanation of what that field or section does.

### Member JSON Import Format



```json
 [{
        "İsim Soyisim": "Serkan Doğan Evin",
        "Ekip": "Elektronik & Yazılım"
    }]
```

### Bank Import Process

1. Upload your XLS/XLSX bank statement
2. Map columns to required fields (at minimum: Date, Description, Amount)
3. Preview first 20 rows to verify mapping
4. Import transactions (duplicates are automatically skipped)

### Receipt Metadata

Instead of uploading files, store receipt information as database fields:
- Receipt number
- Receipt date
- Vendor
- Notes
- Optional base64 text representation

This keeps the database lightweight and avoids storage costs.

## Key Design Decisions

1. **No File Storage**: Receipt data stored as metadata to reduce storage costs and complexity
2. **Unified Ledger**: All financial transactions flow through a central ledger for reliable reporting
3. **Static Admin Auth**: Simple single-admin authentication without user management overhead
4. **Manual Column Mapping**: Flexible bank import supports any XLS format
5. **Self-Explanatory UI**: Every element has contextual help tooltips

## Data Rules

- Membership fees apply from join month through leave month
- Reimbursements create negative transactions (team owes member)
- Sales and fees create positive transactions (member owes team)
- Bank imports use hash-based deduplication
- Member imports deduplicate by name
- Active members have no leave date

## Reporting

All reports can be filtered by:
- Date range
- Project/cost center
- Category
- Member

Export any report to CSV for external analysis.

## Support

For issues or questions:
1. Check the help tooltips (?) throughout the UI
2. Review the Settings page for sample data formats
3. Use the "Add Demo Data" button to populate test data

## License

Private use for IZTECH Racing team.
