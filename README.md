# 🌿 Color of Nature

A modern e-commerce website built with **React + Vite** (frontend) and **Supabase** (backend).

## Architecture

```
Color of Nature/
├── frontend/          ← React (Vite) UI
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/supabase.ts   ← Supabase client
│
└── supabase/          ← ALL backend: Database + Edge Functions
    ├── migrations/    ← Postgres schema (Users, Products, Orders)
    └── functions/
        └── sync-to-odoo/   ← Connects to Odoo ERP (XML-RPC)
```

## Data Flow

- **Users & Orders** → stored in **Supabase Postgres**  
- **Products** → cached from **Odoo** into Supabase (fast reads)  
- **Order Sync** → Edge Function triggers on new order → pushes to Odoo

## Setup

### 1. Frontend
```bash
cd frontend
npm install
cp ../.env.example .env.local   # fill in VITE_SUPABASE_* keys
npm run dev
```

### 2. Backend (Supabase Edge Functions)
```bash
# Set Odoo secrets (these NEVER go in the .env file)
npx supabase secrets set ODOO_URL=https://your-company.odoo.com
npx supabase secrets set ODOO_DB=your-db-name
npx supabase secrets set ODOO_USERNAME=admin
npx supabase secrets set ODOO_API_KEY=your-api-key

# Deploy the edge function
npx supabase functions deploy sync-to-odoo
```

### 3. Database
```bash
npx supabase db push
```
