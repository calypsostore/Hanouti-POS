# 7anouti-POS — Production Plan

Status document for turning the 7anouti-POS frontend into a production-ready POS
platform for Tunisian cafés, restaurants, snacks and salons de thé. It records
the audit of the current build, what is implemented per phase, what is honestly
**not** implemented yet, and the hardware/browser support matrix.

Last updated: 2026-11-12 · shipped: **POS hardening, architecture refactor,
requested feature Phase 1, and the visual/icon upgrade**. The requested feature
Phases 2–9 remain unstarted.

## Code organization update (2026-11-12)

The POS, Customers, Orders, Products, Settings, Reports, and Register screens
now use focused feature modules, and `AppStore.tsx` composes auth, orders,
register, catalog, customers, staff, and settings slices without changing the
public `useApp()` API. This was an organizational refactor; it does not change
the app's persistence or trust boundary. Data, authentication, and authorization
remain browser-local demo behavior and still require the Phase 2 backend for
production.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the folder map and extension
guidance. The line-count audit also found other existing large files outside
this refactor's page/store scope; those remain follow-up structure work.

The app is now branded 7anouti-POS. Existing `cafepos.db.*` and
`cafepos.session.*` local data is copied to the `7anouti.*` keys before the old
keys are removed.
The default platform palette now follows the logo: navy surfaces, cool light
backgrounds, amber highlights, and accessible navy-on-amber actions. The
sidebar, shared controls, POS, reports, and receipt branding use the shared
brand tokens. Light/dark appearance can be toggled and is saved as a local UI
preference; custom store accent palettes remain available and their foreground
colors are selected for readable text. This presentation preference and all
local data remain browser-local demo behavior, not a production security boundary.
The shared logo uses the supplied `logo/logo1.png` image, and the browser-tab
favicon is set to the same image. The PWA SVG icon uses matching navy-and-amber
colors.
Existing stores using the former default caramel palette are migrated to the
7anouti palette; custom accent selections remain unchanged.

The admin, staff, and platform-owner dashboards now share a responsive
dashboard component set and the app shell is split into a collapsible sidebar,
top bar, and mobile navigation. Dashboard totals reuse the existing report and
ledger data; month profit is explicitly an estimate based on current product
costs and recorded expenses. This is a presentation update only: the current
database still has no open-order/tracking status model, shift records, last-login
history, or billing workflow. Those dashboard
sections are omitted, marked unavailable, or limited to the data already
stored; no demo values are presented as production data.

### Visual and icon upgrade ✅ demo implementation

- Semantic color tokens now define payment, order, stock, money-flow, trend,
  and icon colors for both themes. Report payment colors are cash green, card
  blue, and credit amber; report/dashboard charts use those tokens and include
  legends.
- Store, category, and product records use Lucide icon keys and semantic icon
  colors. Existing emoji-backed records migrate to the nearest icon during the
  `7anouti.db.v9` local database normalization; the legacy emoji property is
  removed. Store logos and product images can be uploaded and resized to 256 px
  client-side (up to 300 KB).
- Shared screens use the liquid-glass surfaces, ambient background, and
  accessibility fallbacks. The sidebar is edge-docked and full-height, and the
  top bar is sticky at the viewport top; neither uses the floating glass-shell
  treatment. Branding uses the supplied logo image; receipt output remains
  text-only.
- Vercel rewrites client-side routes to the app entry point so direct visits
  and refreshes on paths such as `/login` load the SPA instead of a 404.
- First-load seed initialization reuses its fallback database rather than
  generating demo data twice; sign-in controls stay disabled until migration
  and credential hashing finish.
- Local Chrome smoke review covered the dashboard, report donut/bars, POS
  catalog, settings icon picker, and light/dark presentation. The mobile
  settings viewport had no horizontal overflow. The local v9 database contains
  icon keys on every store/category/product and no remaining legacy emoji
  fields.
- This remains a browser-local demo: image data and all business records live
  in localStorage. Browser/device QA for both themes, reduced transparency,
  end-to-end image uploads, login, order flows, and 200-product POS catalogs
  remains a manual release check.

## Requested feature roadmap

### Phase 1 — Business types and product options ✅ demo implementation

- Stores support cafe, restaurant, bakery, snack, retail and salon templates.
  A super administrator can create a store with its first administrator; that
  administrator chooses a business type at first sign-in. The template supplies
  starter categories, POS mode, feature defaults and receipt footer.
- Settings can toggle tables, kitchen screen, barcode scanning and weight-based
  items. The restaurant/table and kitchen workflows themselves are part of
  requested Phase 2.
- Products support modifier groups/options, variants with independent price,
  cost, barcode and stock, product barcodes, per-item notes, and sales by kg/g/
  piece to three decimal places. POS validates and snapshots chosen variants and
  modifiers from the local catalog; receipts, kitchen tickets and sales totals
  use the saved line details.
- `7anouti.db.v9` migrates the legacy `7anouti.db.v8`, `cafepos.db.v8`, v7 and
  v6 local databases
  with safe defaults for the new fields. Seed data includes realistic sample stores for all six business
  types.
- All of this remains browser-local demo behavior. It is not authoritative or
  tamper-resistant; production authorization, inventory and receipt numbering
  still require the Phase 2 backend described below.

### Requested feature phases 2–9 ⏳ not started

Restaurant open orders and tables; returns and labels; Tunisia VAT/fiscal
compliance; ingredients and inventory; shifts, permissions and activity
history; loyalty/promotions/sharing; expanded reports; and PWA/display/backup/
polish remain planned work.

---

## 1. Audit summary (what the app is today)

| Area | State before this phase | Now |
| --- | --- | --- |
| Auth | Browser-local demo auth | PBKDF2-hashed passwords/PINs, store-layer checks and PIN lockout; server auth still needed |
| POS | Quick + cashier mode, customer attach, tabs, discounts | + auto/manual printing, kitchen tickets |
| Orders | History, void (admin only) | + manager-PIN void authorization, reprint, `voidedByName` audit |
| Customers | Regulars cards, monthly settlements, staff read-only profiles | Unchanged |
| Reports | Daily/monthly charts, CSV export | + X/Z register reports (new page) |
| Register | **None** — no session concept | X report, Z close with counted cash + difference, immutable history |
| Printing | Browser print dialog only | + real ESC/POS over WebSerial (58/80 mm), test print, kitchen tickets |
| Inventory | Product stock counters only | Unchanged (Phase 5) |
| Offline | None (localStorage demo DB) | Unchanged (Phase 7) |
| Multi-tenant | Frontend-only isolation by `storeId` filters | Unchanged (Phase 2 = real backend) |

Data lives in `localStorage` under `7anouti.db.v9` (with migrations from legacy
`cafepos.db.*` keys). **This is a demo backend, not production storage** — it exists so the UX can be reviewed without
infrastructure, and every mutation is funnelled through `AppStore` so a real API
can replace it one-for-one.

---

## 2. Phase status

### Phase 1 — Audit ✅ (this document)

### Phase 2 — Backend, DB, multi-tenancy ⛔ blocked (next phase)

Cannot be completed in this environment: no server, no PostgreSQL. What is
**not** faked:

- No API server / PostgreSQL schema / migrations were written.
- There is no trusted server: PBKDF2 hashing, PIN lockout, manager-PIN checks,
  store ownership checks, admin-only mutation checks, register requirements,
  stock/discount/credit-limit validation, expense ownership, and admin
  protections are currently enforced by the browser store layer (`AppStore`).
- Client-side controls can be bypassed by a user who can alter localStorage or
  the running JavaScript. They are defense-in-depth for the demo, not
  production authorization or tamper-resistant audit history.

**Plan (next phase):** Node + Fastify (or NestJS) + PostgreSQL with row-level
tenancy (`store_id` on every row + RLS), JWT access tokens, server-side
password/PIN hashing (argon2id), rate limiting on login, audit log table,
server validation for all mutations, and authoritative register/inventory/
ledger state. The browser's PBKDF2 hashes and guards do not replace these.
The frontend's `AppStore` seam maps 1:1 onto REST endpoints.

### Phase 3 — Touch POS + ESC/POS printing ✅ implemented (see §4 for hardware)

- Receipt/kitchen/report **line models** (`src/lib/escpos.ts`) rendered both as
  an on-screen monospace preview and as **raw ESC/POS bytes** (ESC @ init, ESC t
  codepage 16 = Windows-1252, ESC a alignment, ESC E bold, GS ! size, ESC d
  feed, GS V partial cut).
- **WebSerial bridge** (`src/lib/printer.ts`): user picks the port once
  (`requestPort`), port is silently re-opened on later visits (`getPorts`),
  read loop drains status bytes so ACK-printers don't stall, chunked writes with
  backpressure, busy-locking, disconnect handling.
- Shared **print dialog** (`src/components/PrintPreview.tsx`): preview exactly
  what prints; send to printer when connected, otherwise the browser print
  dialog as fallback. Used by POS receipts, kitchen tickets, Orders reprint,
  X/Z reports and the settings test print.
- Settings card: enable, 58/80 mm width, auto/manual mode, connection type,
  baud rate, kitchen tickets, connect/disconnect, test print.
- POS: auto-print after checkout (auto mode) with graceful fallback, manual
  Print button, separate kitchen ticket for dine-in when enabled.
- Orders: reprint with `*** REPRINT ***` marker.

### Phase 4 — X / Z cash register reports ✅ implemented

- `RegisterSession` model: unique id, store, status open/closed, opening cash,
  opener, closer, counted cash, difference, close note, **immutable snapshot**.
- **X report** (`src/pages/admin/Register.tsx`): live interim totals computed
  from persisted orders/ledger/expenses inside the session window — opening
  cash, sales by method, discounts, tax, service, tab payments, voids, refunds,
  expenses, expected cash in drawer, by-employee and by-category breakdowns,
  transaction count, generation time + employee. Never mutates the session.
- **Z closing**: counted cash input with live difference, close note, on
  confirm the snapshot is computed **once** and frozen (`closedAt`,
  `closedByName`, `countedCash`, `difference`). A closed session cannot be
  reopened or edited; a duplicate close is rejected; opening a new session is
  blocked while one is open.
- Z history: every closed session listed with its difference (±, colour-coded),
  viewable and **re-printable exactly as it was closed** (prints from the
  frozen snapshot, not recomputed).
- Void authorization: staff voids require a manager PIN (validated against the
  store's active admins inside the store layer); the void records
  `voidedById/Name/At`, restores tracked stock, and reverses the outstanding
  tab charge without making the balance negative. Any already-paid remainder is
  recorded as a flagged customer-credit ledger entry. Admin voids record the
  admin.
- Register permissions: `permissions.register` gates open/close/X/Z pages and
  actions (Amine/Karim have it; Salma/Hedi don't — demo lock states).

### Phase 5 — Inventory, recipes, suppliers ⏳ not started

Current stock is per-product counters only. Plan: ingredient catalogue,
recipe consumption per product, movement ledger (reason + employee + reference
on every movement), low-stock alerts, valuation, suppliers + purchases.

### Phase 6 — Staff management hardening ⏳ partially blocked

Unique PINs, store-scoped access, granular permissions, PBKDF2 credential
hashing in local storage, and a 30-second lock after five failed store-PIN
attempts are implemented in the demo. Phase 2 must add server-side hashing,
authoritative rate limiting, session timeout, and activity tracking.

### Phase 7 — Offline-first ⏳ not started (needs Phase 2 API design)

Plan: IndexedDB mirror + mutation queue with UUIDs, service-worker app cache,
sync with conflict detection (per-record version), never discard pending work.

### Phase 8 — Owner PWA ⏳ not started · Phase 9 — Support/subscriptions ⏳ not started

### Phase 10 — Full QA ⏳ ongoing per phase

---

## 3. Printing support matrix (honest)

| Environment | ESC/POS over USB (WebSerial) | Browser print dialog |
| --- | --- | --- |
| Chrome / Edge — Windows desktop | ✅ supported | ✅ |
| Chrome / Edge — macOS / Linux desktop | ✅ supported | ✅ |
| Chrome — Android | ⚠️ `requestPort` exists but USB-serial drivers/OTG cables vary; treat as untested | ✅ |
| Firefox / Safari (desktop & iOS) | ❌ no WebSerial | ✅ |

Hardware checklist before onboarding a real café:

1. Printer is ESC/POS-compatible (Epson TM-T20/T88 clones, Xprinter, etc.) and
   powered; USB cable connected to the terminal PC.
2. In Chrome/Edge open Settings → click **Connect printer** → pick the port;
   baud 9600 (or printer DIP-switch value).
3. Click **Test print** — verify text width matches the configured 58/80 mm
   roll, then the partial cut fires.
4. Complete a cash sale → receipt prints (auto) or via Print button (manual).
5. Enable kitchen tickets + dine-in order → separate ticket prints.
6. Close the day with Z → confirm the printed Z matches the on-screen numbers.

**Known limitation:** Arabic text is not encodable in Windows-1252/CP437 on
standard ESC/POS firmware — Arabic receipt content requires a printer with an
Arabic codepage or a raster-image pipeline (Phase 2+); current builds replace
unsupported Arabic glyphs with `?`. Emoji are omitted from printed item names
because the selected codepage cannot render them. French/Latin text and TND
amounts are fully supported.

---

## 4. Test results for the shipped phases

Executed in-browser (Chrome, dev build) against the seeded demo data:

- DB migrates to `7anouti.db.v8` from legacy `cafepos.db.v8`, v7 and v6 keys,
  hashing legacy credentials and retaining
  2 closed Z sessions + 1 open session per store; register nav visible for admin; staff without `register` permission
  redirected from `/admin/register`; staff with permission can access.
- X report matches on-screen expected cash (opening + cash sales + tab
  payments − expenses − refunds) and does not mutate the session.
- Z close: counted-cash modal shows live difference; closing freezes the
  session (id becomes `closed`, appears in history); duplicate close and
  reopening are rejected; new session opens after close.
- Z reprint from history prints the frozen snapshot numbers.
- Orders reprint shows `*** REPRINT ***`; staff void demands a manager PIN;
  wrong PIN rejected; correct PIN voids and records `voidedByName` (visible in
  the order drawer); tab charge reversal lands in the ledger.
- Settings: printer card saves (enabled/width/mode/connection/baud/kitchen);
  test print opens the print preview; connect shows an explanatory error on
  browsers without WebSerial.
- POS: checkout receipt modal offers Print; kitchen button appears only for
  dine-in when kitchen tickets are enabled; auto mode sends to the printer when
  one is connected and otherwise falls back to the print dialog — verified
  manually with `mode: auto` on a clean profile.
- `npm run build` passes clean (tsc + vite).

Phase 1 build/type validation also passes. Manual browser scenarios still to run:

- Confirm all six seeded business types display appropriate product/category
  samples; create a store as super admin, then sign in as its initial admin and
  verify the setup wizard applies the selected template.
- Create/edit a product with required and optional single/multiple modifiers;
  verify POS selection, distinct cart lines, unit price, receipt, kitchen ticket
  and report totals.
- Add and scan product/variant barcodes, including an unknown code; test
  barcode feature off and on.
- Sell a variant and verify its price/cost/stock; sell 0.125 kg and verify the
  three-decimal quantity, total and stock validation; void each order and verify
  tracked stock is restored.

Not executable here: real thermal printer over WebSerial (no hardware) — see
§3 checklist; backend tests (no backend).

---

## 5. Remaining limitations / next steps

1. **Backend (Phase 2)** is the critical path: real auth, tenancy, audit logs,
   backups. The frontend store layer is the seam.
2. Server-backed authentication, authorization, lockout and tamper-resistant
   audit data — Phase 2. Browser-side credential hashing and lockout are only
   demo protections.
3. Inventory module (Phase 5) — next implementation phase after backend, or in
   parallel since it is frontend-compatible.
4. Arabic receipts — needs raster printing pipeline.
5. Offline mode (Phase 7) — after the API contract exists.
6. Payments/gateway — not integrated (no provider/credentials yet).
7. Tests: no automated test runner yet; per-phase manual QA is recorded here.
