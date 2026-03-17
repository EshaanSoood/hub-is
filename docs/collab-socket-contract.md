# Hub Collaboration Socket Contract

Last updated: 2026-02-25 UTC

## Scope

This service is single-purpose: Yjs/Lexical realtime notes collaboration only.

## Endpoint

- Canonical WebSocket endpoint: `wss://collab.eshaansood.org/<noteId>`
- Health endpoints:
  - `GET /healthz`
  - `GET /readyz`

## Room model

- Exactly one room per note.
- `roomId = noteId`
- Accepted room format: `note_[a-z0-9-]{8,120}`

## Token model

Hub sidecar mints short-lived HMAC tokens via:

- `POST /api/hub/projects/:projectId/notes/:noteId/collab/session`

Token required claims:

- `userId`
- `email`
- `projectId`
- `noteId`
- `roomId`
- `expiresAt`

Required properties:

- Signature must validate (`HUB_COLLAB_TOKEN_SECRET`).
- `expiresAt` must be in the future.
- Upgrade request must include `project_id` (query param or `x-hub-project-id` header).
- `project_id` must equal token `projectId`.
- `noteId` and `roomId` must equal the requested room in the WS URL path.

## WS auth enforcement

Auth check happens during HTTP upgrade before room sync starts.

Deny conditions (fail closed):

- missing token
- invalid signature
- expired token
- malformed claims
- room mismatch (`token.noteId`/`token.roomId` vs requested room)
- disallowed origin (if origin policy is configured)
- connection/document limits exceeded

Any deny path returns non-101 response and closes the socket.

## Minimal observability

Logs include:

- connect accepted/denied
- room id
- hashed user identity
- high-level reason codes

Logs must not print raw token payloads.

## Runtime configuration

- `HUB_COLLAB_TOKEN_SECRET`
- `HUB_COLLAB_MAX_CONNECTIONS`
- `HUB_COLLAB_MAX_DOCUMENTS`
- `HUB_COLLAB_PING_TIMEOUT_MS`
- `HUB_COLLAB_ALLOWED_ORIGINS`
- `HUB_COLLAB_REQUIRE_ORIGIN`
- `HUB_COLLAB_LOG_LEVEL`

## Persistence behavior

- Yjs doc state is persisted to local disk by `hub-collab` under `.data/yjs-docs/`.
- On first open, the room snapshot is loaded before sync starts.
- During collaboration, saves are debounced and written atomically.
- On last disconnect for a room, pending writes are flushed before doc teardown.
