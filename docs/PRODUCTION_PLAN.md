# 7anouti-POS — Production Plan

Status document for turning the 7anouti-POS frontend into a production-ready POS
platform for Tunisian cafés, restaurants, snacks and salons de thé. It records
the audit of the current build, what is implemented per phase, what is honestly
**not** implemented yet, and the hardware/browser support matrix.

Last updated: 2026-11-16 · shipped: **POS hardening, architecture refactor,
business templates, visual/icon upgrade, section/manual table modes, persistent
table rounds, table-aware orders, compact POS cart layout, automatic table
orders and station tickets, station-device kiosk pairing, hub sync/offline
outbox, PWA foundation, configurable POS automation, per-staff shifts, table
handover, cash-difference tracking, owner-only store-day Z closeout with a
daily staff-working-float input and full-store cashier attribution, live
branding previews and palette-driven primary brand colors, standalone app/hub
detection, and mobile-safe dashboard, product, purchase, expense, and report
layouts**. Staff
close their own shifts into frozen X snapshots; the owner closes one immutable
daily Z after all shifts end. The owner enters that day's variable staff float
and counted cash; the frozen Z includes every cashier's sales, table orders,
and tab settlements and identifies the administrator closing the day. Staff
analytics and cash differences are implemented in the client store.
The current audit status below supersedes older roadmap statuses later in this
document.

### Staff access and scheduled shifts — implemented; browser verification pending

- Staff without an open shift are routed to a limited screen with only their
  own schedule and shift-opening control. In hub mode, snapshots withhold store
  operations and other staff profiles until the staff member opens a shift;
  mutations are also blocked server-side. Standalone mode applies the same
  route and store-mutation guards.
- Admin → Settings → Register & checkout controls whether shifts are required
  for store access, whether opening must match today's schedule, whether an
  unscheduled shift is permitted, early/late opening windows, and whether login
  is limited to scheduled hours. Schedule enforcement and login restriction
  default off; shift access defaults on.
- Blocked schedule logins and shift openings are recorded for the owner in
  Shift alerts. Hub schedule checks currently use the hub machine's local time;
  store-specific time zones are not configured.
- Still unverified in a live browser: the complete pre-shift / open-shift route
  transition, owner alert rendering, and schedule controls on phone/tablet
  layouts.

### Inventory yield and staff items — implemented; browser verification pending

- Admin → Settings → Service can configure yield tracking for multiple inventory
  items, choose consuming products or categories, and set a reference stock
  quantity and minimum/maximum sales yield. There is no hidden 100-item cap;
  app and hub preserve every valid configured tracker. Shift and frozen Z
  reports compare estimated use, recipe use, expected remainder, and the stock
  ledger. Opening stock, manual counts, and received purchases use the existing
  Inventory and Purchases workflows. Exact recipe deductions remain controlled
  by Order rules → Deduct ingredients on sale.
- Admins configure staff-item pricing, permitted products, and per-shift
  quantity limits with searchable product selection. Staff can search and record
  their own items during an open shift. Checkouts use configured prices, force
  recipe stock deductions, and are attributed to the staff member in inventory
  movements, Z reports, and staff profiles. Access also requires the staff
  member's **Use staff items** permission.
- Still unverified: multi-device hub checkout races, physical Z receipt output,
  staff self-service on a phone/tablet, and the stock-count-to-Z workflow in a
  live browser.

### Unified order rules and stock — implemented; browser verification pending

- Implemented: shared app/hub order-line validation, open-table reservations,
  stock overflow modes and confirmer records, recipe fields/editors and
  optional ingredient deduction, payment-time revalidation, open-order price
  policy, checkout idempotency keys, and hub-assigned sequential numbers with
  offline provisional labels.
- Store and hub validate order lines and stock overrides. Ingredient and linked
  inventory deductions clamp at zero and create stock-movement/audit records;
  void restores the corresponding tracked quantities.
- Settings are grouped under Settings → Service → Order rules. Defaults and
  migration/hub normalization preserve existing stores.
- Remaining/unverified: concurrent-phone payment races, PIN override through a
  live hub, recipe/restock behavior in the browser, and 360/768 px layouts.
  Purchases and stock-ledger changes are not yet one atomic hub transaction
  with payment; see `docs/AUDIT.md` and `docs/DECISIONS.md`.

### POS catalog connectivity — code-path verified; browser verification pending

- Admin product creation writes to the same store-scoped product collection the
  POS reads. POS hides inactive items, other stores/categories, and (when
  configured) unavailable stock; its empty state now explains matching items
  hidden by stock. Recipe-based hiding now checks the full ingredient inventory.
- Still unverified in a live browser: the user’s specific item, store, category,
  active status and stock settings.

### Admin authorization PINs — implemented; browser verification pending

- Implemented: store admins can set/reset their own 4–12 digit PIN from Admin →
  Team. The value is hashed and audited; it is not shown again. This updates
  the admin account's existing PIN sign-in credential as well.
- Active admin and permitted active manager PINs are validated locally in
  standalone mode and server-side by the hub in connected mode. Hub responses
  expose only the authorizer ID/name, never credential hashes; deactivated
  users and users without the purpose-specific permission are rejected.
- Hub API and local helper tests cover void, table-cancel and stock-override
  authorization, including inactive and unauthorized PINs. Full browser UI and
  multi-phone validation remain **UNVERIFIED**.

### M6 audit items 41–45 — tests/docs/security complete; UI audit pending

### Availability (86) — partially implemented

- Implemented: typed availability settings and migration defaults, a shared pure
  rule, local/hub order rejection, POS tile overlays and cart blocking, POS 86
  list, product-linked inventory, audited manual 86/return actions, and
  `manage86` permissions. Restock is now the default return mode: receiving
  stock through Purchases persists the return for linked products and variants.
  Owners can still choose Manual or At a time in Settings or for an individual
  86. The Products page supports filtering, row toggles and bulk return/86.
- Still demo-only or incomplete: 86s explicitly set to Manual still require a
  manual return; bell and station-board count notifications, day/first-shift
  reset behavior, and live multi-phone notification verification are absent.
  Browser flows remain **UNVERIFIED**.

- `npm run test:all` passes 43 tests, including hub authorization, snapshot
  privacy, backup/restore, pairing scope, change-set replay, station routing,
  ticket formats, ESC/POS width and virtual TCP output. `npm run hub:sim` starts
  the real hub with the loopback virtual printer.
- Hub review findings were fixed: schedules and register sessions now enforce
  actor permissions/ownership and immutability; permission-filtered snapshots
  retain the authenticated store document needed for app normalization; public
  virtual-printer capture preview was removed. The hub integration suite
  exercises these boundaries.
- Authenticated WebSocket change messages trigger immediate authoritative
  snapshot refresh; the 2.5-second poll remains a missed-message/reachability
  fallback. This is still full-snapshot sync, not an incremental change log.
- Required operational docs are present. See `docs/PROGRESS.md` for the
  PASS/UNVERIFIED table for all ten requested scenarios and deployment steps.
- Multi-context Playwright scenarios and the 360/768/1280 px accessibility,
  responsive and dark/light contrast audit remain **UNVERIFIED**. Real printer
  transports, drawer kick and physical output are **untested on hardware**.

### Automation items 33–40 — implemented

- **Orders/receipts:** per-device `auto` / `ask` / `never` receipt policy,
  automatic latest receipt preview/reprint, cash drawer kick setting, and
  latest completed receipt shortcut. Drawer/receipt output depends on configured
  routes and remains unverified on physical hardware.
- **Security:** inactivity lock and longer auto-logout settings. The lock keeps
  POS state mounted and does not clock out attendance. Local mode verifies a
  local PIN hash; hub mode verifies via the authenticated hub without exposing
  credential hashes to clients.
- **Shifts/stock:** required-shift prompt and order-entry block in the POS,
  checkout validation in the store and hub, elapsed-shift reminder, open-table
  warning, low-stock dashboard/bell alerts, and optional out-of-stock hiding.
  Per-staff shifts, table handover, configurable cash differences, and long-shift
  alerts are now implemented; multi-device browser handover scenarios remain
  unverified.
- **Printing:** authorized WebSerial reconnect polling, bounded local and hub
  retries, primary-to-fallback routing, and hub admin alerts after observed
  printer failures. Offline health is not proactively probed; real output and
  retry behavior need hardware tests, and retries can duplicate output.
- **Hub:** backup age health endpoint/admin alert at 48 hours and manual update
  procedure; no auto-update. Health checks backup metadata, not restoration.
- **Review/settings:** findings and risk/effort are listed in
  `docs/AUTOMATION.md`; store options are grouped on one Automation settings
  page. Safe simple changes were implemented.
- `npm run build`, `npm run lint`, and all 43 tests pass. Required multi-context
  Playwright scenarios remain unverified; physical devices require testing.

### M4 client sync and offline — implemented; phone-flow validation pending

- Hub connection status was moved from the header to Settings → Connection &
  logs. The panel includes device/session/sync/outbox/printer/backup details and
  a bounded device-local activity history; it does not expose global hub logs.
- The app auto-selects `HubProvider` when served from the same-origin shop hub;
  standalone mode retains `LocalProvider`. Hub login uses hub authentication;
  IndexedDB is the offline cache and ordered change-set/print outbox.
- Outbox replay uses stable idempotency keys and capped exponential backoff.
  The hub returns authoritative snapshots with sequence numbers; reconnect
  applies a full snapshot after pending writes are acknowledged. Concurrent
  table line additions merge, same-line edits use the newest timestamp, and
  simultaneous opens coalesce into one table order. Product/category conflicts
  are surfaced for review.
- TopBar shows hub/local connection state, pending work, printer status, failed
  prints, and menu conflicts. An unattempted queued WebSerial print can be
  redirected to the phone; ambiguous hub attempts remain queued to prevent
  duplicate output. Printer health is based on hub-observed outcomes, not a
  physical-device probe.
- A cloud adapter interface/stub is present; no cloud backend is configured.
  JSON backup import/export remains the backup path.
- The PWA shell, manifest, six PNG icons, install prompt and offline font stack
  are implemented. Service-worker/PWA behavior requires a secure context:
  plain HTTP on a LAN IP provides online POS only; use the hub HTTPS option for
  app-shell offline loading and installation.
- Build and lint pass and all 43 Node tests pass. The real hub and virtual
  printer are covered by integration tests. Three-phone Playwright coverage of
  table ownership and live kitchen/bar tickets remains unverified; physical
  printer output needs hardware.

### M3 local shop hub — implemented

- The Node 22+ hub serves the built app, status/QR page, REST and WebSocket APIs,
  paired station boards, fsynced per-store JSONL records, 14 retained backups,
  restore/import, authentication, rate limiting, private-LAN binding and
  configurable local HTTPS. It has no third-party runtime dependencies.
- Order item prices and totals are rebuilt from store catalog/settings;
  permission-gated ledger writes are append-only and credit charges are checked
  against their order. Payment tender reconciliation, customer credit limits
  and authoritative close-report arithmetic remain unimplemented.
- Automated hub API coverage passes, including store scoping, multiple WebSocket
  clients, a virtual TCP printer, concurrent table-order coalescing and shift/
  owner preservation. Build, lint and all 43 Node tests pass. A single-browser
  smoke reached hub login/setup; the three-phone Playwright flow remains
  unverified. Physical printers remain untested.
- Standalone mode remains browser-local; hub-served POS uses HubProvider.
  The cloud HTTPS site cannot call an HTTP hub.

### M1b station devices — implemented locally and through the hub

- Settings → Stations manages station-screen devices, assigned stations,
  expiring pairing codes, disable/enable/unpair, and last-seen timestamps.
  `/pair` and station operations use hub APIs in HubProvider mode; standalone
  mode keeps pairing local. `/kiosk` locks the screen behind an owner/manager
  PIN and does not create staff attendance or shifts.
- Staff with station access can open `/kitchen` or a station-specific board,
  choose their post-login station preference, and use the Cook / Barista
  station-only preset. Station devices and boards enforce local station scope.
- The station board shows the same-device limitation in standalone mode and
  hides it when HubProvider is active. App-local QR generation remains deferred;
  the hub's `/status` page has its own QR link.
- Standalone pairing remains local. Hub-backed station delivery is implemented,
  but complete multi-phone and physical-kiosk interactions are not verified.
- Automated coverage checks code expiry/store matching, station scoping, and
  station-only permissions/attendance. Browser smoke loaded `/pair` and
  Settings; end-to-end pairing, PIN exit, responsive layouts, and the complete
  cross-device phone flow remain unverified.

### M2 printing architecture — implemented with local and hub queues

- Settings → Devices & printing manages printer records, routes for receipts,
  X/Z reports, labels and station tickets, station printer links, test prints,
  device-local print preference, and receipt/station print policies. Printer
  history is retained when a used printer is removed.
- Configured output is persisted through `enqueuePrint`; HubProvider forwards
  jobs to the hub and queues them offline. WebSerial and browser print transports
  are available, while Bluetooth remains a feature-detected protocol stub.
  Print jobs can be filtered, retried, cancelled and reprinted; failed jobs are
  visible in the TopBar.
- ESC/POS byte rendering is shared in `src/shared/escpos.ts`, including 58/80mm
  widths, CP1252/437/850/858 selection, drawer kick and cut modes.
- Build and lint pass; all 43 Node tests pass. Physical output, drawer kick,
  codepage rendering and cut behavior have not been verified on hardware.
- Standalone printer jobs remain browser-local; hub-served jobs use the hub
  queue. Generic Bluetooth printer protocols are not configured.

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

The app is now branded 7anouti-POS. Existing local database keys are migrated
from localStorage into IndexedDB on first load, then removed after the
IndexedDB save succeeds. The small session key remains in localStorage.
The default platform palette now follows the logo: navy surfaces, cool light
backgrounds, amber highlights, and accessible navy-on-amber actions. The
sidebar, shared controls, POS, reports, and receipt branding use the shared
brand tokens. Appearance supports System, Light, and Dark; System follows the
device preference live, and the pre-React boot script sets the matching theme
class, browser chrome color, and form-control scheme. The selected mode is saved
as a local UI preference, while the store's System mode is the default when no
local choice exists. Custom store accent palettes remain available and their
foreground colors are selected for readable text. These preferences and all
local data remain browser-local demo behavior, not a production security boundary.
The shared logo uses the supplied `logo/logo1.png` image, and the browser-tab
favicon is set to the same image. The PWA SVG icon uses matching navy-and-amber
colors.
Existing stores using the former default caramel palette are migrated to the
7anouti palette; custom accent selections remain unchanged.

The admin, staff, and platform-owner dashboards now share a responsive
dashboard component set and the app shell is split into a collapsible sidebar,
top bar, and mobile navigation. The top-bar navigation toggle is mobile-only;
desktop users can collapse the sidebar from its own control. Dashboard totals
reuse the existing report and ledger data; month profit is explicitly an
estimate based on current product costs and recorded expenses. The shared top
bar keeps the appearance toggle available to staff on their dashboard; the
mobile POS header hides store metadata and centers its compact action buttons,
including the dashboard shortcut; larger screens retain the store identity.
The sticky top
bar uses a 60%-opaque blurred surface. Sidebar spacing,
store details, icons, and labels are compacted while navigation targets remain
easy to tap; the selected store icon has a white tile for contrast. The collapsed
sidebar shows icon-only quick links for Overview, POS, Stations,
Orders, and Staff, with additional links shown when the available sidebar
height allows; its three-line button reveals the remaining sections and
logout in a popover that sizes its columns to the available viewport width and
number of sections. The sidebar uses a translucent navy glass surface, softly
animated shortcuts, and a blurred navigation popover. Open table
rounds now store per-item station routing and lifecycle status; last-login
history and billing workflows remain unimplemented. Planned staff shifts are
modeled separately from live register or order-tracking data. Those dashboard
sections are omitted, marked unavailable, or limited to the data already
stored; no demo values are presented as production data.

### Visual and icon upgrade ✅ demo implementation

- Semantic color tokens now define payment, order, stock, money-flow, trend,
  and icon colors for both themes. Report payment colors are cash green, card
  blue, and credit amber; report/dashboard charts use those tokens and include
  legends.
- Store, category, and product records use Lucide icon keys and semantic icon
  colors. Existing emoji-backed records migrate to the nearest icon during
  local database normalization; the legacy emoji property is removed. The
  current schema is `7anouti.db.v21`, with older IndexedDB/local records
  normalized during load. Store logos and product images can be uploaded and
  resized to 256 px client-side (up to 300 KB).
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
- IndexedDB persistence is debounced; read/write failures are logged and do not
  block login or in-memory work. A toast warns when changes cannot be persisted.
- Store owners can manage store branding (logo, accent palette, default theme),
  upload their profile photo, and edit team photos alongside existing name,
  username, PIN, permission, and active-status controls. Staff sign in with a
  unique username and PIN; admin accounts retain email/password login.
- Store admins have an append-only, per-store activity log for sign-ins,
  orders, catalog, customers, staff, expenses, registers, settings, payroll,
  shifts, and tables. The admin page supports filters, readable before/after change tables, optional
  technical JSON, CSV export, and 50-entry pagination. Entries are capped at
  3,000 per store and remain browser-local demo data, not tamper-resistant
  audit history.
- Payroll is available from the Expenses page: owners set staff salary type
  and amount, review full/half/absent attendance, manually correct attendance,
  issue advances, and pay each staff member once per month. Staff clock in on
  login, clock out on logout, and refresh `lastSeen` each minute; stale or
  prior-day sessions are auto-closed. Advances and net salary payouts appear
  separately as expenses, with payroll and manual attendance changes logged.
  Staff can view only their own attendance and advances; admins and shift
  managers can review staff profiles, payroll, attendance, schedules, and
  related activity. Weekly shift plans are persisted, checked for overlaps,
  and included in the activity log. These workflows and records remain
  browser-local demo behavior.
- Local Chrome smoke review covered the dashboard, report donut/bars, POS
  catalog, settings icon picker, and light/dark presentation. The mobile
  settings viewport had no horizontal overflow. The   local v16 database contains
  icon keys on every store/category/product and no remaining legacy emoji
  fields.
- This remains a browser-local demo: image data and business records live in
  IndexedDB. Browser/device QA for both themes, reduced transparency,
  end-to-end image uploads, login, order flows, and 200-product POS catalogs
  remains a manual release check.

## Requested feature roadmap

### Manager and inventory rollout (2026-11-13)

- **Manager role and capabilities — implemented demo behavior.** Store owners
  can create managers with username/PIN login and grant the supported
  capabilities. Manager route and mutation checks use the same browser-local
  guards; the demo manager seed account is `nadia.yasmine` / `3456`. Legacy
  permissions migrate to safe role defaults, staff cannot retain manager-only
  capabilities, and permission changes immediately refresh in the active app
  session and are audited. Financial-summary visibility and access to the
  Reports page are separate controls. Protected routes and store mutations
  enforce the corresponding capability; mobile navigation exposes permitted
  manager tools, including register and settings, and can scroll when needed.
- **Inventory items and stock ledger — implemented demo behavior.** Managers
  with inventory access and admins can create/edit items, set base units,
  package conversions and reorder levels, record one-time opening stock,
  stock counts, adjustments and waste, and review recent movements. Stock
  quantities, costs and audit events are persisted locally. Purchase receiving
  updates weighted-average costs; recipe-based stock consumption remains
  planned.
- Schema `7anouti.db.v20` normalizes inventory, supplier, purchase and payment
  records; earlier local records receive empty collections for new fields.
  New demo seed data includes café ingredients, a supplier and a partially paid
  purchase. These remain editable browser-local demo records, not a trusted
  backend or tamper-resistant ledger.
- **Implemented locally:** the Purchases page manages suppliers, receives
  packaged inventory with invoice details and an optional receipt image,
  updates on-hand quantities and weighted-average costs, and records partial
  supplier payments. Purchase edits/voids are blocked after payment or later
  stock activity; cash supplier payments reduce the open register's expected
  drawer balance. These records are browser-local demo data.
- Inventory lists now share reusable search, responsive table, and CSV export
  controls; the export omits average-cost data for users without cost access.
  Purchase search and filtered CSV export use the same shared toolbar/export
  controls. Product and customer deletion confirmations use a shared modal.
- **Still planned:** recipe costing and automatic stock consumption; daily
  close/count reports; and staff consumption and allowances. These phases have
  not been implemented.

### Browser-local data and backups

- **Current behavior:** application data is stored per browser in IndexedDB;
  pushing a code release does not transfer or merge another browser's records
  or newly added seed data. Until the Phase 2 backend exists, exporting and
  importing a JSON backup is the local data backup/restore mechanism.
- Settings → Data is owner-only and provides full-database JSON export/import,
  import confirmation counts, typed `RESET` confirmation for restoring demo
  seed data, app/database/build version identifiers, and a collapsed
  diagnostics panel with store ID, active tables, staff, POS mode, and feature
  flags. Backups preserve the stored password and PIN hashes. Imports are
  normalized and must include the active owner and store.
- Startup compares the previous IndexedDB build timestamp with the deployed
  build, records an app-update audit event, and notifies the owner about
  settings that remain off by default. This is a local notification only; it
  does not synchronize data or seeds across browsers.
- Login and backup screens warn that records are browser/device-local. Staff
  need the same browser data. Import currently requires an already available
  active owner and store, so a first-time restore to a clean browser still
  needs a dedicated bootstrap flow or backend.

### Phase 1 — Business types and product options ✅ demo implementation

- Stores support cafe, restaurant, bakery, snack, retail and salon templates.
  A super administrator can create a store with its first administrator; that
  administrator chooses a business type at first sign-in. The template supplies
  starter categories, POS mode, feature defaults and receipt footer.
- POS mode and table availability are independent settings. Staff navigation
  shows Floor for every store role when table service is on, including on
  mobile. Cashier mode retains its payment flow; in Quick mode, completing a
  table round records it as unpaid and returns to Floor without opening payment.
  Both modes keep table rounds editable and support moving and merging orders.
  Settings can also toggle delivery, kitchen screen, barcode scanning and
  weight-based items. Admins can add, edit, reorder, deactivate, quick-add and
  remove dining tables; used table records are deactivated to preserve history.
- Schema `7anouti.db.v21` enables table service for legacy stores that already
  contain dining tables; Settings also warns admins when tables exist but the
  feature is off. The compact POS cart caps its footer at 8rem and compresses
  the customer attach control. The order-note action stays pinned and visible
  outside the footer's scroll area on desktop and mobile, and expands the editor
  when selected. The mobile cart opens as a taller, denser sheet; its subtotal
  and tax share a compact row, and its total and primary action share another
  row to leave more room for order lines and controls; at a 1110 by
  503 desktop viewport, all three order rows, the total and primary checkout
  action were visible together. The POS 86-list button uses a gray flag when
  nothing is unavailable and a waving red flag when unavailable items exist;
  the numeric badge is removed.
- Dine-in is available only when table service is enabled and requires an active,
  unoccupied table; the picker labels occupied and available tables. The floor
  shows order ownership and moved, merged, and transferred table history. Table
  names are snapshotted on orders and shown on receipts, ESC/POS kitchen tickets,
  the Orders page and CSV exports. Delivery is opt-in.
- Schema `7anouti.db.v15` introduced dining tables and preserved historical
  orders without table details. Seed data includes eight tables and sample
  table-linked restaurant orders. These remain browser-local demo records.
- Products support modifier groups/options, variants with independent price,
  cost, barcode and stock, product barcodes, per-item notes, and sales by kg/g/
  piece to three decimal places. POS validates and snapshots chosen variants and
  modifiers from the local catalog; receipts, kitchen tickets and sales totals
  use the saved line details.
- `7anouti.db.v16` in IndexedDB migrates previous v15/v14/v13/v12/v11/v10 IndexedDB/localStorage
  data and legacy `7anouti.db.v9`, v8, `cafepos.db.v8`, v7 and v6 databases with
  safe defaults for new fields, including staff usernames. Seed data includes
  realistic sample stores for all six business types.

### Phase 1 — Table modes and sections ✅ browser-local demo implementation

- Settings → Tables supports `sections_tables`, `tables_only`, and `manual`,
  including section/table CRUD, assignment, filtering, and ordering. The floor
  has section tabs and My tables / All / Unassigned filter controls; Unassigned
  is populated by the handover flow and new shifts can take over tables. Manual mode takes
  a free-form table name with suggestions from currently open tables.
  Configured-table modes show occupied/available status; manual mode records
  names without an inventory of available tables.
  Configured section colors and icons are displayed in the Settings preview,
  table-floor filters and headings, and the POS table picker.
- Settings tabs scroll horizontally on narrow screens without widening the
  page beyond the viewport.
- Guest-count policy is configurable as required, optional, or off; table-open
  and checkout mutations validate it. Open table cards and the cart identify
  the table, guest count, section where applicable, and owner staff. Kitchen
  ticket preview includes the table, guests and staff. Legacy `DiningTable.zone`
  values migrate to `TableSection` records and `sectionId` under
  `7anouti.db.v24`.
- The “staff pick sections” setting is stored, and table ownership can be
  handed over between open shifts or assigned to the pool. Realtime multi-device
  handover still requires the pending browser scenarios.
- All of this remains browser-local demo behavior. It is not authoritative or
  tamper-resistant; production authorization, inventory and receipt numbering
  still require the Phase 2 backend described below.

### Phase 2 — Open table orders and station tickets ✅ browser-local demo implementation

- Dine-in tables can hold persistent open orders separate from completed sales.
  Cart items are debounced into the active order and persisted with the app's
  IndexedDB snapshot. Done sends pending station-routed lines and returns to the
  floor; cashier mode also offers Pay table, and Quick mode records unpaid
  table orders without payment. There are no separate Save items or Send to
  kitchen cart buttons.
- Settings → Stations manages station CRUD, icon/color, order and screen
  availability. Kitchen and Bar are the defaults. Product/category bulk
  assignment and business-template routing are supported; unassigned products
  are not sent to stations.
- Settings → Service chooses Done-or-idle, instant, delayed, or Done-only send
  policy. Items move through draft, sent, preparing, ready, served, and void.
  Draft lines can be edited; voiding a sent line requires a reason and the
  void-order permission, and produces a CANCELLED preview ticket.
- Pure station-ticket builders split by station and include table context,
  order number, modifiers and notes. Later sends are marked ADDITION. Kitchen
  and station routes provide New / Preparing / Ready boards, bump/recall,
  timers, new-ticket sound, Rush on reprint, and print-preview reprints. Access
  requires a staff PIN session with `viewStation`.
- Per-line IDs merge appended items across browser tabs; edits to the same line
  use the latest timestamp. Served status is persisted, and ready items owned
  by the current staff member appear in that staff member's notification list.
- Open orders do not change stock, sales, customer tabs, or register totals
  until payment. Register close and table deactivation/removal are blocked
  while an open order remains. Open-order actions are included in the
  browser-local activity log. Quick-mode table completion creates a `recorded`
  unpaid order snapshot for the Orders page; later rounds update that snapshot,
  while payment replaces it with the paid order and cancellation removes it.
- Database schema `7anouti.db.v30` normalizes stations, item statuses,
  ticket policy settings, product-level no-station overrides, and legacy open
  order numbers. This remains a browser-local workflow, not a production-safe
  multi-terminal queue; browser UI smoke did not verify real hardware printing
  or concurrent multi-device use.

### Requested feature phases 3–9 ⏳ partially implemented

Persistent restaurant open orders and pay-later floor workflow; returns and
labels; Tunisia VAT/fiscal compliance; ingredients and inventory; trusted
server-side activity and payroll history; loyalty/promotions/sharing; expanded
reports; and PWA/display/backup/polish remain planned work. Browser-local
payroll and attendance are implemented as a demo workflow, not an authoritative
wage or timekeeping system.

---

## 1. Audit summary (what the app is today)

| Area | State before this phase | Now |
| --- | --- | --- |
| Auth | Browser-local demo auth | Hub PBKDF2 auth and PIN lockout plus local checks; production identity/session management still needed |
| POS | Quick + cashier mode, customer attach, tabs, discounts | + auto/manual printing, kitchen tickets and persistent table orders |
| Orders | History, void (admin only) | + manager-PIN void authorization, reprint, `voidedByName` audit |
| Customers | Regulars cards, monthly settlements, staff read-only profiles | Unchanged |
| Reports | Daily/monthly charts, CSV export | + X/Z register reports (new page) |
| Register | **None** — no session concept | X report, Z close with counted cash + difference, immutable history |
| Activity log | Derived dashboard notices only | Append-only browser-local log, admin filters, details, CSV and pagination |
| Payroll | None | Browser-local attendance, salary estimates, advances, and monthly salary expenses |
| Printing | Browser print dialog only | + real ESC/POS over WebSerial (58/80 mm), test print, kitchen tickets |
| Inventory | Product stock counters only | Inventory movements, supplier purchases and low-stock automation; recipes/costing remain incomplete |
| Offline | None (browser-local demo DB) | Hub sync/outbox and PWA shell; cloud sync is unavailable |
| Multi-tenant | Frontend-only isolation by `storeId` filters | Unchanged (Phase 2 = real backend) |

Standalone data lives in IndexedDB under `7anouti.db.v30`, migrated from prior
IndexedDB/localStorage keys and legacy `cafepos.db.*` keys. Hub mode persists
store data in local JSONL files and uses IndexedDB as the client cache/outbox.
Standalone persistence and authorization remain demo-grade; the hub is a
shop-LAN server, not a cloud-hosted production database or payment service.

---

## 2. Phase status

### Phase 1 — Audit ✅ (this document)

### Phase 2 — Production backend, DB, multi-tenancy ⛔ partially implemented

The local Node hub provides authentication, store-scoped persistence and
validation for selected operations, but no production cloud API/PostgreSQL.
What remains:

- No production PostgreSQL schema/migrations or hosted API were written.
- The hub does not yet enforce every business invariant, including complete
  payment tender reconciliation, customer credit limits, inventory costing,
  and all register calculations. Some checks remain in the browser store layer.
- Client-side controls can be bypassed by a user who can alter IndexedDB,
  localStorage, or the running JavaScript. They are defense-in-depth for the
  demo, not production authorization or tamper-resistant audit history.

**Plan (next phase):** Node + Fastify (or NestJS) + PostgreSQL with row-level
tenancy (`store_id` on every row + RLS), JWT access tokens, server-side
password/PIN hashing (argon2id), rate limiting on login, audit log table,
server validation for all mutations, and authoritative register/inventory/
ledger state. The browser's PBKDF2 hashes and guards do not replace these.
The frontend's `AppStore` seam maps 1:1 onto REST endpoints.

### Phase 3 — Touch POS + ESC/POS printing ✅ implemented (see §4 for hardware)

- Receipt/kitchen/report **line models** (`src/lib/escpos.ts`) are rendered
  both as an on-screen monospace preview and as raw ESC/POS bytes by the shared
  renderer (`src/shared/escpos.ts`): selectable codepage, width, drawer kick and
  cut mode.
- **WebSerial bridge** (`src/lib/printer.ts`): user picks the port once
  (`requestPort`), port is silently re-opened on later visits (`getPorts`),
  read loop drains status bytes so ACK-printers don't stall, chunked writes with
  backpressure, busy-locking, disconnect handling.
- Shared **print dialog** (`src/components/PrintPreview.tsx`): preview exactly
  what prints; send to printer when connected, otherwise the browser print
  dialog as fallback. Used by POS receipts, kitchen tickets, Orders reprint,
  X/Z reports and the settings test print.
- Settings → Devices & printing manages printer entities, routing, copy/fallback
  settings, test jobs and automatic print policies; Receipt settings retain the
  legacy WebSerial connection controls for compatibility.
- POS: policy-controlled receipt printing, station ticket queueing when routed,
  and preview/manual printing when no route is configured.
- Orders: reprint with `*** REPRINT ***` marker.

### Phase 4 — X / Z cash register reports ✅ implemented

- `RegisterSession` model: unique id, store, status open/closed, opening cash,
  opener, closer, counted cash, difference, close note, sequential Z number,
  frozen financial snapshot, and frozen report details.
- Multiple staff can keep independent open sessions. Orders carry `paidById`;
  table payments, tab settlements, refunds, and cash expenses are attributed to
  the acting staff member's open session and time window. Opening float and
  counted cash (including float) are part of expected-cash calculation.
- Closing never requires closing tables: owned tables are handed to an open
  colleague or the existing `Unassigned (handover)` pool. Incoming staff can
  claim all or individual waiting tables; ownership changes are kept in table
  history, and managers can reassign or force-close with a reason.
- Cash differences beyond a per-store tolerance (default 0.000 DT) are retained
  as signed records. Authorized managers can settle, void with reason, archive,
  or restore records; salary deductions are recorded as payroll advances.
- Staff profile and Reports provide shift performance comparisons. Excellent
  means accuracy ≥98%, discounts ≤5%, voids ≤2%; Good means ≥90%, ≤10%, ≤5%;
  other results are Needs attention. Admin dashboard flags overlong shifts and
  open differences; thresholds and shift duration are configurable.
- Admin → Team supports search by name, username, or email, with role and
  active-status filters; existing edit, deactivate, and remove controls remain
  available on each matching profile.
- **X report**: a read-only interim snapshot; closing a staff shift saves its
  final X snapshot and ends only that shift. **Store-day Z**: only the owner
  can close it, and only after every shift is closed. It aggregates all staff
  shifts, freezes the daily totals once, rejects duplicate closes, and can be
  reprinted from its immutable day report record.
- Shift X uses the staff session window; day Z uses the local calendar-day
  window and includes orders and items from every staff shift. Cash drawer expectation
  includes cash received, cash tab settlements, expenses and cash refunds;
  card sales and card tab settlements are excluded from physical cash. Sales
  exclude orders voided by the report cutoff. Refund totals include only
  tracked cash refunds and store-credit adjustments; card refund processing
  is not recorded by the current POS. Tax detail is grouped by the tax rate
  saved on each new order; legacy orders without a saved rate show as
  unrecorded rather than being assigned a guessed rate.
- The shared thermal receipt preview supports 58 mm and 80 mm paper, ESC/POS
  via the existing WebSerial connection, browser printing, and direct PDF
  download. Z history opens the receipt preview rather than a dashboard-style
  summary. New open-table cancellations preserve their item names in the
  closing report; older cancellation logs may not contain item-level detail.
- X and Z receipts list every item sold, grouped by category, variant and
  price-changing modifier, with wrapped thermal lines and category subtotals.
  Quick-mode recorded orders are shown separately and do not enter sales or
  drawer totals. Voided items are a separate list with the authorizer. The
  live X view provides search, category/quantity sorting and CSV export; its
  item rows are staff-scoped unless the user is a supervisor or admin.
- Pre-existing per-session Z reports remain reprintable from their frozen
  session details; new staff shifts do not receive individual Z numbers.
  New store-day Z reports are retained separately and reprint from their frozen
  day details.
  legacy sessions without a recorded counted-cash value display it as
  unavailable instead of assuming zero.
- Existing closed sessions retain their frozen financial totals and historical
  Z numbers. New day reports receive sequential Z numbers. The v37 normalizer accepts
  old report details without item rows; those rows are rebuilt from session
  orders at view time and marked `Rebuilt from orders`, without rewriting the
  frozen totals.
- A closed session cannot be reopened or edited; a staff member cannot open a
  second session while their own shift is open, but colleagues may work
  concurrently.
- Void authorization: staff voids require a manager PIN (validated against the
  store's active admins inside the store layer); the void records
  `voidedById/Name/At`, restores tracked stock, and reverses the outstanding
  tab charge without making the balance negative. Any already-paid remainder is
  recorded as a flagged customer-credit ledger entry. Admin voids record the
  admin.
- Register permissions: `permissions.register` gates open/close/X/Z pages and
  actions (Amine/Karim have it; Salma/Hedi don't — demo lock states).

### Phase 5 — Inventory, recipes, suppliers ⏳ partially implemented

Product stock counters, inventory items/movements, supplier records, purchases,
stock counts, and low-stock alerts are implemented. Recipe-based ingredient
deduction on sale is available through the per-store Order rules setting.
Purchase invoices support attached images. Full ingredient valuation and
accounting integration remain unimplemented.

### Gérant and inventory rollout from the owner brief (2026-11-13)

#### Phase 1 — Manager role and capabilities ✅ demo implementation

- Added the store-scoped `manager` role, manager capability checks, per-manager
  capability toggles, PIN login, manager audit badges, and an owner-created
  demo manager. The default capability preset excludes settings, payroll, and
  role changes; owner/admin remains fully authorized.
- Product, staff, schedule, store-setting, report, payroll, and order-void
  routes and mutations now check the corresponding capability. Manager
  capability edits and team role changes remain owner-only.
- Schema `7anouti.db.v17` migrates v16 records with safe manager permission
  defaults. A browser smoke test created and signed into a manager, verified
  product access and settings denial, then removed the temporary test account.
- This remains browser-local demo authorization. A user who can alter
  IndexedDB or JavaScript can bypass these checks; production needs server-side
  authorization and audit history.

#### Phases 2–6 — Inventory, purchases, recipes, daily reporting, and staff use

Inventory items, stock movement actions, supplier/purchase workflows, stock
count/reporting, recipe deduction, and staff-consumption allowances are
implemented and validated by store-layer guards and hub order validation.
Bill images and standalone data remain browser-local; hub mode stores business
records locally on the hub machine.

### Phase 6 — Staff management hardening ⏳ partially blocked

Store-scoped access, granular permissions, PBKDF2 credential hashing,
username-based staff PIN login, and a 30-second lock after five failed
username attempts are implemented in the demo. The browser-local activity log
records relevant actions but is not tamper-resistant. Phase 2 must add
server-side hashing, authoritative rate limiting, session timeout, and a
trusted server-side audit log.

### Phase 7 — Offline-first ✅ hub mode implemented; cloud sync unavailable

Hub mode provides an IndexedDB mirror/outbox, stable operation IDs, retry,
snapshot reconciliation, conflict notices and a secure-context service-worker
shell. Cloud sync is an unavailable interface stub; cross-device flows remain
unverified.

### Phase 8 — PWA foundation ✅ · Phase 9 — Support/subscriptions ⏳ not started

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

- Historical v22 browser smoke verified migration from `7anouti.db.v21` and earlier keys,
  hashing legacy credentials and retaining
  2 closed Z sessions and concurrent open shifts for different staff; register nav visible for admin; staff without `register` permission
  redirected from `/admin/register`; staff with permission can access.
- The current `7anouti.db.v24` normalizer preserves frozen Z details while
  accepting old reports without item rows; legacy item detail is rebuilt only
  when viewed. Browser migration QA for v24 remains pending.
- An isolated fresh-origin browser smoke on the seeded v23 session verified
  the live X item table and 80 mm receipt preview (68 quantity across 21
  distinct items and four employees), the Z close dialog, saved `Z-000003`,
  history item detail and reprint. Reprinting left the three-session history
  unchanged. No real sales or the existing 5173-origin data were modified.
- X report is read-only and expected cash uses physical cash movements only;
  card sales are not added to the drawer.
- Z close: counted-cash modal shows live difference; closing freezes totals,
  detail, metadata and report number; duplicate close and reopening are
  rejected; reprinting opens the same receipt without another close.
- Receipt-preview scenarios still require manual verification on 58 mm and
  80 mm devices: screen preview, browser print, ESC/POS, PDF export, long
  reports, multiple employees, payment methods, cash variance and old Z
  reprints.
- Orders reprint shows `*** REPRINT ***`; staff void demands a manager PIN;
  wrong PIN rejected; correct PIN voids and records `voidedByName` (visible in
  the order drawer); tab charge reversal lands in the ledger.
- Settings: the legacy Receipt printer card keeps WebSerial connect/disconnect
  for compatibility; Devices & printing manages new printer records, routes,
  queue, and print policies.
- POS: checkout receipt modal follows the receipt policy; table station tickets
  use queued station routes when configured and retain a preview path when no
  route is configured. Browser/hardware dispatch is not equivalent to verified
  physical output.
- `npm run build` passes clean (tsc + vite).
- `npm run test:register-items` covers variant/modifier aggregation, weight
  precision, recorded orders, void timing, two-staff scoping, drawer-total
  exclusion, complete output and 58/80 mm line widths.
- Still unverified in browser: creating a fresh 12+ item sale across staff,
  Quick-mode recorded items, CSV download, 58 mm visual preview, browser print,
  PDF-reader rendering and physical ESC/POS output. The pure tests cover
  aggregation, long-name wrapping and 58/80 mm line widths.
- Latest source validation: `npm run build` and `npm run lint` both exit
  successfully. Vite reports the existing large-chunk warning; Oxlint reports
  warnings, including hook-dependency and purity warnings. Real browser print,
  PDF-reader rendering and physical ESC/POS output still require manual checks.
- M2 browser smoke loaded Settings → Devices & printing. Printer add/edit,
  route selection, queue actions and print dialog dispatch remain unverified
  because the browser automation stalled during click interaction.

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

Real thermal printer over WebSerial remains unverified without shop hardware.
Automated Node coverage includes app domain rules and hub APIs; the app UI and
three-phone flow remain unverified in Playwright.

---

## 5. Remaining limitations / next steps

1. A hosted production API/database, full authorization, and tamper-resistant
   audit history remain unimplemented; the LAN hub is not a cloud service.
2. Payment tender reconciliation, customer-credit enforcement, fiscal/tax
   compliance, and authoritative close-report accounting remain incomplete.
3. Inventory recipes, ingredient consumption and full cost valuation are not
   implemented.
4. Arabic receipts need a raster printing pipeline.
5. Cloud sync and the full three-phone POS/table/kitchen/shift flow are
   unverified or unavailable.
6. Printer, drawer-kick, automatic retry and physical reconnect behavior need
   real hardware testing; hub health is based on observed failed jobs.
7. Automated Node tests pass (40); UI-level Playwright verification remains
   unverified.
