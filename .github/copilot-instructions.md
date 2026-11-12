# Copilot instructions

Follow these repository rules for all future work.

## Architecture

- Pages belong in `src/pages/`; administrative and super-admin pages belong in
  `src/pages/admin/` and `src/pages/super/`. Place future POS page modules in
  `src/pages/pos/`.
- Reusable UI belongs in `src/components/`, domain logic in `src/lib/` as pure
  functions without React, application state in `src/store/`, shared types in
  `src/types/` (currently `src/types.ts`), and seed data in `src/data/`.
- Keep one primary responsibility per file and aim for no more than about 300
  lines. Split larger pages into folders with focused components, hooks, and
  helpers (for example, `src/pages/POS/index.tsx`, `Cart.tsx`,
  `PaymentModal.tsx`, and `hooks/`). Split new features into their own
  files/folders instead of growing `AppStore.tsx` or large pages.
- Name components in PascalCase, hooks `useX`, utilities in camelCase,
  constants in `UPPER_SNAKE_CASE`, and files after their main export.

## Data and business logic

- Route all money calculations through `round` and pure functions in
  `src/lib/`; do not put money arithmetic in components.
- Every store mutation must verify the logged-in actor, target store ownership,
  and required role/permission. Return a
  `Result` (`{ ok: true } | { ok: false, error: string }`) and never trust
  client-sent prices or entity IDs.
- For any database-shape change, bump `DB_KEY`, add a migration in `loadDb`,
  and update seed data.
- Keep TypeScript strict: do not use `any`, non-null assertions (`!`) without
  an explanatory comment, unused code, or commented-out code.

## UI and reliability

- Reuse `src/components/ui.tsx` and make UI work on phone and tablet sizes.
- Every asynchronous action must surface success or failure through a toast;
  do not silently ignore failures.
- Preserve register X/Z reports, tabs and credit, manager-PIN voids, and
  printing.
- Do not add dependencies without asking first.
- Keep changes small and scoped; do not refactor unrelated code as part of a
  feature task.

## Completion

- Before finishing, run `npm run build` and `npm run lint`, fix all errors, and
  list relevant manual test scenarios.
- Update `docs/PRODUCTION_PLAN.md` after each task to distinguish implemented
  behavior from what is still demo-only.
