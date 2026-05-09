# Gelioya Motors

A lightweight business management app for a small motor-parts business.

## Features

- Sales (cash + credit)
- Purchases
- Receivables (collect payments, pay-all per customer, overpaid tracking)
- Payables
- Returns (inventory increases, refund decreases cash/on-cheque)
- Expenses
- Cash ledger
- Profit & Loss reports (PDF export)
- Parties (customers/suppliers)

## Tech Stack

- React + TypeScript
- Vite
- TailwindCSS
- Supabase (Postgres + Auth)

## Prerequisites

- Node.js 18+ recommended
- A Supabase project

## Environment Variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Setup (Supabase)

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Run the schema in `supabase-schema.sql`

This creates the tables and policies required by the app.

## Install & Run

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Deployment (Vercel)

- Build command: `npm run build`
- Output directory: `dist`

For React Router refresh support, the repo includes a `vercel.json` rewrite rule.

## Notes

- **Receivables overpayment:** If a customer pays more than outstanding, the excess is shown as **Overpaid**.
- **Returns logic:** When items are returned, **Inventory Value increases** and refund reduces **Cash in Hand** (or **On Cheque** for cheque refunds).

## Common Troubleshooting

- **Hard refresh shows 404 on Vercel:** Ensure `vercel.json` exists at the repo root and that Vercel redeploys after pushing.
- **Supabase not configured:** Make sure `.env` contains valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
