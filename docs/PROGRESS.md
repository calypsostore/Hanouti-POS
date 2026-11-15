# Progress

## Final audit validation

| Item | Status | Evidence / limitation |
| --- | --- | --- |
| 41. Tests and scripts | PASS | `npm run test:all`: 43 tests passed. `npm run hub:sim` was started against the real hub and loopback virtual printer; `/health` returned OK. |
| 42. Operational documentation | PASS | HUB, PRINTING, SYNC, STATIONS, AUTOMATION, README, ARCHITECTURE and PRODUCTION_PLAN updated. |
| 43. Playwright scenarios S1–S10 | UNVERIFIED | Playwright reached the hub UI, but did not complete the required multi-context scenarios after the browser client became unavailable. Automated unit/API coverage is listed per scenario below; it is not a substitute for the requested UI flow. |
| 44. API security / accessibility / responsive audit | UNVERIFIED | Hub API findings were fixed and integration-tested. Accessibility, contrast and 360/768/1280 px responsive review did not complete. |
| 45. Final report and deployment steps | PASS | Status tables and deployment steps are recorded below and in `docs/HUB.md`. |

Final validation: `npm run build` passed; `npm run lint` exited successfully
with existing warnings; `npm run test:all` passed all 43 tests. Vite still
reports the existing large-bundle warning. The browser-only checks below remain
unverified. Physical printers and drawer kick are **untested on hardware**.

## Scenarios requested in item 43

| Scenario | Status | Evidence / remaining check |
| --- | --- | --- |
| S1. Three phones, shared data within one second, permission filtering | UNVERIFIED | Permission-filtered API snapshots and live WebSocket sync are implemented; multi-context latency was not measured. |
| S2. Bar/Kitchen routing, Done, screens and printers; water omitted | UNVERIFIED | Pure routing/splitting tests pass; no complete browser-to-screen/print flow run. |
| S3. Later additions and sent-item void cancellation | UNVERIFIED | ADDITION/CANCELLED ticket builder tests pass; UI actions not exercised end to end. |
| S4. Printer failure, retries, failed list, reconnect and fallback | UNVERIFIED | Virtual TCP output and print queue integration are tested; the full unplug/reconnect/fallback UI flow was not run. |
| S5. WAN-offline, hub-offline local work and duplicate-free resync | UNVERIFIED | Idempotent replay tests pass; browser offline/hub restart sequence not run. |
| S6. Pairing code, station-only scope, POS/admin denial and Ready notice | UNVERIFIED | Pair expiry, API station scope and station-only permission tests pass; paired kiosk and owner notification UI were not run. |
| S7. Concurrent edits to one table | UNVERIFIED | Stable-line merge and simultaneous-open API tests pass; two-phone UI race not run. |
| S8. Reload cart recovery and PIN auto-lock | UNVERIFIED | Inactivity thresholds and cart-preserving lock are implemented; reload/lock browser sequence not run. |
| S9. Hub backup and restore | UNVERIFIED | Hub integration test exercises backup, health and restore APIs; Playwright UI flow not run. |
| S10. Register X/Z, tabs, PIN voids, purchases, permissions and floor visibility | UNVERIFIED | Existing feature tests/build pass; complete regression flow was not run in the browser. |

Real printer output, retries/fallback on physical devices, drawer kick and
phone-local WebSerial fallback are **untested on hardware**.

## M1 Automatic table orders and stations
- [x] 1. Station management — per-store Kitchen/Bar defaults; add, rename, icon/color, order, screen toggle, and safe deletion.
- [x] 2. Catalog routing — category/product routing, bulk assignment, template defaults, drink/food seed routes, and explicit no-station product overrides.
- [x] 3. Legacy preparation-ticket settings normalize safely; new station send policy is independent of receipt printing.
- [x] 4. POS cart has no Save items / Send to kitchen controls; table changes autosave and Done sends pending routed items.
- [x] 5. Send policy, per-item lifecycle states, draft editing, permissioned sent-item void with reason, and CANCELLED preview.
- [x] 6. Pure station ticket builder splits by station, formats ADDITION/CANCELLED/REPRINT, Rush, modifiers, notes and order context; tests added.
- [x] 7. Open-order edits target line IDs; IndexedDB/BroadcastChannel reconciliation merges appends and latest per-line edits.
- [x] 8. Open orders persist through the existing IndexedDB store, station items can be Served, and ready items notify their owner in TopBar.
- [x] 9. `/kitchen` and `/station/:stationId` boards include PIN-session permission gating, New/Preparing/Ready, timers, sound, bump/recall, filter and reprint.
- [x] 10. Migration, seed, docs, and tests for ticket splitting/routing

## M1b How kitchen and bar devices connect
- [x] K1. Station devices: create, rename, assign stations, pair code/expiry, disable, unpair, last seen; QR deferred without a dependency.
- [x] K2. Public pairing route and locked kiosk session, manager-PIN exit, wake lock/reconnect, and no kiosk attendance.
- [x] K3. Station navigation, waiting-ticket count, landing preference, and Cook / Barista station-only preset.
- [x] K4. Multi-station switcher, responsive touch board, connection badge, and empty states.
- [x] K5. Standalone boards show the same-device limitation; HubProvider hides it.
- [x] K6. Pairing expiry, validation, station-scope tests, and docs.

## M2 Print architecture in the app
- [x] 11. Printer management, device-local print preference, per-type/station routing, station links, and test-print controls
- [x] 12. Persisted print jobs and the `enqueuePrint` path with Hub, WebSerial, Bluetooth-protocol stub, browser, and mock transports
- [x] 13. Shared ESC/POS renderer for 58/80 mm, codepage selection, drawer kick, cut modes, and rendering tests
- [x] 14. Print queue with status filters, retry, cancel, reprint, and failed-job badge
- [x] 15. Receipt auto/ask/never, station automatic/manual/never, and reports manual policies

## M3 Local hub (hub/ folder)
- [x] 16. Hub HTTP(S) app server, REST API, WebSocket endpoint, `/status` page and QR link
- [x] 17. Optional local TLS certificate configuration and Android/iOS trust procedure
- [x] 18. Per-store fsynced JSONL persistence, 14 retained backups, daily/manual backup, restore and app-backup bootstrap
- [x] 19. Hashed login, persistent lockout, expiring sessions, scoped M1b device pairing and sensitive-operation guards
- [x] 20. Pure ID-based change-set diff/apply, idempotency, hub-order conflicts, merge-by-ID and `docs/SYNC.md`
- [x] 21. Durable ordered print queue, retries/fallback, raw TCP/OS/serial/ePOS/Star transports, LAN scan and virtual printer
- [x] 22. Station-scoped board snapshot plus persisted preparing/ready/served/bumped/recalled WebSocket broadcasts
- [x] 23. Windows/Linux/Raspberry Pi service docs, rotating logs, `/health`, and `hub doctor`
- [x] 24. Security hardening, private-LAN bind, CORS, rate limits, bounded/validated inputs, server-side order pricing/totals, and permission-scoped ledger writes

## M4 Client sync and offline
- [x] 25. `DataProvider` abstraction: LocalProvider remains standalone; HubProvider auto-detects same-origin hub hosting, owns hub login, and uses IndexedDB as the offline cache.
- [x] 26. IndexedDB outbox: ordered change sets and print jobs replay with backoff and stable idempotency keys; replay and print deduplication are covered by tests.
- [x] 27. Top-bar connection states, pending count, hub printer status chips, failed-print badge, and menu-conflict notice.
- [x] 28. A queued print can be sent over local WebSerial only before any hub attempt; otherwise the job stays queued with a no-duplicate warning. Physical output still needs hardware verification.
- [x] 29. Reconnect fetches the authoritative full snapshot and sequence; idempotent replay, distinct table lines, simultaneous table opening, and menu conflicts are tested. Same-line edits use newest timestamp.
- [x] 30. CloudSyncAdapter push/pull interface and explicit unavailable stub; existing JSON backup import/export remains.
- [x] 31. Service worker shell cache on secure contexts, PNG icon set, manifest, install prompt, offline fonts, and LAN HTTP/HTTPS requirements documented.
- [ ] 32. Three-phone Playwright flow: concurrent sign-in/table edits, live kitchen/bar delivery, shift handover, and ownership checks. Browser-context verification is still pending; physical printers need hardware.

## Automation delivery (user items 33–40)
- [x] 33. Receipt auto/ask/never per device, configurable cash drawer kick, primary-printer fallback/retries, and latest-receipt reprint shortcut. Physical output is unverified.
- [x] 34. Configurable inactivity lock and longer auto-logout. PIN is verified locally or by the authenticated hub; lock preserves cart/tables and does not clock out attendance.
- [x] 35. Required-shift prompt, elapsed-shift reminder, and open-table warning at shift close. Table ownership handover does not exist and remains manual.
- [x] 36. Dynamic low-stock dashboard/bell alerts after stock changes and optional POS out-of-stock filtering.
- [x] 37. Authorized WebSerial reconnect, bounded local/hub print retries, and hub printer-health alerts after an observed failed job. Physical behavior is unverified.
- [x] 38. Per-store hub backup health and >48-hour/missing dashboard alert, plus manual no-auto-update steps.
- [x] 39. Reviewed manual/duplicated steps, recorded findings with effort/risk in `docs/AUTOMATION.md`, and implemented safe small changes.
- [x] 40. Grouped Automation settings for Orders, Printing, Security, Stock, and Shifts, with Hub health controls.

## M6 final audit (user items 41–45)
- [x] 41. Added pure-function/API regression coverage and `npm run test:all`; added `npm run hub:sim`.
- [x] 42. Updated HUB, PRINTING, SYNC, STATIONS, AUTOMATION, README, ARCHITECTURE, and PRODUCTION_PLAN documentation.
- [ ] 43. Run Playwright S1–S10 across multiple phone contexts, a real hub, and virtual printer. Browser client became unavailable before the required flows could be completed; per-scenario evidence and limits are above.
- [ ] 44. Complete hub API security, accessibility, responsive and contrast audit. Hub findings were fixed and tested; accessibility/contrast and 360/768/1280 px checks remain unverified.
- [x] 45. Record item/scenario statuses, limitations, and deployment steps in this progress report and `docs/HUB.md`.

## Notes
- Standalone mode retains browser-local demo behavior; production readiness still
  depends on production payment/accounting services, full hardware validation,
  and the remaining unverified phone-flow scenarios.
- Browser smoke did not exercise table-order reload, multi-tab reconciliation,
  ticket lifecycle actions, or phone/tablet layouts end to end.
- Real-printer testing remains unverified on hardware.
- Standalone mode remains browser-local. Hub mode synchronizes through ordered
  change sets and full snapshots; phone-flow validation remains pending.
- Standalone M1b pairing, kiosk lock, and station-only access remain local;
  HubProvider uses hub-backed station pairing and ticket delivery. QR generation
  is deferred; the M4 full phone flow remains pending verification.
- M1b validation: pairing/scope and station-only tests added; browser smoke loaded
  `/pair` and Settings. Full pairing, kiosk PIN exit, mobile/TV layouts, and
  multi-device delivery remain unverified.
- M2 uses browser-local IndexedDB queue state in standalone mode; HubProvider
  now forwards hub jobs and keeps an IndexedDB outbox while the hub is offline.
  Generic Bluetooth printer protocols are not configured. Browser smoke loaded
  Settings → Devices & printing, but physical output remains a hardware check.
  Real printer output, drawer kick, codepage rendering and cut behavior are
  untested on hardware.
- M3 hub APIs and live station/printer queue broadcasts are implemented. The
  app auto-selects HubProvider when served by the hub; the three-phone POS,
  shift/handover, kitchen/bar live-delivery flow is not yet verified. Printer
  health is inferred from hub-observed print outcomes, not an active physical
  device probe. Real printer transports are untested on hardware.
- Items 33–40 were implemented; the current full suite passes 43 Node tests,
  successful build and lint (existing warnings only). Browser UI scenarios and
  real printer/drawer operations remain unverified; see `docs/AUTOMATION.md`.
- Added per-staff shifts, payer attribution, table handover, cash differences,
  staff performance, dashboard alerts, and payroll deductions.
- Database v31 migrates legacy session float and payer fields; one demo
  unassigned handover table is seeded.
- Browser scenarios remain UNVERIFIED; build, lint, and all 47 Node tests pass.

## Availability (86)
- Added shared 86 evaluation, migration/defaults, local and hub order rejection, POS indicators/list, product editor inventory links, and audited manual actions.
- Added availability settings, `manage86` permissions, Products filtering and bulk controls, and focused availability tests.
- Browser flow and multi-device notification behavior are UNVERIFIED.
- Hub rejects newly added unavailable items and over-quantity tracked stock; existing sent items remain accepted.
- Local-day/first-shift resets, persisted timed/restock returns, and per-item audit entries are implemented.
- Availability bell notices and station-board 86 counts are implemented with configurable settings; browser flow remains UNVERIFIED.
