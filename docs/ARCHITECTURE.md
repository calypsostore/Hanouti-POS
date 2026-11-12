# Kawa POS architecture

## Folder map

- `src/pages/` contains route-level screens. `admin/` and `super/` hold their
  respective routes. The POS route stays compatible through
  `src/pages/POS.tsx` and is implemented in `src/pages/pos/`.
- Large page features keep their implementation beside a small route-facing
  entry file. Current examples include `src/pages/admin/customers/`,
  `orders/`, `Products/`, `Settings/`, `reports/`, and `register/`.
- `src/components/` contains UI shared across pages. Reuse
  `src/components/ui.tsx` for common controls.
- `src/lib/` contains reusable domain helpers and pure business calculations.
  Keep React and UI dependencies out of this layer.
- `src/store/AppStore.tsx` composes the provider and exports `useApp()`.
  Feature slices live in `src/store/` (`auth`, `orders`, `register`,
  `catalog`, `customers`, `staff`, and `settings`). `runtime.ts` owns shared
  database state and actor guards; `database.ts` owns local database loading,
  normalization, and migrations.
- Shared application types are in `src/types.ts`; slice contracts are in
  `src/store/types.ts` and `src/store/sliceTypes.ts`. Seed data belongs in
  `src/data/`.
- This is a localStorage demo application. The browser store is not a trusted
  backend or production security boundary.

## Adding a page

1. Add a route component under `src/pages/`; group feature-specific
   components, hooks, and helpers in a neighboring folder when the page grows.
2. Use shared controls from `src/components/ui.tsx`, keep domain calculations
   in pure `src/lib/` helpers, and report action results through the toast UI.
3. Register the route in `src/App.tsx` with the appropriate authentication and
   role gates. Add navigation in `src/components/Layout.tsx` when applicable.
4. Check phone and tablet layouts and manually exercise the route.

## Adding a store action

1. Put the action in the slice that owns the domain. Use the latest database
   reference and existing actor/admin guards; verify actor, store ownership,
   and permissions before changing state.
2. Return the shared `Result` shape for success or a user-readable error.
   Never trust client-provided prices or entity ownership.
3. Add the action to `src/store/types.ts`, return it from the slice hook, and
   compose it in `src/store/AppStore.tsx`. Keep the public `useApp()` API
   consistent with its existing callers.
4. Handle failures at the UI call site and show a toast; do not silently
   discard a failed result.

## Adding a database field

1. Update the domain type in `src/types.ts` and seed records in
   `src/data/seed.ts`.
2. Bump `DB_KEY` in `src/store/database.ts` and add a migration/normalization
   path in `loadDb` so existing localStorage data remains readable.
3. Preserve frozen register snapshots and other historical records where
   applicable. Update `docs/PRODUCTION_PLAN.md` with what is implemented and
   what remains demo-only.
4. Run `npm run build` and `npm run lint`, then manually test both fresh seed
   data and data migrated from the previous key.
