# Key project decisions

## Station routing

- Station assignment is optional on each category and product.
- A station is stored as a per-store entity with a stable `id`, default `sort`, and whether it exposes a station screen.
- Product and category editors now expose a station selector so a store can route menu items without a dedicated station-management page yet.
- The seed data includes default stations (Counter, Kitchen, Bar) for each demo store, and catalog rows inherit a station from the closest category default.
- Station IDs are validated against the current store before any catalog save or update is accepted.

## Preparation tickets

- The effective kitchen ticket feature is merged from legacy settings so older stores keep working even when only one legacy flag is set.
- The merged behavior is normalized centrally in `src/lib/defaults.ts` and enforced in POS save/send actions and print flows.
