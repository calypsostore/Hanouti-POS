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

The hub applies conflicting document writes in arrival/sequence order (last
writer wins). It ignores an already applied `opId`, including replay after a
reconnect. `orderItems` and `payments` records merge their nested rows by row ID;
ordinary records are replaced as a whole. A stale `baseSeq` is accepted and
resolved by the hub-order policy rather than rejecting unrelated edits.

The transaction boundary is one JSONL record containing the new state and its
change set, appended and fsynced before a successful response. Store data is
isolated into separate files. The shared helper is deliberately independent of
React, browser storage, and Node APIs.

Current limitation: the local app still uses IndexedDB and does not yet submit
hub change sets or perform a reconnect/full-resync handshake. That client work is
roadmap M4; the hub protocol itself and its deduplication/merge tests are
implemented.
