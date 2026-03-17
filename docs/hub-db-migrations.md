# Hub API SQLite Migrations

Last updated: 2026-03-01 UTC

## Scope

This document covers Hub API database schema bootstrapping and versioning in `apps/hub-api/hub-api.mjs`.

## How schema versioning works

- Hub stores schema state in a `schema_version` table.
- `schema_version` is a single-row table (`id = 1`) with:
  - `version` (integer)
  - `updated_at` (ISO timestamp)
- On startup, Hub runs ordered migrations inside one SQLite transaction (`BEGIN IMMEDIATE ... COMMIT`).
- If any migration fails, Hub rolls back the transaction and startup fails.

## Current migrations

- `v1`: base Hub schema (tables + indexes).
- `v2`: notes revision metadata compatibility:
  - add `notes.latest_revision_id`
  - add `notes.latest_revision_actor`
  - add `notes.latest_revision_at`
  - add `notes.content_hash`
  - ensure index `idx_notes_latest_revision`
- `v3`: user name normalization:
  - add `users.first_name` (`TEXT NOT NULL`)
  - add `users.last_name` (`TEXT NOT NULL`)
  - backfill legacy rows:
    - parse from `users.name` when possible (`"First Last"` -> `first_name="First"`, `last_name="Last"`)
    - fallback to `first_name = name` and `last_name = '(unknown)'`
    - final safety pass fills empty values with `'(unknown)'`

## Legacy database behavior

- Existing databases without `schema_version` are treated as `version = 0`.
- Migrations are idempotent (`CREATE ... IF NOT EXISTS` + guarded column adds), so startup converges old and new databases to the same target schema.

## Operator checks

After deploy, verify schema version from the Hub DB file:

```bash
sqlite3 /data/hub.sqlite "SELECT version, updated_at FROM schema_version WHERE id = 1;"
```

Expected `version` is `3`.
