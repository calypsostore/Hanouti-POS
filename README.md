# 7anouti-POS

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

## Optional shop hub

The local Node 22+ hub serves the built app, station boards, scoped APIs and
printer queue over shop Wi-Fi. Build first, then run `npm run hub`; open
`/status` on the hub machine for its LAN address and QR code. Setup, HTTPS,
backups and service installation are documented in [docs/HUB.md](./docs/HUB.md).
The browser app still uses local IndexedDB and does not yet sync POS activity
through the hub; see [docs/SYNC.md](./docs/SYNC.md) and the M4 roadmap.

## Demo accounts

| Role | Login | Credential |
| --- | --- | --- |
| Super admin (platform owner) | `owner@cafepos.tn` | Password `password` |
| Store admin — Café Yasmine | `sami@cafeyasmine.tn` | Password `password` |
| Staff — Café Yasmine | `amine.yasmine` | PIN `1234` |
| Staff — Café Yasmine | `salma.yasmine` | PIN `2345` |
| Staff — Le Petit Coin | `karim.petitcoin` | PIN `4321` |
| Staff — Dar Chai | `hedi.darchai` | PIN `5678` |

Staff sign in with their username and PIN; no store code, email, or password is
required.

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
- Table service supports section-based tables, tables-only and manual table
  names, with required/optional/off guest counts, section/table setup, floor
  ownership filters and table/guest/staff details on kitchen tickets. These
  records remain browser-local demo data.
- Orders history with filters, detail drawer, receipt reprint (`*** REPRINT ***`
  marker), CSV export and voids — staff voids require a manager PIN and record
  who authorized them
- Admin-only activity log with user/entity/date/search filters, before/after
  details, CSV export and 50-entry pagination
- Regulars & tabs: monthly customer cards with credit limits, settlement cycle,
  running balances, full ledger and partial or full payments. Staff can start
  orders and take payments; only admins can edit profiles or remove customers.
- Products and categories: emoji icons, pricing, cost/margin, stock tracking,
  active toggles
- Inventory: base units and package conversions, opening stock, counts,
  adjustments, waste, recent movement history, searchable list and permission-
  aware CSV export
- Supplier purchases: receive stock, attach invoices/receipt images, update
  average costs, record partial payments and export filtered purchase history
- Team: staff username + PIN logins, salary type/amount, roles, granular
  permissions (discounts, tabs, settlements, register, reports, shift supervisor),
  activation; administrators keep email/password sign-in
- Reports: today / week / month / year, sales chart, payment split, top
  products, categories, staff performance, tab charges vs settlements, expenses
- Expenses: add/edit/delete, monthly totals, category breakdown, CSV export
- Payroll: daily or monthly staff salary, automatic login/logout attendance,
  manual attendance corrections, open salary advances and net salary payments.
  Advances and salary payouts create separate expenses; staff can view only
  their own attendance and advances. Records are browser-local demo data.
- **Cash register (X/Z)**: X report any time without closing; Z closing with
  counted cash and cash-difference; sessions are unique and become immutable
  once closed; full Z history can be viewed and re-printed exactly as closed.
  Reports include every sold item grouped by category, variant and priced
  modifier, with category subtotals and a served-items total. Quick-mode
  recorded orders appear separately as unpaid; voided items name the
  authorizer. The live X view supports item search, sorting and CSV export.
  Plain staff see only their own item rows in X reports; supervisors and admins
  see the full session. Legacy Z item details are rebuilt from session orders
  on view and marked accordingly.
  Staff see only their own shifts unless they have the shift-supervisor
  permission (admins see everything)
- Settings: store profile, tax and service charge, tab rules, low-stock alerts,
  table mode/sections/guest-count rules,
  receipt footer, accent colour, **thermal printer setup** (58/80 mm, auto or
  manual, USB/WebSerial or browser, baud rate, kitchen tickets, test print),
  demo reset

### Staff
- Scoped to their own store only
- Staff sign in with their unique username and PIN (no email or password)
- POS, order history and regular customer cards
- Add a new order to a regular's card or take a tab payment
- Customer profiles are read-only for staff; admin-only editing is enforced
- Voiding an order requires a manager's PIN (recorded in the audit trail)
- With the `register` permission: open the register, print X reports and close
  the day with a Z report — **only the sessions they personally opened**.
  Teammates' sessions, sales and Z history are invisible to plain staff, and a
  store-layer guard rejects closing a session someone else opened
- **Shift supervisor** (`supervisor` permission, granted by an admin): for the
  trusted "responsible" person of a shift — sees every register session of the
  store including sessions opened by admins, the whole team's sales breakdown,
  and can close sessions opened by others. Without it a staff member only ever
  sees their own row in the by-employee breakdown
- Permissions control discounts, tabs, settlements, register, reports and
  shift supervisor

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
    registerItems.ts       session-window sold, recorded and voided item aggregation
    defaults.ts            printer defaults + permission normalizers
    ...                    money/date helpers, pricing, selectors, theme
  components/
    ui, shell, charts, receipt, toasts, RegisterItemsTable
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
