# Browser QA checklist

Browser verification was performed against the local Vite app. Results below
distinguish completed checks from partial coverage; untested behavior is not
reported as passing.

## Evidence

| Scenario | Steps and expected behavior | Actual result | Console | Result |
| --- | --- | --- | --- | --- |
| S0 Login | Sign in as `sami@cafeteria` and as staff `amine.yasmine` / PIN `1234`; both accounts should reach their authorized screens. | Both logins completed in the same browser. | No errors or warnings observed during the captured interactions. | PASS |
| S1 Floor for staff | As admin, enable Tables and create five tables; log in as staff in the same browser; check sidebar/mobile navigation, dashboard, POS header and `/pos/floor`; place a table round in Quick mode and pay in Cashier mode. | Floor was visible to staff, `/pos/floor` listed the tables, and one table order completed in each mode. | No errors or warnings observed during the captured interactions. | PASS |
| S2 Old saved data | Load a store with existing tables and `features.tables` disabled; expect migration or admin action to reveal Floor. | The Settings warning and Enable action were verified. A controlled v20-to-v21 database fixture was not run, so migration behavior is not independently verified. | No errors or warnings observed during the captured interactions. | PARTIAL |
| S3 Edit staff | Admin edits name, username, PIN, salary, role and permissions, saves, and reloads; repeat with a manager with and without `manageStaff`. | Admin edit, validation feedback and reload persistence were verified. A manager with `manageStaff` opened Edit; a manager without it could not access Staff and was redirected from `/admin/staff`. Manager save/persistence was not tested. | No errors or warnings observed during the captured interactions. | PARTIAL |
| S4 Permission changes | Change permissions in the admin tab while the staff account is open in another tab; expect current navigation and routes to update without re-login. | Granting `recordPurchases` made Purchases appear in the staff tab and its route loaded without re-login. Other routes/buttons were not exhaustively checked. | No errors or warnings observed during the captured interactions. | PARTIAL |
| S5 Purchases | Admin records water, coffee and soft drinks with a receipt photo; staff with only `recordPurchases` edits and voids it; verify stock and expense totals. | Receipt purchase was recorded; staff edited and voided it. Inventory quantities and expense/register totals were not checked. | No errors or warnings observed during the captured interactions. | PARTIAL |
| S6 Lists | For Staff, Customers, Inventory, Products, Expenses, Orders, Purchases and Tables, exercise search, filter, add, edit and delete. | The full list-by-list interaction pass was not run. | Not exhaustively scanned. | NOT RUN |
| R1 Compact POS cart | At 1110 by 503, inspect a three-item cart; expect readable order rows and total/checkout controls without the footer obscuring the list. | With the note expanded, the 128 px footer kept checkout visible and all three rows fully visible in the 189.5 px order area. The customer attach control is compact. | No errors or warnings observed during the captured interactions. | PASS |

## Root causes and fixes

| Scenario | Root cause | Fix | Relevant files |
| --- | --- | --- | --- |
| S0 | No login failure reproduced; the browser completed database initialization and enabled sign-in. | No login-specific fix was required by this browser pass. | — |
| S1 | Table service is controlled independently from POS mode, and Floor exposure needed to be consistent for staff across navigation surfaces. | Exposed Floor when table service is enabled and retained the appropriate Quick/Cashier table-order flows. | `src/components/Sidebar.tsx`, `src/components/MobileNav.tsx`, `src/pages/admin/overview/StaffDashboard.tsx`, `src/pages/pos/POSHeader.tsx`, `src/pages/pos/TableFloor.tsx`, `src/store/openOrders.ts` |
| S2 | Legacy stores could have table records while the feature flag remained off. | Added the v21 migration and an admin warning with an Enable action. The migration fixture still needs direct verification. | `src/store/database.ts`, `src/pages/admin/Settings/RegisterTab.tsx`, `src/pages/admin/Settings/SettingsPage.tsx` |
| S3 | The Edit click bubbled into the staff row; save validation/failure feedback was not sufficiently visible. | Stopped event bubbling, added inline validation and surfaced save errors. Manager save behavior remains unverified. | `src/pages/admin/Staff.tsx` |
| S4 | Cross-tab data changes were not reflected in an already-open app session. | Added database change notification and refresh so permission-driven navigation updates without signing in again. | `src/store/runtime.ts`, `src/store/staff.ts`, `src/lib/permissions.ts`, `src/components/MobileNav.tsx` |
| S5 | Staff purchase recording needed an explicit permission path; downstream stock and expense reconciliation remains unverified. | Added `recordPurchases` support and verified receive/edit/void in the browser. | `src/lib/defaults.ts`, `src/lib/permissions.ts`, `src/store/purchases.ts`, `src/pages/admin/Purchases.tsx`, `src/pages/admin/purchases/` |
| S6 | Not assessed; the requested list-by-list interactions were not run. | No fix claimed. Run the full list interaction matrix before release. | — |
| R1 | The non-shrinking cart footer consumed most of the short panel, leaving the order scroller nearly collapsed. | Capped the footer at 8rem, made optional details scrollable, pinned total/checkout, and tightened the customer control and item rows. | `src/pages/pos/CartFooter.tsx`, `src/pages/pos/CartPanel.tsx`, `src/pages/pos/CartItemsList.tsx` |

## Remaining verification

- Run the v20-to-v21 migration using a controlled old-schema fixture.
- Verify manager staff edits persist, and check inventory/register totals after
  purchase edits and voids.
- Complete search/filter/add/edit/delete checks for each S6 list and capture
  console output during the full pass.
