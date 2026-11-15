# Progress

Validated in this session:
- `npm run build` passed
- `npm run lint` passed (with existing repo warnings only)
- `node --experimental-strip-types --test tests/register-items.test.mjs tests/table-service.test.mjs` passed
- Kitchen-prep legacy flag merge and UI guard were implemented for the POS flow

## M1 Automatic table orders and stations
- [x] 1. Station entity defaults and admin flow — seeded store stations and product/category assignment flow are now in place.
- [x] 2. `stationId` on categories and products with bulk assign and business-template defaults — station assignment is supported in the catalog model, seed data, and admin editors.
- [x] 3. One setting "Preparation tickets" merged from legacy kitchen flags; migration guard added in `src/store/database.ts`
- [x] 4. Remove manual save/send buttons when kitchen prep is off; open-order flow gated in POS UI
- [ ] 5. Auto-send policy, item statuses, and void-sent-item flow
- [ ] 6. Ticket builder and splitting logic with ADDITION/CANCELLED logic
- [ ] 7. Merge-safe edits by item id and add-by-id semantics
- [ ] 8. IndexedDB persistence, served action, Ready notifications
- [ ] 9. Kitchen/Bar display page and station-screen auth
- [ ] 10. Migration, seed, docs, tests for ticket splitting/routing

## M2 Print architecture in the app
- [ ] 11. Printer entity and device settings page
- [ ] 12. `PrintJob` + `enqueuePrint(job)` transport abstraction
- [ ] 13. Shared ESC/POS rendering and printer features
- [ ] 14. Print queue UI and failed-job badge
- [ ] 15. Auto print policies per store

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
- The repository is not yet at full M1-M6 completion.
- The previously implemented kitchen-prep guard is the only area validated here.
- Any real-printer testing remains untested on hardware.
- Browser-based Playwright multi-context verification for the larger ticketing and hub scenarios is still unverified in this session.
