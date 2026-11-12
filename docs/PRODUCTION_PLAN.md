# Kawa POS — Production Plan

Status document for turning the Kawa POS frontend into a production-ready POS
platform for Tunisian cafés, restaurants, snacks and salons de thé. It records
the audit of the current build, what is implemented per phase, what is honestly
**not** implemented yet, and the hardware/browser support matrix.

Last updated: 2026-11-12 · repo phase: **Phase 3 + Phase 4 shipped** (touch POS
print pipeline + X/Z cash register), Phase 2 (backend) documented as the next
major milestone.

---

## 1. Audit summary (what the app is today)

| Area | State before this phase | Now |
| --- | --- | --- |
| Auth | Email + staff PIN, plaintext demo store | Unchanged (Phase 2 will hash) |
| POS | Quick + cashier mode, customer attach, tabs, discounts | + auto/manual printing, kitchen tickets |
| Orders | History, void (admin only) | + manager-PIN void authorization, reprint, `voidedByName` audit |
| Customers | Regulars cards, monthly settlements, staff read-only profiles | Unchanged |
| Reports | Daily/monthly charts, CSV export | + X/Z register reports (new page) |
| Register | **None** — no session concept | X report, Z close with counted cash + difference, immutable history |
| Printing | Browser print dialog only | + real ESC/POS over WebSerial (58/80 mm), test print, kitchen tickets |
| Inventory | Product stock counters only | Unchanged (Phase 5) |
| Offline | None (localStorage demo DB) | Unchanged (Phase 7) |
| Multi-tenant | Frontend-only isolation by `storeId` filters | Unchanged (Phase 2 = real backend) |

Data lives in `localStorage` under `cafepos.db.v6`. **This is a demo backend,
not production storage** — it exists so the UX can be reviewed without
infrastructure, and every mutation is funnelled through `AppStore` so a real API
can replace it one-for-one.

---

## 2. Phase status

### Phase 1 — Audit ✅ (this document)

### Phase 2 — Backend, DB, multi-tenancy ⛔ blocked (next phase)

Cannot be completed in this environment: no server, no PostgreSQL. What is
**not** faked:

- No API server / PostgreSQL schema / migrations were written.
- No password or PIN hashing (demo store keeps plaintextPINs visible to admins
  on purpose for the demo).
- Server-side tenant isolation does not exist; isolation is currently enforced
  at the store layer (`AppStore` guards + `storeId` filters).

**Plan (next phase):** Node + Fastify (or NestJS) + PostgreSQL with row-level
tenancy (`store_id` on every row + RLS), JWT access tokens, bcrypt password
hashing + PIN hashing (argon2id), rate limiting on login, audit log table.
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
  store's active admins); the void records `voidedById/Name` and tab charges
  are reversed. Admin voids record the admin.
- Register permissions: `permissions.register` gates open/close/X/Z pages and
  actions (Amine/Karim have it; Salma/Hedi don't — demo lock states).

### Phase 5 — Inventory, recipes, suppliers ⏳ not started

Current stock is per-product counters only. Plan: ingredient catalogue,
recipe consumption per product, movement ledger (reason + employee + reference
on every movement), low-stock alerts, valuation, suppliers + purchases.

### Phase 6 — Staff management hardening ⏳ partially blocked

Unique PINs, store-scoped access and granular permissions exist. Blocked on
Phase 2: server-side hashing, failed-attempt lockout, session timeout, activity
tracking.

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
unsupported glyphs with `?`. French/Latin text and TND amounts are fully
supported.

---

## 4. Test results for the shipped phases

Executed in-browser (Chrome, dev build) against the seeded demo data:

- DB migrates to `cafepos.db.v6` with 2 closed Z sessions + 1 open session per
  store; register nav visible for admin; staff without `register` permission
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

Not executable here: real thermal printer over WebSerial (no hardware) — see
§3 checklist; backend tests (no backend).

---

## 5. Remaining limitations / next steps

1. **Backend (Phase 2)** is the critical path: real auth, tenancy, audit logs,
   backups. The frontend store layer is the seam.
2. PIN/password hashing and lockout — after Phase 2.
3. Inventory module (Phase 5) — next implementation phase after backend, or in
   parallel since it is frontend-compatible.
4. Arabic receipts — needs raster printing pipeline.
5. Offline mode (Phase 7) — after the API contract exists.
6. Payments/gateway — not integrated (no provider/credentials yet).
7. Tests: no automated test runner yet; per-phase manual QA is recorded here.
