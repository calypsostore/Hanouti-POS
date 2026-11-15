# Kitchen and bar station devices

Station screens can be a browser tablet, laptop, or desktop on the shop LAN.
With a hub, the hub is the shared source of orders and station status; do not
pair a separate browser to standalone mode and expect it to see another
device's local database.

## Set up stations and pair a screen

1. Start the hub and sign in as the store owner or a manager with
   `manageSettings`.
2. In Settings → Stations, confirm the Kitchen and Bar stations, then add a
   station-screen device. Give it a recognizable name and assign only the
   stations that device should see.
3. Generate a pairing code. It is six digits and expires after ten minutes.
   Treat it like a temporary credential; generate a new code if it is shown
   to the wrong person.
4. On the station tablet, open the shop hub's `/pair` page (or the app's
   station pairing link), enter the store code and pairing code, and submit.
   The hub consumes the code and stores only a hash of the device token.
5. The tablet enters kiosk mode and displays only its assigned active stations.
   Keep the browser open and the tablet connected to the same LAN. For PWA
   installation and reliable app-shell offline loading, use the hub's trusted
   HTTPS URL; see [HUB.md](./HUB.md).
6. To change scope or retire a tablet, disable or unpair it in Settings →
   Stations, then pair it again with a fresh code.

The app's `/status` page has a QR link to the hub. The app does not currently
generate a QR image for each pairing code; enter the expiring code manually.

## What the station device can do

- View only live, sent items for its assigned active screen stations.
- Advance valid item states through Preparing, Ready, Served, Bump and Recall.
- Receive live updates from the hub while connected.
- Reconnect using its paired device token without creating staff attendance.

Station-device credentials cannot submit general sync writes, open the POS, use
admin pages, access printer/backup settings, or verify staff PINs. Leaving
kiosk mode requires the configured owner/manager PIN. A Cook / Barista staff
account is separately permissioned with `viewStation` and is not a paired
device account.

When an item becomes Ready, the owning staff member sees the ready notification
in the app's top bar; the notification is not a hardware sounder or push
notification while the staff app is closed.

## Standalone mode limitation

Without a hub, station-device and order data live in that browser's local
IndexedDB. A second phone cannot share the first phone's tickets. Use a hub for
multiple devices; standalone station boards are for same-device/demo use.

## Troubleshooting

- **Invalid pairing code:** check the store code and expiry; codes expire after
  ten minutes and can be used once. Generate another code.
- **No station appears:** ensure the device is active and assigned to an active
  station with its screen enabled; then reconnect.
- **Other station tickets appear:** unpair the device, correct the assigned
  station list, and pair again. Contact the store owner if the mismatch
  persists.
- **Device is not syncing:** check its Hub/Local connection badge, the hub's
  `/health`, the shop Wi-Fi and the browser console. Use the same HTTPS
  certificate trust setup as the POS phone if using HTTPS.
- **PIN does not exit kiosk:** verify the active owner/manager account PIN and
  hub reachability. Repeated failed PIN checks are temporarily rate-limited.

See [SYNC.md](./SYNC.md) for offline behavior and
[PRINTING.md](./PRINTING.md) for the honest printer support matrix.
