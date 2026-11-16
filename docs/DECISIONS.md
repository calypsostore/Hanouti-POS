# Key project decisions

## Station routing

- Station assignment is optional on each category and product.
- A station is stored as a per-store entity with a stable `id`, default `sort`, and whether it exposes a station screen.
- Settings → Stations manages station names, icons, colors, ordering, screen availability, and deletion. Deletion is blocked while any product or category still references the station.
- Each store starts with Kitchen and Bar. Catalog routing defaults drinks to Bar, food to Kitchen, and bottled water to no station; business templates use the same category defaults.
- An omitted product `stationId` inherits its category route. `stationId: null` explicitly opts out of category routing, so bulk assignment to “No station” is effective.
- Station IDs are validated against the current store before any catalog save or update is accepted.

## Preparation tickets

- The effective kitchen ticket feature is merged from legacy settings so older stores keep working even when only one legacy flag is set.
- The merged behavior is normalized centrally in `src/lib/defaults.ts` and enforced in POS save/send actions and print flows.
- Table-order station sending is controlled by the separate `ticketSendPolicy`; disabling legacy kitchen receipt printing does not disable open-order autosave or station routing.
- The legacy post-sale Kitchen action is hidden for table-order snapshots with item lifecycle metadata, preventing duplicate station tickets and bypasses for unassigned lines.
- Station tickets are grouped by station and go through the existing print-preview flow. Later sends are marked `ADDITION`, sent-item voids create `CANCELLED` tickets, and station reprints may carry an optional Rush flag.
- Open-order items use unique line IDs. Cross-tab merges append distinct lines and resolve edits to the same line by the newest item timestamp rather than replacing the full order.
- Station-board access requires an authenticated staff PIN account with `viewStation`. Ready notifications are derived from persisted ready items and shown to the open order's owner staff member.

## Station devices

- Pairing codes are six digits and expire after ten minutes. Pairing is rate-limited per store code; a paired device receives a random token stored as a PBKDF2 hash in the local database, while the raw token stays in that browser's local storage.
- Standalone mode stores each shop's data in browser-local IndexedDB, so pairing on another browser cannot discover that database. HubProvider uses the hub-backed pairing and station APIs; the same-device-only warning is hidden in hub mode.
- The pairing form is public, but kiosk mode locks other app routes and exits only after an active owner/manager PIN is verified. Pairing clears any existing staff login so kiosk sessions do not create staff attendance or shifts.
- The repository has no QR encoder. Because dependencies may not be added without approval, the settings page displays the store code and expiring pairing code and links to `/pair`; QR display is deferred rather than sending pairing data to a third-party QR service.
- Cook / Barista is a station-only staff permission preset, not a new account role. It can view station boards and advance items through Preparing, Ready, and Served; all POS and management capabilities are denied. Attendance is disabled by default and can be enabled by an owner in the staff editor.

## Printing architecture

- Printer configuration, routes and print jobs are store-scoped records. Print jobs persist as structured text lines before dispatch; transport errors remain visible in job history and the failed-print badge.
- All configured-printer sends use the store `enqueuePrint` action. A station-specific route takes precedence over its station printer link, then a generic type route; a station-only printer is never used as a receipt/report fallback.
- A configured fallback printer gets one attempt when the primary transport fails. Retry repeats a failed/queued job; reprint creates a separate job so its history is preserved.
- `browser-print` is considered dispatched when the browser print dialog is invoked; the browser does not report whether a user accepted or completed the physical print. Real paper output therefore remains a hardware check.
- Printer selection preference remains device-local `localStorage`. HubProvider forwards print jobs to the hub and queues them offline; standalone mode keeps its local queue. Bluetooth remains a vendor-specific stub.
- ESC/POS byte rendering is isolated in `src/shared/escpos.ts` for future hub reuse. Windows-1252, PC437, PC850 and PC858 are selectable; unsupported glyphs become `?`. Drawer kick and cut commands are configurable but require hardware verification.
- WebBluetooth is feature-detected at the transport boundary, but printer GATT protocols are vendor-specific and no generic device protocol is configured. Bluetooth printer setup remains hidden until a supported protocol is implemented.

## Local shop hub

- The hub is a separate Node 22+ TypeScript package with zero third-party runtime dependencies. It reuses the app's pure sync and ESC/POS modules and uses Node built-ins for HTTP(S), WebSocket framing, crypto, storage, and printer I/O.
- The default hub address is a private RFC1918 LAN IPv4 address, falling back to loopback only when none is available. It binds that address rather than all interfaces. `HUB_HOST` is an explicit override.
- Per-store transaction snapshots are appended and fsynced as JSONL. A torn final record is ignored when the previous complete record is intact. Daily/manual snapshots are atomic JSON backup files, retained to 14. This avoids dependence on Node's changing `node:sqlite` availability.
- Sessions use app-compatible PBKDF2 hashes and random 12-hour bearer tokens; lockout is persisted to disk. Station device pairing validates M1b code, expiry and active station scope and stores only a hashed device token.
- Change sets use hub-arrival order for last-writer-wins conflicts, with ID merges for `orderItems`/`payments`; duplicate `opId`s do not reapply. A stale base sequence is accepted and resolved by that policy.
- Local HTTPS uses an operator-generated self-signed certificate. It is optional because the phones must explicitly trust it; there is no automated certificate issuer or internet dependency.
- The hub API enforces store ownership and permissions for staff, settings, stock, purchases, payroll, voids, shift close/open, stations, order pricing/totals and ledger writes. Ledger entries are append-only. Payment tender reconciliation, customer credit limits, and authoritative close-report arithmetic remain out of scope; the browser UI is not connected to the hub.
- Epson ePOS-Print and Star WebPRNT send structured printer markup; CloudPRNT uses a token-protected hub pull endpoint. Printer protocol behavior and physical output are untested on hardware.

## Client sync and offline operation

- Hub status lives under Settings → Connection & logs, not in the application
  header. The panel shows connection/session state, device and sequence details,
  outbox/print health, and up to 50 device-local activity events. These logs
  are device-local troubleshooting history, not the hub's server logs.
- The app selects HubProvider only when same-origin `/api/status` responds; a
  standalone Vite/static build keeps LocalProvider. Hub mode treats IndexedDB
  as its offline cache and stores ordered change sets and print jobs in an
  IndexedDB outbox.
- Hub sync uses a full authoritative snapshot carrying a monotonically
  increasing sequence. Authenticated WebSocket change events trigger immediate
  snapshot refresh; a 2.5-second poll repairs missed notifications. The client
  records the last sequence but there is no incremental change-log download
  endpoint yet.
- Outbox records keep stable operation IDs. A replay is removed only after a
  successful hub response; retry delay is exponential and capped. Print
  idempotency keys prevent a response-lost retry from creating a second hub job.
- Concurrent open orders for one table coalesce by stable item line ID into the
  existing hub order, preserving its number, staff owner and shift. Separate
  line additions survive; the newest edit to the same line wins by timestamp.
  Product/category writes from another device create a review notice because
  they may require a human decision.
- Deleted open-order documents do not yet have tombstones, so a stale offline
  edit can resurrect an order; avoid deleting an order while another phone is
  offline. Item voids are retained as explicit lifecycle status instead.
- Local print fallback is offered only for a queued WebSerial job with no hub
  attempt. If a request may have reached the hub but its response was lost,
  fallback is blocked to avoid duplicate paper output. Bluetooth remains
  vendor-specific and is not offered.
- Printer chips reflect hub-observed job outcomes, not an active device health
  probe. WAN-offline indication uses `navigator.onLine` while checking hub
  reachability separately; this browser signal is not a guaranteed WAN probe.
- The service worker caches the app shell only on secure contexts. Plain HTTP
  on a LAN IP still runs the live POS but cannot install the service worker or
  provide offline app-shell loading; hub HTTPS requires the operator-managed
  trusted certificate described in `docs/HUB.md`.
- CloudSyncAdapter is intentionally an unavailable interface stub. The hub
  remains the only sync authority; JSON backup export/import stays supported.

## Hub security review

- Hub review found same-store schedule/register records exposed or writable
  without sufficient actor ownership/capability checks. Schedule writes now
  require manager/staff-supervisor permission; register sessions are owner- and
  capability-checked, closing data is immutable, and deletion is denied.
- Permission-filtered snapshots still include the authenticated store's own
  settings document because the POS requires it to normalize its data shape.
  Other collections remain filtered by capability.
- The unauthenticated virtual-printer capture preview was removed; diagnostics
  keep captured bytes local to the hub data directory.

## M5 automation

- Store automation options are normalized in schema v30. Existing receipt
  auto/ask/never remains the fallback policy; an explicit receipt policy
  override is stored per device and per store in localStorage. Printer-route
  preference remains separately device-local.
- Inactivity lock is an app overlay and keeps the mounted POS cart/table state
  intact. Local mode verifies the current account's saved PIN locally; hub mode
  verifies it through the authenticated hub because credential hashes are never
  synchronized to clients. Neither path calls logout or attendance clock-out.
  Local accounts without a PIN skip the lock; the longer inactivity logout
  remains independent.
- Low-stock alerts are derived from persisted product stock after sales, not
  stored as a second notification ledger. The dashboard and bell therefore
  reflect the latest stock and do not need duplicate alert records.
- Automatic printer retries use bounded configured attempts in both local and
  hub queues. A retry can duplicate paper if a device accepted a job but its
  transport reported failure; retain visible print history and verify physical
  output before relying on unattended printing. Fallback, authorized-port
  reconnect, retries and offline alerts have separate Automation switches.
- Printer offline duration is measured from the first hub-observed failed job.
  The hub has no active physical probe, so an idle printer with no failed job
  cannot reliably be declared offline. Dashboard alerts are for hub mode.
- Backup health is checked per store against the newest retained backup
  snapshot containing that store. Invalid metadata fails the health request
  visibly. This verifies backup metadata, not restore integrity; operators
  must periodically test restore. Hub updates remain a manual operator
  procedure, never an auto-update.
- Register shifts exist, but there is no table-ownership handover workflow.
  Closing a shift warns about open table orders and leaves ownership unchanged;
  operators must hand them over before closing.

## Unified order rules

- The shared `src/shared/orderRules.ts` engine is the single source for app and
  hub line validation. A configured linked inventory item represents one base
  unit per sold unit; explicit product/variant/modifier recipes take precedence
  when ingredient deduction is enabled.
- Warn mode requires an authorized stock override; block mode never prompts,
  and allow mode stays silent. The app records the confirmer and requested/
  available amounts; hub sync rejects missing or invalid confirmations.
- Open-order prices default to the saved snapshot. Current-price is an explicit
  resolution in review; Ask keeps the saved amount until the operator changes
  it. Sent lines are not changed automatically.
- The hub assigns sequential store numbers when it applies a new order. Offline
  clients retain a device-prefixed provisional display label until the next
  authoritative snapshot.
- Recipe quantities are inventory base units per sold unit. Ingredient
  availability is the minimum producible quantity across the selected recipe;
  this project does not convert between inventory units automatically.
- Order-rule browser flows and concurrent-phone payment races remain
  unverified; see `docs/AUDIT.md` and `docs/PRODUCTION_PLAN.md`.
- Hub snapshots intentionally omit password and PIN hashes. Admins set/reset
  their own 4–12 digit authorization PIN in Admin → Team; it reuses the existing
  admin `User.pin` credential, so PIN-based sign-in changes at the same time.
- Purpose-scoped hub PIN checks search only active, same-store users authorized
  for that action and return only the confirmer ID/name. Failed checks share a
  persistent five-failure/15-minute lockout; hashes remain server-side.
- Standalone mode checks saved local hashes. Hub-mode authorization fails closed
  while disconnected rather than restoring credential hashes to phone caches.
