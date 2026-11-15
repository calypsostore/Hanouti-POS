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

## First run and importing data

The first owner is created with `POST /api/auth/setup`; there are no default
credentials. Send `storeName`, a lowercase `storeCode`, `username`, a
10-character-or-longer `password`, and a 4–12 digit `pin`. Setup is available
only while the hub has no stores. The API returns a 12-hour bearer session.

An existing app backup may bootstrap an empty hub using
`POST /api/setup/import-backup` with `{ "backup": <backup-json> }`, or from the
hub machine:

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
that mixed-content request. In-shop phones/tablets must open the hub HTTPS
address itself. The cloud HTTPS site remains for remote administration only.
This project does not yet include a client HubProvider/PWA service worker.

## API and server-side enforcement

- `POST /api/auth/login` authenticates store code + username/email + password or
  PIN, enforces persistent five-failure/15-minute lockout, and returns a random
  bearer token with 12-hour expiry. Logout revokes it; a hub restart revokes
  active sessions.
- `POST /api/station/pair` validates a current, unused M1b six-digit code,
  expiry, active device and active screen stations, then issues a random token
  stored as a PBKDF2 hash. Device API/WebSocket sessions are store- and
  station-scoped.
- `/api/sync` and WebSocket `sync` validate every document's store ID, change
  set bounds and idempotency key. Server checks cover staff, settings,
  inventory/stock, purchases, payroll, voids, shift open/close, and store
  ownership. Station devices cannot submit general sync writes.
- `/api/station/status` and WebSocket `station-status` enforce `viewStation`,
  station assignment and valid lifecycle transitions.
- `/api/print`, `/api/print/test`, printer discovery, backup and restore are
  store-scoped; printer setup, test print, discovery, backup and restore require
  `manageSettings`.

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
production payment or accounting backend. The main POS workflow still uses
browser-local IndexedDB and has not been connected to these endpoints.

## Backups and recovery

Store transactions are appended to per-store JSONL files under `hub/data/stores`
and fsynced before responding. Daily backups are written to `hub/data/backups`;
only the newest 14 are retained. Run a backup now with
`POST /api/backup` (owner/manager with `manageSettings`) or `npm run hub -- backup`.
Restore by authenticated `POST /api/restore` with `{ "filename": "YYYY-MM-DD.json" }`,
or `npm run hub -- restore YYYY-MM-DD.json`. Restore replaces the backed-up store
files; make a fresh backup before using it. Backups contain credential hashes
and sensitive business data; protect them like the hub data directory.

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
