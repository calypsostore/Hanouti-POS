# Mutation audit

Status: store entry points validate inputs and permissions; orders/open orders
also run the shared rules engine before persistence and again at payment. The
hub applies the same order engine to synced order documents.

| Entry point | Store validation | Hub validation |
| --- | --- | --- |
| `createOrder` / quick checkout | Shared line rules, credit, discount, stock override | Shared line rules, credit, discount, numbering, idempotency |
| `addItemsToOpenOrder` | Shared line rules, ownership, discount permission | Shared line rules, stable line IDs, store scope |
| `changeQty` / `setLineQty` | Whole/weight quantity and shared line rules | Shared order validation on sync |
| Barcode / options modal | Resolves catalogue IDs/options, then validates the cart | Catalogue IDs/options resolved again on sync |
| `recordOpenOrder` | Shared rules, role, shift and table validation | Shared order validation on sync |
| `payOpenOrder` | Revalidates, excludes its own reservation, idempotent key | Revalidates and deduplicates checkout IDs |
| Discounts / tab payment | Shared discount and credit-limit rules; credit permission | Shared discount/credit-limit rules and credit capability |
| `voidOrder` / sent-item void | Void permission/PIN, reason, stock and ledger restoration | Void capability and scoped document validation |
| Purchases / stock adjustments | Store role, quantity bounds and movement audit | Store ownership and capability checks on synced records |
| Returns | No separate return workflow exists | Not applicable |
| Shift close | Register ownership, cash/shift checks, open-table warning | Close capability, owner and immutable-close checks |

Findings fixed: duplicated cart/open-order line rules now route through the
shared engine; reservations include other unpaid tables and current cart lines;
payment rechecks stale lines; prices are server-resolved; repeated checkout IDs
do not create a second order document; hub-assigned numbers are unique.

Remaining limits: purchase/stock ledger updates are not an atomic hub stock
transaction with order payment, and browser-driven concurrent-phone checkout,
PIN override, recipe editor, and responsive flows are **UNVERIFIED**. Real
printer output remains untested on hardware.
