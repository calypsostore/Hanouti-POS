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
- The app currently stores each shop's data in browser-local IndexedDB. Pairing on a different browser cannot discover or synchronize that database. Station-device screens therefore show a persistent same-device-only limitation until a future hub-backed provider is active.
- The pairing form is public, but kiosk mode locks other app routes and exits only after an active owner/manager PIN is verified. Pairing clears any existing staff login so kiosk sessions do not create staff attendance or shifts.
- The repository has no QR encoder. Because dependencies may not be added without approval, the settings page displays the store code and expiring pairing code and links to `/pair`; QR display is deferred rather than sending pairing data to a third-party QR service.
- Cook / Barista is a station-only staff permission preset, not a new account role. It can view station boards and advance items through Preparing, Ready, and Served; all POS and management capabilities are denied. Attendance is disabled by default and can be enabled by an owner in the staff editor.

## Printing architecture

- Printer configuration, routes and print jobs are store-scoped records. Print jobs persist as structured text lines before dispatch; transport errors remain visible in job history and the failed-print badge.
- All configured-printer sends use the store `enqueuePrint` action. A station-specific route takes precedence over its station printer link, then a generic type route; a station-only printer is never used as a receipt/report fallback.
- A configured fallback printer gets one attempt when the primary transport fails. Retry repeats a failed/queued job; reprint creates a separate job so its history is preserved.
- `browser-print` is considered dispatched when the browser print dialog is invoked; the browser does not report whether a user accepted or completed the physical print. Real paper output therefore remains a hardware check.
- Printer selection preference is device-local `localStorage` because the current business database is browser-local. The hub option intentionally fails until M3; cross-device queue delivery is not implemented.
- ESC/POS byte rendering is isolated in `src/shared/escpos.ts` for future hub reuse. Windows-1252, PC437, PC850 and PC858 are selectable; unsupported glyphs become `?`. Drawer kick and cut commands are configurable but require hardware verification.
- WebBluetooth is feature-detected at the transport boundary, but printer GATT protocols are vendor-specific and no generic device protocol is configured. Bluetooth printer setup remains hidden until a supported protocol is implemented.
