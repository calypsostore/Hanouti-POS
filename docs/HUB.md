# 7anouti shop hub

The hub is a separate Node.js 22.13+ TypeScript package in `hub/`. It serves the
compiled `dist/` app, REST endpoints, and `/ws` from a machine on the shop LAN.
It has no npm runtime dependencies; it uses Node built-ins and reuses the app's
shared sync and ESC/POS modules. Start it from the repository root:

```powershell
npm run build
npm run hub
```

```sh
npm run build
npm run hub
```

The default port is 8080. `HUB_PORT`, `HUB_HOST`, `HUB_DIST_DIR`, and
`HUB_DATA_DIR` configure the port, bind address, built app, and data directory.
The default bind is a private RFC1918 LAN IPv4 address (loopback only if none
is found); do not expose this service to the public internet. Open
`http://<hub-lan-ip>:8080/status` for the app link, QR code, connected-device
counts, printers, and queue status. `/health` is the readiness endpoint.
The hub serves a touch-first paired-device board at `/kitchen` and
`/station/<stationId>`; it validates the M1b code, limits each board to its
assigned active stations, and receives status updates over `/ws`.

## Install and first run

Install Node.js 22.13 or newer, place the project on a local disk, then install
dependencies and build once:

```powershell
cd C:\7anouti
npm ci
npm run build
npm run hub:sim
```

```sh
cd /opt/7anouti
npm ci
npm run build
npm run hub:sim
```

`hub:sim` starts the real HTTP/WebSocket hub and its loopback virtual TCP
printer (port 9101 by default). `npm run hub` also starts the virtual printer
unless that port is already in use. The simulator is for development and
acceptance checks, not a physical printer.

On Windows, run `ipconfig` and use the IPv4 address of the shop's connected
Ethernet/Wi-Fi adapter, not a VPN or virtual adapter. On Linux or Raspberry Pi,
run `hostname -I` or `ip -4 addr show` and choose the address on the shop LAN.
Open `http://<hub-lan-ip>:8080/status` from a shop device. Reserve the address
in the router's DHCP settings so it does not change unexpectedly.

For a fresh hub, create the first owner through the API. The current app does
not include a frontend form for these bootstrap endpoints. When the empty hub
starts, copy the one-time setup
token printed in the hub console. Keep it private; it is not shown in the app
or returned by an API. There are no default credentials:

```powershell
$body = @{ storeName = 'Cafe Yasmine'; storeCode = 'cafe-yasmine'; username = 'owner'; password = 'use-a-unique-long-password'; pin = '482915' } | ConvertTo-Json
$headers = @{ 'X-Setup-Token' = 'paste-the-token-from-the-hub-console' }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8080/api/auth/setup -Headers $headers -ContentType 'application/json' -Body $body
```

```sh
curl -X POST http://127.0.0.1:8080/api/auth/setup \
  -H 'X-Setup-Token: paste-the-token-from-the-hub-console' \
  -H 'Content-Type: application/json' \
  -d '{"storeName":"Cafe Yasmine","storeCode":"cafe-yasmine","username":"owner","password":"use-a-unique-long-password","pin":"482915"}'
```

Use a unique password and keep the PIN private. Setup is accepted only while
the hub has no stores. Sign in at `/login`, finish store setup, add staff and
stations, and create a backup before using live transactions.

## First run and importing data

The first owner is created with `POST /api/auth/setup`; there are no default
credentials. Send `storeName`, a lowercase `storeCode`, `username`, a
10-character-or-longer `password`, a 4–12 digit `pin`, and the one-time
`X-Setup-Token` header. The token is printed when an empty hub starts, expires
after the first successful owner setup or backup import, and failed attempts
are rate-limited. Setup is available only while the hub has no stores. The API
returns a 12-hour bearer session.

An existing app backup may bootstrap an empty hub using
`POST /api/setup/import-backup` with `{ "backup": <backup-json> }` and the same
`X-Setup-Token` header, or from the hub machine:

```powershell
npm run hub -- import-backup C:\backups\7anouti-backup.json
```

```sh
npm run hub -- import-backup /backups/7anouti-backup.json
```

Imported credentials must already be app PBKDF2 hashes. Use the existing owner
username and password/PIN to sign in.

## HTTPS for shop devices

HTTP works for the POS itself, but browser service workers and PWA installation
require a secure context. On an offline shop machine with OpenSSL, generate a
local certificate (replace the LAN address with the address shown on `/status`):

```sh
openssl req -x509 -newkey rsa:3072 -nodes -days 825 \
  -keyout hub-local.key -out hub-local.crt \
  -subj "/CN=7anouti shop hub" \
  -addext "subjectAltName=IP:192.168.1.20,DNS:localhost" \
  -addext "basicConstraints=critical,CA:TRUE"
```

Set `HUB_TLS_KEY` and `HUB_TLS_CERT` to those files and restart. Keep the private
key readable only by the hub service account. For Android, copy the certificate
to the phone, install it under **Settings → Security → Encryption & credentials
→ Install a certificate → CA certificate**, and approve the user-CA warning.
For iPhone/iPad, install the certificate profile, then enable it under
**Settings → General → About → Certificate Trust Settings**. Re-open
`https://<hub-lan-ip>:8080` after trust is installed. OS menu labels vary by
version. The self-signed certificate is not trusted automatically.

The deployed Vercel HTTPS site cannot call an `http://` shop hub: browsers block
that mixed-content request. In-shop phones/tablets should open the hub address
itself. The app auto-selects HubProvider when served by the hub; its service
worker is registered only in a secure context. Plain HTTP on a LAN IP supports
online POS and hub sync but not offline app-shell loading or PWA installation.
Use the trusted local HTTPS option above for those features. Loopback
development addresses are treated as secure contexts by browsers.

## Firewall

Allow the hub's selected TCP port (8080 by default) only from the shop subnet;
do not enable internet-facing port forwarding. Replace `192.168.1.0/24` with
the actual LAN range and use a narrower range if available.

Windows PowerShell, run as Administrator:

```powershell
New-NetFirewallRule -DisplayName '7anouti Hub (shop LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -RemoteAddress LocalSubnet
```

Linux or Raspberry Pi with UFW:

```sh
sudo ufw allow from 192.168.1.0/24 to any port 8080 proto tcp
sudo ufw status
```

For another firewall manager, create the equivalent inbound TCP rule. HTTPS
uses the same port unless `HUB_PORT` is changed. The virtual printer listens
on loopback only and must not be opened on the shop network.

## API and server-side enforcement

- `POST /api/auth/login` authenticates store code + username/email + password or
  PIN, enforces persistent five-failure/15-minute lockout, and returns a random
  bearer token with 12-hour expiry. Logout revokes it; a hub restart revokes
  active sessions. `POST /api/auth/verify-pin` verifies the active account's
  lock-screen PIN without returning credential hashes; five failed checks lock
  PIN verification for 15 minutes.
- `POST /api/station/pair` validates a current, unused M1b six-digit code,
  expiry, active device and active screen stations, then issues a random token
  stored as a PBKDF2 hash. Device API/WebSocket sessions are store- and
  station-scoped.
- `/api/sync` and WebSocket `sync` validate every document's store ID, change
  set bounds and idempotency key. Server checks cover staff, settings,
  inventory/stock, purchases, payroll, voids, shift open/close, and store
  ownership. Station devices cannot submit general sync writes.
- `GET /api/sync/snapshot` returns the full authenticated store snapshot and
  sequence. Clients replay their outbox first, then apply this authoritative
  snapshot; incremental change-log download is not currently exposed. The
  snapshot always includes that store's own store/settings document so every
  authorized POS client can normalize and use its workspace; other collections
  remain permission-filtered and all writes remain capability-checked.
- `/api/station/status` and WebSocket `station-status` enforce `viewStation`,
  station assignment and valid lifecycle transitions.
- Schedule writes require manager/staff-supervisor permission. Register-session
  snapshots are permission-filtered; staff see their own sessions unless they
  have the supervisor permission. Session open/close rights are checked against
  the existing record and owner, and closed sessions cannot be rewritten or
  deleted.
- `/api/print`, `/api/print/test`, printer discovery, backup and restore are
  store-scoped; printer setup, test print, discovery, backup and restore require
  `manageSettings`.
- Virtual-printer byte captures are stored locally for diagnostics; there is no
  public preview endpoint for captured receipt content.

All routes share a 1 MiB JSON body cap (50 MiB only for initial app-backup
bootstrap), a 120-request/minute per-IP limit, and origin checks. WebSocket
upgrade attempts are limited to 30/minute per IP and each connection to 120
messages/minute. CORS allows the hub's own LAN origin or exact origins listed
in `HUB_ALLOWED_ORIGINS`; bearer tokens are not accepted as cookies.

Order line names, variants, modifiers, unit prices, discounts, tax, service
charge and totals are resolved or recalculated from the store catalog/settings
on the hub. Order references and ledger customer/order/shift references must
belong to the authenticated store. Credit charges must match the referenced
customer's non-void credit order; ledger writes require the credit, settle, or
void permission as applicable, and entries are append-only.

The hub does **not** yet reconcile payments against tendered amounts, enforce
customer credit limits/outstanding-balance settlement rules, or recompute
close-report cash differences and all accounting invariants. It checks
permissions for shift closing and cash-count/difference writes, but does not
independently recompute the reported cash difference. This is not yet a
production payment or accounting backend. In hub mode the POS workflow uses
`HubProvider`, with IndexedDB as its offline cache. Standalone mode remains
browser-local. The hub's payment and accounting limitations still apply in
either mode.

## Backups and recovery

Store transactions are appended to per-store JSONL files under `hub/data/stores`
and fsynced before responding. Daily backups are written to `hub/data/backups`;
only the newest 14 are retained. Run a backup now with
`POST /api/backup` (owner/manager with `manageSettings`) or `npm run hub -- backup`.
Restore by authenticated `POST /api/restore` with `{ "filename": "YYYY-MM-DD.json" }`,
or `npm run hub -- restore YYYY-MM-DD.json`. Restore replaces the backed-up store
files; make a fresh backup before using it. Backups contain credential hashes
and sensitive business data; protect them like the hub data directory.

The authenticated `GET /api/backup/health` check reports the newest retained
backup containing the current store. The admin dashboard warns when that
backup is missing or more than 48 hours old. Invalid backup metadata makes the
health request fail visibly. This verifies readable backup metadata, not a
full restore; periodically rehearse a restore on a separate test hub.

Hub print jobs retry automatically up to the store's configured primary-printer
attempt limit (default five); a configured fallback printer gets one separately
controlled attempt after the primary fails. A transport failure may be
ambiguous and can duplicate paper, so verify output before relying on
unattended printing.
The printer health alert timer starts after a job failure observed by the hub;
idle devices are not actively probed.

## Manual hub updates (no auto-update)

The hub deliberately does not download or install updates. An operator must
schedule a maintenance window and apply a reviewed release:

1. Create a fresh hub backup (`npm run hub -- backup`) and verify that the
   backup health endpoint/admin dashboard reports it.
2. Stop the hub service cleanly (Task Scheduler/NSSM on Windows, or
   `systemctl stop 7anouti-hub` on Linux). Keep the existing `hub/data`
   directory and its backups in place.
3. Install the reviewed release files or pull the approved revision. On the
   release checkout run `npm ci` if dependencies changed, then `npm run build`.
   Do not copy build output or secrets from an untrusted source.
4. Start the hub service again. Confirm `/health` is ready, open `/status`,
   sign in from a shop device, verify one test print, and check the dashboard's
   backup/printer health alerts.
5. If verification fails, stop the service and restore the previous application
   files. Preserve the data directory; restore a data backup only if the
   release changed stored data and the operator has confirmed the recovery
   point. Never roll back by deleting the hub data folder.

Keep the previous release and fresh backup until the updated hub has passed
normal service checks. There is no unattended update or automatic rollback.

## Run as a service and logs

The hub runs entirely offline after Node 22+ and the project dependencies are
installed. Keep the repository and `hub/data` on a local disk; do not use a
network share for the JSONL transaction files.

**Windows — Task Scheduler:** create a task triggered at startup, run it as a
dedicated Windows account, select **Run whether user is logged on or not**, and
set the program to the installed `node.exe`. Add
`--experimental-strip-types C:\7anouti\hub\src\main.ts` as arguments and
`C:\7anouti` as **Start in**. Set `HUB_HOST`, `HUB_PORT` and TLS variables in a
launcher `.cmd` with restricted ACLs if needed. Alternatively, install NSSM
from an approved offline copy, point its application to `node.exe`, arguments
to the same script, and startup directory to the repository root.

**Linux / Raspberry Pi — systemd:** create `/etc/systemd/system/7anouti-hub.service`:

```ini
[Unit]
Description=7anouti shop hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=7anouti
WorkingDirectory=/opt/7anouti
Environment=HUB_PORT=8080
Environment=HUB_HOST=192.168.1.20
ExecStart=/usr/bin/node --experimental-strip-types /opt/7anouti/hub/src/main.ts
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
```

Set the actual interface address, protect any TLS environment file, then run
`systemctl daemon-reload`, `systemctl enable --now 7anouti-hub`, and
`systemctl status 7anouti-hub`. Allow the selected port from the shop subnet
only in the OS firewall.

The hub rotates `hub/data/logs/hub.log` at 5 MiB and retains five rotated files.
Logs contain request paths/status and service errors, not request bodies,
credentials or bearer tokens. Check health at `/health`; run
`npm run hub:doctor` for a readable port/firewall/IP/certificate/printer/disk
report. The doctor command does not change firewall rules or install a
certificate.

## Hub package dependencies

There are no third-party dependencies. Built-ins are used for HTTP/HTTPS,
WebSocket framing, crypto/PBKDF2, filesystem durability, TCP, OS discovery,
process execution for OS printers, and TLS certificates.

## Troubleshooting

- **No `/status` page or connection refused:** run `npm run hub:doctor`,
  confirm `/health` on the hub machine, verify the port, and check the OS
  firewall and router client isolation. Ensure phones and hub are on the same
  shop LAN.
- **Wrong or changing hub address:** re-check `ipconfig` / `hostname -I`, set
  `HUB_HOST` to the LAN address, reserve it in DHCP, and restart the service.
- **Phone cannot use HTTPS:** install and trust the local certificate on that
  phone, including iOS full trust. The certificate must include the hub IP in
  its Subject Alternative Name. Re-open the exact HTTPS address; do not use
  the public cloud site to reach a private HTTP hub.
- **Port already in use:** choose an unused `HUB_PORT`; configure the firewall
  and every device URL to match. For simulator checks, configure
  `HUB_VIRTUAL_PRINTER_PORT` if loopback port 9101 is already occupied.
- **Login or pairing rejected:** confirm the lowercase store code, active
  account, correct password/PIN, and an unused, unexpired pairing code.
  Persistent login lockout lasts 15 minutes after five failures; pairing
  throttling is per store code and source IP.
- **Printer job stays queued or fails:** review Settings → Devices & printing,
  `/api/print/jobs`, hub logs and `npm run hub:doctor`. Test the virtual
  printer first; for hardware, verify LAN reachability, port and protocol.
  Retries may duplicate paper when a device accepted data but the connection
  failed before confirmation.
- **Hub is healthy but devices cannot sync:** check the device's Hub/Local
  status, browser console and `HUB_ALLOWED_ORIGINS`. Never work around an
  origin failure by allowing all origins or exposing the hub publicly.
