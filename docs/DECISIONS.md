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
