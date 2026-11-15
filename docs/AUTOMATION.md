# Automation review

Reviewed POS, payment/receipt, open-table, register, printing, stock, settings,
orders, attendance and hub-backup flows. Effort: S = small, M = medium, L =
large. Risk: Low, Medium or High.

## Implemented safe automations

| Area | Finding / behavior | Effort | Risk | Status |
| --- | --- | ---: | ---: | --- |
| Payment receipt | Staff needed a policy-controlled receipt action; receipt policy is now per device (`auto` / `ask` / `never`) with the store policy as the first-use default. | S | Medium | Implemented |
| Cash drawer | Cash drawer kick can follow a cash receipt when both the store automation switch and routed printer setting allow it. | S | Medium | Implemented; hardware unverified |
| Receipt reprint | Finding the latest paid receipt required navigating order history. POS and app headers now offer a latest-receipt preview/reprint shortcut; reprints never kick the drawer. | S | Low | Implemented |
| Printer fallback | A primary transport failure needed a manual second choice. A setting now controls configured fallback attempts, and failed work is retried up to the configured primary-attempt limit. | M | Medium | Implemented; hardware unverified |
| Printer reconnect | Previously authorized WebSerial devices needed manual reconnects after a dropped connection. A setting now controls authorized-port reconnect polling without opening a chooser. | S | Medium | Implemented; browser/hardware dependent |
| Stock | Low/out-of-stock states were already derivable after sales; the bell and dashboard card now honor the automation switch, and POS can optionally hide unavailable products. | S | Low | Implemented |
| Shift timing | Staff had to notice missing/long-running shifts themselves. POS prompts for a required shift on item selection and shows an elapsed-shift reminder; close dialog warns about all open table orders. | S | Medium | Implemented; manual handover still required |
| Hub backup | Daily backups existed without an age check. A per-store readable-backup health endpoint and >48-hour/missing admin alert are added. | M | Medium | Implemented; restore must still be rehearsed |
| Automation controls | Policies were spread across receipt and device settings. A grouped Automation tab now owns each supported automation switch, thresholds, and the current device receipt policy. | M | Low | Implemented |

## Other manual steps found

| Area | Finding / decision | Effort | Risk | Status |
| --- | --- | ---: | ---: | --- |
| Open table edits | Open table changes already autosave, and Done sends pending station items. Adding another Save/Send button would duplicate actions and risk missed or duplicate tickets. | S | Medium | Already automatic; no change |
| Card payments | Staff must confirm the external terminal/bank action before the order is recorded. Automatic completion without a payment integration could create unpaid sales. | L | High | Keep manual |
| Customer tabs | Customer selection and tab confirmation remain explicit so credit is not attached to the wrong account. | S | High | Keep manual |
| Cash register | Opening float and closing cash are counts of physical money. Auto-filling or auto-closing would fabricate accounting evidence. | S | High | Keep manual |
| Table handover | Shifts/registers exist but there is no ownership-transfer flow. Closing warns; it does not silently reassign tables. | M | High | Not implemented; manual handover required |
| Product and purchase intake | Product/catalog changes and supplier invoice quantities/costs require human verification; guessing from prior data could corrupt prices or inventory valuation. | M | High | Keep manual |
| Attendance corrections | Clock-in/out is automatic on supported sign-in/out paths; corrections remain manager-reviewed because they affect payroll. | S | High | Keep manual |
| Restore/reset | Backup restore and demo reset remain explicit and confirmed because they replace or delete data. | S | High | Keep manual |
| Printer setup/routing | Device discovery, route selection and drawer protocol require a human to identify the physical device. | M | High | Keep manual |
| Browser print completion | The browser does not report whether paper printed after its dialog opened. The app cannot safely mark physical output complete or auto-retry that ambiguous outcome. | M | High | Keep manual verification |
| Hub offline detection | A device with no attempted jobs cannot be actively probed by the hub; health alerts begin only after an observed failed print. | M | Medium | Limitation documented |
| Settings save | Settings forms intentionally save together to avoid persisting partially edited fields. Auto-saving profile, tax or payroll changes could apply incomplete values. | M | Medium | Keep explicit Save |

## Verification notes

- Pure automation rules are covered by `tests/automation.test.mjs`, including
  inactivity thresholds, shift reminder timing, stock visibility, print retry
  bounds and backup age.
- Hub endpoint/backup health and print queue integration are exercised by
  `tests/hub.test.mjs`; hub PIN verification is authenticated and does not
  expose credential hashes in snapshots.
- Playwright UI interaction was attempted against a temporary local hub, but
  `/api/status` aborted, and sign-in clicks timed out before Settings could be
  reached. The Automation UI was not verified.
- Physical printer, drawer-kick, long-offline detection under real device
  failures, and restore rehearsal need shop hardware/operator verification.
