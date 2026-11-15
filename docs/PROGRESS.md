# Progress

Validated in this session:
- `npm run build` passed
- `npm run lint` passed with warnings
- `node --experimental-strip-types --test tests/*.test.mjs` passed (17 tests)
- Browser smoke checked Settings → Stations, Settings → Service, and `/kitchen`

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
- [x] K5. Honest same-device limitation banner until a hub provider is connected.
- [x] K6. Pairing expiry, validation, station-scope tests, and docs.

## M2 Print architecture in the app
- [x] 11. Printer management, device-local print preference, per-type/station routing, station links, and test-print controls
- [x] 12. Persisted print jobs and the `enqueuePrint` path with Hub, WebSerial, Bluetooth-protocol stub, browser, and mock transports
- [x] 13. Shared ESC/POS renderer for 58/80 mm, codepage selection, drawer kick, cut modes, and rendering tests
- [x] 14. Print queue with status filters, retry, cancel, reprint, and failed-job badge
- [x] 15. Receipt auto/ask/never, station automatic/manual/never, and reports manual policies

## M3 Local hub (hub/ folder)
- [ ] 16. Hub HTTP app server, REST API, WebSocket, /status page
- [ ] 17. Local HTTPS certificate and install guidance
- [ ] 18. Persistent on-disk storage, per-store data, daily backups
- [ ] 19. Auth, session tokens, server-side permission checks
- [ ] 20. Sync protocol and docs/SYNC.md
- [ ] 21. Print server, drivers, LAN discovery, fallback, virtual printer
- [ ] 22. Station-screen WebSocket status updates and broadcast
- [ ] 23. Service/ops docs, logging, health, `hub doctor`
- [ ] 24. Security hardening, LAN bind, CORS, rate limits

## M4 Client sync and offline
- [ ] 25. `DataProvider` abstraction with LocalProvider and HubProvider
- [ ] 26. IndexedDB outbox and queue replay
- [ ] 27. Top-bar status indicator and printer health chips
- [ ] 28. Local print fallback when hub is unreachable
- [ ] 29. Reconnect full resync and idempotency checks
- [ ] 30. Cloud sync adapter stub
- [ ] 31. Service worker / PWA manifest setup

## M5 Everything automatic
- [ ] 32. Auto receipt after payment, drawer kick, fallback reprint
- [ ] 33. Auto-lock, PIN prompts, shift reminders
- [ ] 34. Low-stock alerts and optional out-of-stock hide
- [ ] 35. Auto printer reconnect, retry; daily hub backup; manual update docs
- [ ] 36. Additional automation review and docs/AUTOMATION.md

## M6 Tests and docs
- [ ] 37. Tests for change-set diffing, merge rules, station routing, ticket splitting, ESC/POS rendering
- [ ] 38. Full docs set: HUB.md, PRINTING.md, SYNC.md, DECISIONS.md, README, ARCHITECTURE, PRODUCTION_PLAN
- [ ] 39. Final scenario report: S1-S9 PASS/FAIL/UNVERIFIED

## Notes
- M1 is implemented as browser-local demo behavior; this does not complete the
  later M2-M6 roadmap.
- Browser smoke did not exercise table-order reload, multi-tab reconciliation,
  ticket lifecycle actions, or phone/tablet layouts end to end.
- Real-printer testing remains unverified on hardware.
- Multi-device synchronization is not implemented; BroadcastChannel only
  reconciles tabs within the same browser profile.
- M1b pairing, kiosk lock, and station-only staff access are browser-local demo
  behavior. QR generation and cross-device order delivery remain unimplemented.
- M1b validation: pairing/scope and station-only tests added; browser smoke loaded
  `/pair` and Settings. Full pairing, kiosk PIN exit, mobile/TV layouts, and
  multi-device delivery remain unverified.
- M2 uses browser-local IndexedDB queue state. Hub transports intentionally return
  “hub not connected” until M3; generic Bluetooth printer protocols are not
  configured. Browser smoke loaded Settings → Devices & printing, but printer
  submission/queue interaction did not complete reliably in the browser harness.
  Real printer output, drawer kick, codepage rendering and cut behavior are
  untested on hardware.
