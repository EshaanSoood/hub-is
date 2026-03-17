# Files vs Attachments Audit

## Section 1 — `files` table: full schema and every consumer

### Requested grep output

Command run:

```bash
grep -n "files\b" apps/hub-api/hub-api.mjs | grep -i "create table\|insert\|select\|update\|delete\|stmt\|FROM files\|INTO files" | head -40
```

Relevant output:

```text
663:      CREATE TABLE files (
685:        FOREIGN KEY(file_id) REFERENCES files(file_id) ON DELETE CASCADE
1451:  INSERT INTO files (file_id, project_id, asset_root_id, provider, provider_path, name, mime_type, size_bytes, hash, metadata_json, created_by, created_at)
1456:  FROM files
6283:      const files = filesByProjectStmt
```

### `files` schema

The `files` table has these columns:

| Column | Type / role | Evidence |
| --- | --- | --- |
| `file_id` | primary key | `apps/hub-api/hub-api.mjs:663-664` |
| `project_id` | owning project | `apps/hub-api/hub-api.mjs:665`, `apps/hub-api/hub-api.mjs:676` |
| `asset_root_id` | owning asset root | `apps/hub-api/hub-api.mjs:666`, `apps/hub-api/hub-api.mjs:677` |
| `provider` | storage provider name | `apps/hub-api/hub-api.mjs:667` |
| `provider_path` | path under the provider root | `apps/hub-api/hub-api.mjs:668` |
| `name` | display filename | `apps/hub-api/hub-api.mjs:669` |
| `mime_type` | MIME type | `apps/hub-api/hub-api.mjs:670` |
| `size_bytes` | byte size | `apps/hub-api/hub-api.mjs:671` |
| `hash` | optional hash | `apps/hub-api/hub-api.mjs:672` |
| `metadata_json` | arbitrary metadata blob | `apps/hub-api/hub-api.mjs:673` |
| `created_by` | uploader user id | `apps/hub-api/hub-api.mjs:674`, `apps/hub-api/hub-api.mjs:678` |
| `created_at` | creation timestamp | `apps/hub-api/hub-api.mjs:675` |

### `file_blobs` schema

`file_blobs` is effectively coupled to `files` because the upload route writes both tables back-to-back for every tracked file upload. Its columns are:

| Column | Type / role | Evidence |
| --- | --- | --- |
| `file_id` | primary key and foreign key to `files.file_id` | `apps/hub-api/hub-api.mjs:681-685` |
| `storage_pointer` | provider/storage pointer payload | `apps/hub-api/hub-api.mjs:683` |
| `created_at` | creation timestamp | `apps/hub-api/hub-api.mjs:684` |

### Prepared statements and consumers

| Kind | Name / location | What it does | What triggers it | Data flow | Evidence |
| --- | --- | --- | --- | --- | --- |
| Prepared statement | `insertFileStmt` | Inserts a tracked file row into `files`. | Triggered by `POST /api/hub/files/upload`. | Takes upload metadata such as project, asset root, provider path, name, MIME type, size, hash, metadata JSON, creator, and timestamp. | `apps/hub-api/hub-api.mjs:1450-1453`, `apps/hub-api/hub-api.mjs:5949-5964` |
| Prepared statement | `insertFileBlobStmt` | Inserts a `file_blobs` row for the same `file_id`. | Triggered immediately after `insertFileStmt` inside `POST /api/hub/files/upload`. | Stores a JSON `storage_pointer` describing the Nextcloud provider/root/path. | `apps/hub-api/hub-api.mjs:1460`, `apps/hub-api/hub-api.mjs:5965-5973` |
| Prepared statement | `filesByProjectStmt` | Reads all `files` rows for a project sorted newest first. | Triggered by `GET /api/hub/projects/:projectId/files`. | Returns raw table rows before they are mapped into tracked-file API objects. | `apps/hub-api/hub-api.mjs:1454-1459`, `apps/hub-api/hub-api.mjs:6283-6288` |
| Helper | `trackedFileRecord()` | Maps a `files` row into the tracked-file response shape, deriving `scope` and `pane_id` from `metadata_json.pane_id` or `provider_path`. | Triggered during `GET /api/hub/projects/:projectId/files`. | Converts DB rows into `{ file_id, asset_path, size_bytes, scope, pane_id, metadata, proxy_url, ... }`. | `apps/hub-api/hub-api.mjs:2459-2485`, `apps/hub-api/hub-api.mjs:6283-6288` |
| Route | `POST /api/hub/files/upload` | Uploads bytes to Nextcloud, then writes `files` and `file_blobs`, emits a timeline event, and returns a tracked file payload. | Triggered by frontend `uploadFile(...)` calls from the Files module, the record inspector, and workspace-doc uploads. | Nextcloud bytes first, then `files`, then `file_blobs`, then response payload. | `apps/hub-api/hub-api.mjs:5918-6008`, `src/services/hub/files.ts:5-48`, `src/hooks/useProjectFilesRuntime.ts:257-268`, `src/hooks/useProjectFilesRuntime.ts:354-367`, `src/hooks/useRecordInspector.ts:395-409` |
| Route | `GET /api/hub/projects/:projectId/files` | Reads tracked files from `filesByProjectStmt`, maps them through `trackedFileRecord()`, and optionally filters pane scope. | Triggered by frontend `listTrackedFiles(...)` calls. | Supplies the Files module’s visible list data. | `apps/hub-api/hub-api.mjs:6251-6288`, `src/services/hub/files.ts:50-69`, `src/hooks/useProjectFilesRuntime.ts:140-154` |

### Observations

- I found no prepared `UPDATE` or `DELETE` statements for `files`, and no prepared `SELECT` or `DELETE` statements for `file_blobs`; within `hub-api.mjs`, the surfaced `file_blobs` references are the schema declaration and `insertFileBlobStmt`. (`apps/hub-api/hub-api.mjs:681-685`, `apps/hub-api/hub-api.mjs:1460`, `apps/hub-api/hub-api.mjs:5965-5973`)
- The Files module depends on `GET /projects/:projectId/files` and the tracked-file shape, not on attachments. (`src/hooks/useProjectFilesRuntime.ts:140-154`, `src/hooks/useProjectFilesRuntime.ts:216-305`, `src/hooks/useProjectFilesRuntime.ts:308-405`, `src/components/project-space/WorkView.tsx:579-588`, `src/services/hub/types.ts:257-273`)

## Section 2 — `entity_attachments` table: full schema and every consumer

### Matching grep output

Command run:

```bash
grep -n "entity_attachments\b" apps/hub-api/hub-api.mjs | grep -i "create table\|insert\|select\|update\|delete\|stmt\|FROM entity_attachments\|INTO entity_attachments" | head -40
```

Relevant output:

```text
688:      CREATE TABLE entity_attachments (
1463:  INSERT INTO entity_attachments (
1480:const deleteAttachmentStmt = db.prepare('DELETE FROM entity_attachments WHERE attachment_id = ?');
1483:  FROM entity_attachments ea
1487:const attachmentByIdStmt = db.prepare('SELECT * FROM entity_attachments WHERE attachment_id = ?');
```

### `entity_attachments` schema

The `entity_attachments` table has these columns:

| Column | Type / role | Evidence |
| --- | --- | --- |
| `attachment_id` | primary key | `apps/hub-api/hub-api.mjs:688-689` |
| `project_id` | owning project | `apps/hub-api/hub-api.mjs:690`, `apps/hub-api/hub-api.mjs:702` |
| `entity_type` | linked entity type | `apps/hub-api/hub-api.mjs:691` |
| `entity_id` | linked entity id | `apps/hub-api/hub-api.mjs:692` |
| `provider` | storage provider name | `apps/hub-api/hub-api.mjs:693` |
| `asset_root_id` | provider root | `apps/hub-api/hub-api.mjs:694`, `apps/hub-api/hub-api.mjs:703` |
| `asset_path` | provider-relative file path | `apps/hub-api/hub-api.mjs:695` |
| `name` | display filename | `apps/hub-api/hub-api.mjs:696` |
| `mime_type` | MIME type | `apps/hub-api/hub-api.mjs:697` |
| `size_bytes` | byte size | `apps/hub-api/hub-api.mjs:698` |
| `metadata_json` | arbitrary attachment metadata | `apps/hub-api/hub-api.mjs:699` |
| `created_by` | actor user id | `apps/hub-api/hub-api.mjs:700`, `apps/hub-api/hub-api.mjs:704` |
| `created_at` | creation timestamp | `apps/hub-api/hub-api.mjs:701` |

### Prepared statements and consumers

| Kind | Name / location | What it does | What triggers it | Data flow | Evidence |
| --- | --- | --- | --- | --- | --- |
| Prepared statement | `insertAttachmentStmt` | Inserts a new row into `entity_attachments`. | Triggered by `POST /api/hub/attachments`. | Stores entity link, provider/path reference, display metadata, creator, and timestamp. | `apps/hub-api/hub-api.mjs:1462-1479`, `apps/hub-api/hub-api.mjs:6077-6092` |
| Prepared statement | `deleteAttachmentStmt` | Deletes an attachment row by `attachment_id`. | Triggered by `DELETE /api/hub/attachments/:attachmentId`. | Removes the entity-to-file link only. | `apps/hub-api/hub-api.mjs:1480`, `apps/hub-api/hub-api.mjs:6164-6181` |
| Prepared statement | `attachmentsByEntityStmt` | Reads all rows for one `(project_id, entity_type, entity_id)`. | Triggered when record detail is built. | Supplies the `attachments` array embedded in record detail. | `apps/hub-api/hub-api.mjs:1481-1486`, `apps/hub-api/hub-api.mjs:2304-2320` |
| Prepared statement | `attachmentByIdStmt` | Reads one row by `attachment_id`. | Triggered before delete authorization and deletion. | Used to recover project scope and referenced path before deleting the row. | `apps/hub-api/hub-api.mjs:1487`, `apps/hub-api/hub-api.mjs:6140-6158` |
| Helper | `recordDetail()` attachment mapper | Maps DB rows into API attachment objects with `proxy_url`. | Triggered by `GET /api/hub/records/:recordId` and record patch responses. | Returns `{ attachment_id, provider, asset_root_id, asset_path, name, mime_type, size_bytes, metadata, proxy_url, created_at }`. | `apps/hub-api/hub-api.mjs:2304-2320`, `apps/hub-api/hub-api.mjs:4615-4691` |
| Route | `POST /api/hub/attachments` | Validates payload, checks write access, inserts the attachment row, emits `file.attached`, and returns the new attachment payload. | Triggered by frontend `attachFile(...)`, which today is only called from the record inspector. | Writes the durable entity link after a file upload already exists. | `apps/hub-api/hub-api.mjs:6016-6137`, `src/services/hub/records.ts:607-630`, `src/hooks/useRecordInspector.ts:414-426` |
| Route | `DELETE /api/hub/attachments/:attachmentId` | Loads, authorizes, deletes, emits `file.detached`, returns `{ deleted: true }`. | Triggered by frontend `detachFile(...)`, which today is only called from the record inspector. | Removes the durable entity link. | `apps/hub-api/hub-api.mjs:6140-6182`, `src/services/hub/records.ts:632-649`, `src/hooks/useRecordInspector.ts:478-479` |

## Section 3 — Column-by-column comparison

### Side-by-side schema

| Concern | `files` column | `entity_attachments` equivalent? | `entity_attachments` column | `files` equivalent? | Evidence |
| --- | --- | --- | --- | --- | --- |
| Primary key | `file_id` | No equivalent name; only `attachment_id` | `attachment_id` | No equivalent name; only `file_id` | `apps/hub-api/hub-api.mjs:663-664`, `apps/hub-api/hub-api.mjs:688-689` |
| Project scope | `project_id` | Yes | `project_id` | Yes | `apps/hub-api/hub-api.mjs:665`, `apps/hub-api/hub-api.mjs:690` |
| Asset root | `asset_root_id` | Yes | `asset_root_id` | Yes | `apps/hub-api/hub-api.mjs:666`, `apps/hub-api/hub-api.mjs:694` |
| Provider | `provider` | Yes | `provider` | Yes | `apps/hub-api/hub-api.mjs:667`, `apps/hub-api/hub-api.mjs:693` |
| Provider-relative path | `provider_path` | Rough equivalent: `asset_path` | `asset_path` | Rough equivalent: `provider_path` | `apps/hub-api/hub-api.mjs:668`, `apps/hub-api/hub-api.mjs:695` |
| Display name | `name` | Yes | `name` | Yes | `apps/hub-api/hub-api.mjs:669`, `apps/hub-api/hub-api.mjs:696` |
| MIME type | `mime_type` | Yes | `mime_type` | Yes | `apps/hub-api/hub-api.mjs:670`, `apps/hub-api/hub-api.mjs:697` |
| Size | `size_bytes` | Yes | `size_bytes` | Yes | `apps/hub-api/hub-api.mjs:671`, `apps/hub-api/hub-api.mjs:698` |
| Hash | `hash` | No | none | No equivalent in attachments | `apps/hub-api/hub-api.mjs:672`, `apps/hub-api/hub-api.mjs:688-705` |
| Arbitrary metadata | `metadata_json` | Yes | `metadata_json` | Yes | `apps/hub-api/hub-api.mjs:673`, `apps/hub-api/hub-api.mjs:699` |
| Creator | `created_by` | Yes | `created_by` | Yes | `apps/hub-api/hub-api.mjs:674`, `apps/hub-api/hub-api.mjs:700` |
| Created timestamp | `created_at` | Yes | `created_at` | Yes | `apps/hub-api/hub-api.mjs:675`, `apps/hub-api/hub-api.mjs:701` |
| Linked entity type | none | No | `entity_type` | No equivalent in files | `apps/hub-api/hub-api.mjs:663-679`, `apps/hub-api/hub-api.mjs:691` |
| Linked entity id | none | No | `entity_id` | No equivalent in files | `apps/hub-api/hub-api.mjs:663-679`, `apps/hub-api/hub-api.mjs:692` |
| Blob pointer table | `file_blobs.storage_pointer` via `file_id` | No | none | No equivalent in attachments | `apps/hub-api/hub-api.mjs:681-685`, `apps/hub-api/hub-api.mjs:1460` |

### Unique data each side would lose if removed

- Removing `files` would lose `hash` and the `file_blobs.storage_pointer` chain, which are the only places I found content-object-level metadata beyond provider path and display metadata. (`apps/hub-api/hub-api.mjs:672`, `apps/hub-api/hub-api.mjs:681-685`, `apps/hub-api/hub-api.mjs:1460`)
- Removing `entity_attachments` would lose `entity_type` and `entity_id`, which are the only persisted linkage fields connecting a file reference to a specific record/entity. (`apps/hub-api/hub-api.mjs:691-692`)

## Section 4 — What `entity_attachments` has that `files` doesn't

`files` does not currently have a durable concept of “this file is linked to entity X.”

Evidence:

1. The `files` schema has no `entity_type`, `entity_id`, `doc_id`, `record_id`, or other entity foreign-key column. (`apps/hub-api/hub-api.mjs:663-679`)
2. The tracked-file mapper derives only `scope` and `pane_id`, not any entity link. (`apps/hub-api/hub-api.mjs:2459-2485`)
3. The inspector upload flow sends `attached_entity_type: 'record'` and `attached_entity_id: recordId` as upload metadata, but the upload route inserts `toJson({})` into `files.metadata_json`, so that relation is not persisted in the `files` row. (`src/hooks/useRecordInspector.ts:396-408`, `apps/hub-api/hub-api.mjs:5951-5963`)

To let `files` replace `entity_attachments`, one of these would need to be added:

- `entity_type` + `entity_id` columns directly on `files`, if one file row is allowed to belong to at most one entity. This would not preserve the current “same underlying asset path can be attached multiple times with different metadata” behavior without extra constraints. This is an inference from the current `relinkInspectorAttachment()` flow, which creates replacement attachment rows without changing the underlying uploaded file. (`src/hooks/useRecordInspector.ts:505-632`)
- A junction table such as `file_entity_links(file_id, entity_type, entity_id, metadata_json, created_by, created_at)` if one tracked file can be linked to many entities or many attachment contexts. That better matches the current split between file-object metadata in `files` and link metadata in `entity_attachments`. This is an inference from the schema separation and the current two-step attach flow. (`apps/hub-api/hub-api.mjs:663-705`, `src/hooks/useRecordInspector.ts:395-426`)

## Section 5 — What `files` has that `entity_attachments` doesn't

`entity_attachments` stores only a reference to a provider path plus display metadata. It does not store file-content-specific metadata beyond size/name/type.

Evidence:

1. `entity_attachments` has `provider`, `asset_root_id`, `asset_path`, `name`, `mime_type`, `size_bytes`, and `metadata_json`, but no `hash` column and no pointer table like `file_blobs`. (`apps/hub-api/hub-api.mjs:688-705`)
2. `files` adds `hash`, and the upload flow also writes a `file_blobs.storage_pointer` record describing where the content lives. (`apps/hub-api/hub-api.mjs:663-685`, `apps/hub-api/hub-api.mjs:5951-5973`)
3. The Files module consumes `HubTrackedFile`, which is shaped around `file_id`, `scope`, `pane_id`, `metadata`, and `proxy_url`, not around `attachment_id` or entity linkage. (`src/services/hub/types.ts:257-273`, `src/hooks/useProjectFilesRuntime.ts:140-154`, `src/components/project-space/WorkView.tsx:579-588`)

## Section 6 — Current data flow for "attach a file to a record"

### End-to-end sequence

1. The user submits the record inspector attachment form in `ProjectSpacePage`. (`src/pages/ProjectSpacePage.tsx:1709-1718`)
2. `useRecordInspector.onAttachFile()` reads the selected file, base64-encodes it, and ensures there is an asset root. (`src/hooks/useRecordInspector.ts:373-395`)
3. The hook calls frontend `uploadFile(...)`, which hits `POST /api/hub/files/upload`. (`src/hooks/useRecordInspector.ts:396-409`, `src/services/hub/files.ts:5-48`)
4. The backend upload route uploads bytes to Nextcloud first, then writes `files`, then writes `file_blobs`, then returns the tracked file payload. (`apps/hub-api/hub-api.mjs:5935-5973`, `apps/hub-api/hub-api.mjs:5990-6008`)
5. Back in the hook, after the upload response returns, it calls frontend `attachFile(...)`, which hits `POST /api/hub/attachments`. (`src/hooks/useRecordInspector.ts:414-426`, `src/services/hub/records.ts:607-630`)
6. The backend attachment route writes `entity_attachments` and returns the new attachment payload. (`apps/hub-api/hub-api.mjs:6077-6137`)
7. The hook then refreshes record detail and tracked project files. (`src/hooks/useRecordInspector.ts:431-441`)

### Write order

The database write order for “attach a file to a record” is:

1. `files`
2. `file_blobs`
3. `entity_attachments`

Evidence:

- `insertFileStmt.run(...)` happens before `insertFileBlobStmt.run(...)` inside the upload route. (`apps/hub-api/hub-api.mjs:5951-5973`)
- `attachFile(...)` is called only after the upload request returns successfully to the frontend. (`src/hooks/useRecordInspector.ts:396-426`)
- `insertAttachmentStmt.run(...)` happens inside the later `/api/hub/attachments` request. (`apps/hub-api/hub-api.mjs:6077-6092`)

### Transaction behavior

- I found no `transaction` or `db.transaction` references in `apps/hub-api/hub-api.mjs`, and the relevant writes are visibly sequential inside separate route handlers rather than wrapped in one shared transaction block. Within the upload route, `insertFileStmt.run(...)` and `insertFileBlobStmt.run(...)` are sequential statements; the attachment write happens in a separate later HTTP request. (`apps/hub-api/hub-api.mjs:5951-5973`, `apps/hub-api/hub-api.mjs:6016-6092`)

### Failure behavior

- If the second step (`POST /api/hub/attachments`) fails after upload succeeds, the first writes remain. The frontend catch path only reports `"Failed to attach file."`; it does not roll back the already-created tracked file or the uploaded Nextcloud asset. (`src/hooks/useRecordInspector.ts:414-446`)
- That means a failed record attachment can leave behind an orphaned tracked file in `files`/`file_blobs` plus the underlying Nextcloud asset, with no `entity_attachments` link. This is an inference from the two-step flow and the lack of rollback code in `onAttachFile()`. (`src/hooks/useRecordInspector.ts:395-446`, `apps/hub-api/hub-api.mjs:5951-5973`, `apps/hub-api/hub-api.mjs:6077-6092`)

## Section 7 — Could `files` become canonical?

Yes, but only if entity linkage is added on top of `files`.

### What would need to change

1. Persist attachment linkage during upload, because the current upload route drops the inspector’s `attached_entity_type` / `attached_entity_id` metadata. (`src/hooks/useRecordInspector.ts:396-408`, `apps/hub-api/hub-api.mjs:5951-5963`)
2. Add either:
   - direct `entity_type` / `entity_id` columns to `files`, or
   - a junction table linking `file_id` to entities with per-link metadata.
   The second option better matches current behavior because `entity_attachments` is link-shaped while `files` is file-object-shaped. This is an inference from the current schemas. (`apps/hub-api/hub-api.mjs:663-705`)
3. Rewrite `recordDetail()` so its `attachments` array is read from `files` plus the new link source rather than `entity_attachments`. (`apps/hub-api/hub-api.mjs:2304-2320`)
4. Rewrite rename/move semantics in `useRecordInspector`, because they currently create/delete attachment rows rather than mutate a file row. (`src/hooks/useRecordInspector.ts:505-632`)

### What would be gained

- A single canonical file object with one `file_id`, one blob pointer chain, and one provider-path record for both the Files module and inspector-linked files. (`apps/hub-api/hub-api.mjs:663-685`, `src/services/hub/types.ts:257-273`)

### What would be lost or need redesign

- The current attachment operations act like link mutations, not content mutations. Rename/move today are implemented as “create new link, delete old link,” which a file-object table alone does not represent cleanly. (`src/hooks/useRecordInspector.ts:505-632`)
- If `entity_type` / `entity_id` were put directly on `files`, a single file row could only point at one entity unless the design allowed null/duplicated rows. A junction table avoids that limitation. This is an inference from the one-row-per-file structure of `files`. (`apps/hub-api/hub-api.mjs:663-679`)

## Section 8 — Could `entity_attachments` become canonical?

Not cleanly for the current product, because it is missing canonical file-object data and the Files module already speaks in tracked-file terms.

### What would need to be added

To replace `files`, `entity_attachments` would need at least:

- a stable file-object identifier separate from `attachment_id`, if one physical file can be attached in more than one place;
- a `hash` equivalent; and
- a blob/storage-pointer equivalent like `file_blobs.storage_pointer`. (`apps/hub-api/hub-api.mjs:663-685`, `apps/hub-api/hub-api.mjs:688-705`)

### What would break in the Files module if `files` disappeared

1. `GET /api/hub/projects/:projectId/files` would lose its backing statement and response mapper. (`apps/hub-api/hub-api.mjs:1454-1459`, `apps/hub-api/hub-api.mjs:2459-2485`, `apps/hub-api/hub-api.mjs:6251-6288`)
2. `useProjectFilesRuntime` would lose `listTrackedFiles(...)`, which it uses for both project and pane file lists. (`src/hooks/useProjectFilesRuntime.ts:140-154`)
3. The Files module UI in `WorkView` would lose its data source and upload refresh path, because it is wired to tracked-file lists and tracked-file upload responses, not attachment lists. (`src/hooks/useProjectFilesRuntime.ts:216-305`, `src/hooks/useProjectFilesRuntime.ts:308-405`, `src/components/project-space/WorkView.tsx:579-588`)
4. `HubTrackedFile` includes `file_id`, `scope`, `pane_id`, and `metadata` fields that do not map directly to the current attachment schema. (`src/services/hub/types.ts:257-273`, `src/services/hub/types.ts:217-228`)

### Bottom line

`entity_attachments` could possibly become canonical only if it absorbed nearly all of `files` plus `file_blobs`, and then also gained a project/pane listing model equivalent to `scope` + `pane_id`. That is a much larger redesign than making `files` canonical with a lightweight link layer. This is an inference from the current schemas and consumers. (`apps/hub-api/hub-api.mjs:663-705`, `src/hooks/useProjectFilesRuntime.ts:140-154`, `src/components/project-space/WorkView.tsx:579-588`)

## Section 9 — Recommendation

The best canonical boundary is:

- `files` as the canonical file object table
- a lightweight link table as the canonical entity-link layer

Why:

1. `files` already owns the file-object concerns: provider root/path, size, optional hash, creator, creation time, and `file_blobs.storage_pointer`. (`apps/hub-api/hub-api.mjs:663-685`)
2. `entity_attachments` already behaves like a link table, not like a file-object table. Its unique value is entity linkage plus per-link metadata. (`apps/hub-api/hub-api.mjs:688-705`)
3. The current bugs and duplication come from making the inspector write both a tracked file and a separate entity-link row across two API calls. (`src/hooks/useRecordInspector.ts:395-426`)

### Smallest change toward a single source of truth

The smallest non-destructive path is:

1. Keep `files` and `file_blobs` as-is.
2. Replace `entity_attachments` over time with a junction table keyed by `file_id` plus `entity_type` / `entity_id` and per-link metadata.
3. Change `POST /api/hub/files/upload` to persist and return metadata the frontend already sends.
4. For the inspector attach flow, create the file once, then create a link row to that `file_id` rather than a second full file-reference row.

This yields:

- one canonical file record,
- one canonical storage-pointer record,
- one explicit entity-link layer,
- no duplication of provider/path metadata across unrelated tables,
- and a clearer place to support rename/move-as-link-mutation semantics.

This recommendation is an inference from the current code structure rather than an implemented design. Supporting evidence: `files` currently lacks entity linkage, `entity_attachments` lacks file-object metadata, and the attach flow already proves the product conceptually needs both roles. (`apps/hub-api/hub-api.mjs:663-705`, `src/hooks/useRecordInspector.ts:395-426`, `src/hooks/useRecordInspector.ts:505-632`)
