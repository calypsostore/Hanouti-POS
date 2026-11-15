# Hub change-set sync protocol

The client sends `POST /api/sync` (or a WebSocket `sync` message) with:

```json
{
  "opId": "unique-idempotency-key",
  "deviceId": "client-device-id",
  "storeId": "store-id",
  "baseSeq": 12,
  "ops": [
    { "kind": "put", "collection": "products", "id": "p1", "document": { "id": "p1", "storeId": "store-id" } },
    { "kind": "delete", "collection": "products", "id": "p2" }
  ]
}
```

`src/shared/sync.ts` contains the pure client/hub helpers. `diffCollections`
compares collection documents by ID and emits deterministic operations regardless
of input ordering. The hub validates every operation and document, checks the
authenticated store scope and permissions, applies the change set as one durable
store transaction, increments the store sequence once, and broadcasts the
resulting operation ID and sequence to same-store WebSocket clients.

The hub applies conflicting document writes in arrival/sequence order and
ignores an already applied `opId`, including replay after a reconnect. Product
and category updates changed by another device since the sender's base sequence
are returned as review conflicts. Open-order lines and table-history events
merge by stable line/event ID; the newest item timestamp wins for concurrent
edits to the same line. Concurrent opens for the same table coalesce into the
existing order, retaining its owner, number and shift. Payments/order-item rows
merge by row ID. A stale `baseSeq` is accepted, but stale open-order deletions
have no tombstones and may be resurrected by later edits.

The transaction boundary is one JSONL record containing the new state and its
change set, appended and fsynced before a successful response. Store data is
isolated into separate files. The shared helper is deliberately independent of
React, browser storage, and Node APIs.

## Client providers and reconnect

When served by the hub, the app selects `HubProvider`; otherwise it remains in
standalone `LocalProvider` mode. HubProvider keeps an IndexedDB offline cache and
ordered IndexedDB outbox. Each change set carries a stable idempotency key, a
device ID and the last known sequence. Reconnect replays pending entries in
order with bounded exponential backoff, then downloads and applies an
authoritative full snapshot. This is snapshot resync, not an incremental
change-log pull. Print jobs use their job IDs as hub idempotency keys and remain
queued until confirmed.

Authenticated clients refresh a full snapshot immediately on `sync` and
`station-status` WebSocket messages, so table changes and station updates do
not wait for the polling interval. The 2.5-second poll remains a
reachability/repair fallback, with reconnect backoff for dropped sockets. This
is snapshot resync, not an incremental change-log pull. Browser app-shell
offline loading needs a secure context; HTTP over a LAN IP provides online hub
access only. See `docs/DECISIONS.md` for offline conflict and printer-fallback
limitations.
