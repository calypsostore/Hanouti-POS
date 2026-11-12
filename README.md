# Kawa POS

A multi-tenant point-of-sale platform for Tunisian cafés, snacks and salons de thé.
Built as a fully interactive frontend prototype with a browser-persisted demo backend, so
every flow can be reviewed before a real API is attached.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm run build     # production build
npm run preview   # preview the build
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Super admin (platform owner) | `owner@cafepos.tn` | `password` |
| Store admin — Café Yasmine | `sami@cafeyasmine.tn` | `password` |
| Staff — Café Yasmine | `amine@cafeyasmine.tn` | `password` |

Staff can also sign in with **Staff PIN** using the store code:

- Café Yasmine → `yasmine` · PIN `1234` (Amine) / `2345` (Salma)
- Le Petit Coin → `petitcoin` · PIN `4321` (Karim)
- Dar Chai → `darchai` · PIN `5678` (Hedi)
- Café Nour (suspended demo) → `cafe-nour` · PIN `4444`

The login screen has one-click demo buttons for the first three.

## What is included

### Super admin
- Platform KPIs: stores, MRR, 30-day GMV, platform-wide open tabs
- 30-day revenue chart and plan/status breakdown
- Store performance ranking and a live activity feed
- Store directory with search / status / plan filters
- Full store profile drawer: owner contact, usage, financials, register
  configuration, team, customers with balances, recent orders
- Suspend / reactivate stores, change plans, convert trials

### Store admin
- Dashboard with today's revenue, orders, average ticket, outstanding tabs,
  payment mix, top sellers, low stock, team snapshot, monthly P&L
- **Configurable register mode**: `Quick order` (no payment handling) or
  `Cashier` (cash/card/tab + change + receipt)
- POS with categories, search, stock awareness, notes, discounts, customer
  attachment and receipt printing
- Orders history with filters, detail drawer, receipt print, CSV export and voids
- Regulars & tabs: monthly customer cards with credit limits, settlement cycle,
  running balances, full ledger and partial or full payments. Staff can start
  orders and take payments; only admins can edit profiles or remove customers.
- Products and categories: emoji icons, pricing, cost/margin, stock tracking,
  active toggles
- Team: email/password + 4-digit PIN, roles, granular permissions, activation
- Reports: today / week / month / year, sales chart, payment split, top
  products, categories, staff performance, tab charges vs settlements, expenses
- Expenses: add/delete, monthly totals, category breakdown, CSV export
- Settings: store profile, tax and service charge, tab rules, low-stock alerts,
  receipt footer, accent colour, demo reset

### Staff
- Scoped to their own store only
- Quick PIN login with store code
- POS, order history and regular customer cards
- Add a new order to a regular's card or take a tab payment
- Customer profiles are read-only for staff; admin-only editing is enforced
- Permissions control discounts, tabs, settlements and reports

## How data isolation works in the prototype

Every record carries a `storeId`; every page filters by the signed-in user's
store. The super admin sees across stores because their session has no
`storeId`. In the production API this must be enforced server-side — the
frontend filtering here is a UX layer only.

## Architecture

```
src/
  types.ts                 domain types
  data/seed.ts             deterministic demo data (4 stores, ~90 days of orders)
  store/AppStore.tsx       auth session + all mutations, persisted to localStorage
  lib/                     money/date helpers, pricing, selectors, theme
  components/              UI kit, shell, charts, receipt, toasts
  pages/
    Login.tsx
    POS.tsx
    admin/                 overview, orders, regulars, products, staff,
                           reports, expenses, settings
    super/                 overview, stores, store profile drawer
```

All mutations go through `AppStore`, which is the seam to replace with real API
calls. Demo data is rebuilt automatically if the browser cache is cleared, and
can be reset from **Settings → Demo tools**.

## Notes for the next phase

- Replace browser persistence with a real database + API (auth, hashed PINs,
  server-side tenant isolation).
- Receipts currently print through the browser print dialog; a local print
  agent can be added for silent thermal printing later.
- Currency is TND with 3-decimal millimes, grouped for readability (e.g.
  `1 250,500 DT`).
