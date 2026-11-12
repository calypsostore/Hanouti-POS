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
- Orders history with filters, detail drawer, receipt reprint (`*** REPRINT ***`
  marker), CSV export and voids — staff voids require a manager PIN and record
  who authorized them
- Regulars & tabs: monthly customer cards with credit limits, settlement cycle,
  running balances, full ledger and partial or full payments. Staff can start
  orders and take payments; only admins can edit profiles or remove customers.
- Products and categories: emoji icons, pricing, cost/margin, stock tracking,
  active toggles
- Team: email/password + 4-digit PIN, roles, granular permissions (discounts,
  tabs, settlements, register, reports), activation
- Reports: today / week / month / year, sales chart, payment split, top
  products, categories, staff performance, tab charges vs settlements, expenses
- Expenses: add/delete, monthly totals, category breakdown, CSV export
- **Cash register (X/Z)**: X report any time without closing; Z closing with
  counted cash and cash-difference; sessions are unique and become immutable
  once closed; full Z history can be viewed and re-printed exactly as closed
- Settings: store profile, tax and service charge, tab rules, low-stock alerts,
  receipt footer, accent colour, **thermal printer setup** (58/80 mm, auto or
  manual, USB/WebSerial or browser, baud rate, kitchen tickets, test print),
  demo reset

### Staff
- Scoped to their own store only
- Quick PIN login with store code
- POS, order history and regular customer cards
- Add a new order to a regular's card or take a tab payment
- Customer profiles are read-only for staff; admin-only editing is enforced
- Voiding an order requires a manager's PIN (recorded in the audit trail)
- With the `register` permission: open the register, print X reports and close
  the day with a Z report
- Permissions control discounts, tabs, settlements, register and reports

## How data isolation works in the prototype

Every record carries a `storeId`; every page filters by the signed-in user's
store. The super admin sees across stores because their session has no
`storeId`. In the production API this must be enforced server-side — the
frontend filtering here is a UX layer only.

## Architecture

```
src/
  types.ts                 domain types (orders, customers, register sessions, printer)
  data/seed.ts             deterministic demo data (4 stores, ~90 days of orders,
                           seeded register sessions with closed Z history)
  store/AppStore.tsx       auth session + all mutations, persisted to localStorage
  lib/
    escpos.ts              receipt / kitchen / X-Z report line models + raw ESC/POS encoder
    printer.ts             WebSerial bridge (connect, silent reconnect, chunked writes)
    reports.ts             register totals engine (X live, Z frozen snapshot)
    defaults.ts            printer defaults + permission normalizers
    ...                    money/date helpers, pricing, selectors, theme
  components/
    ui, shell, charts, receipt, toasts
    PrintPreview.tsx       shared print dialog (preview + ESC/POS send + browser fallback)
  pages/
    Login.tsx
    POS.tsx
    admin/                 overview, orders, regulars, register, products, staff,
                           reports, expenses, settings
    super/                 overview, stores, store profile drawer
```

All mutations go through `AppStore`, which is the seam to replace with real API
calls. Demo data is rebuilt automatically if the browser cache is cleared, and
can be reset from **Settings → Demo tools**.

## Printing (thermal receipts)

- **USB ESC/POS** — real byte-level printing over WebSerial in Chrome / Edge on
  desktop. Connect once from Settings (or the print dialog); the app
  reconnects automatically afterwards. Supports 58 mm (32 cols) and 80 mm
  (48 cols), auto or manual printing, separate kitchen tickets and a test page.
- **Browser fallback** — the same layout prints through the browser dialog on
  browsers without WebSerial (Firefox, Safari).
- Arabic characters are not printable on standard ESC/POS firmware; they are
  replaced on receipts. French and TND amounts are fully supported.
- No thermal printer is claimed to "work" without one being tested — see
  `docs/PRODUCTION_PLAN.md` for the honest support matrix and hardware
  checklist.

## Notes for the next phase

- Replace browser persistence with a real database + API (auth, hashed PINs,
  server-side tenant isolation) — see `docs/PRODUCTION_PLAN.md` for the phased
  plan and what remains blocked on infrastructure.
- Currency is TND with 3-decimal millimes, grouped for readability (e.g.
  `1 250,500 DT`).
