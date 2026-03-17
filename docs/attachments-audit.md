# Attachments Audit

## Section 1 — Backend: every reference to `entity_attachments`

### Requested grep output

Command run:

```bash
grep -n "entity_attachments\|attachmentsByEntity\|insertAttachment\|deleteAttachment\|attachFile\|detachFile\|attachment_id" apps/hub-api/hub-api.mjs | head -60
```

Relevant output:

```text
397:  'entity_attachments',
688:      CREATE TABLE entity_attachments (
689:        attachment_id TEXT PRIMARY KEY,
952:      CREATE INDEX idx_attachments_entity_lookup ON entity_attachments(project_id, entity_type, entity_id);
953:      CREATE INDEX idx_attachments_asset_lookup ON entity_attachments(asset_root_id, asset_path);
1462:const insertAttachmentStmt = db.prepare(`
1463:  INSERT INTO entity_attachments (
1464:    attachment_id,
1480:const deleteAttachmentStmt = db.prepare('DELETE FROM entity_attachments WHERE attachment_id = ?');
1481:const attachmentsByEntityStmt = db.prepare(`
1483:  FROM entity_attachments ea
1487:const attachmentByIdStmt = db.prepare('SELECT * FROM entity_attachments WHERE attachment_id = ?');
2304:  const attachments = attachmentsByEntityStmt
2307:      attachment_id: row.attachment_id,
6078:      insertAttachmentStmt.run(
6102:          attachment_id: attachmentId,
6115:            attachment_id: attachmentId,
6117:              attachment_id: attachmentId,
6164:      deleteAttachmentStmt.run(attachmentId);
6174:          attachment_id: attachmentId,
```

### Every backend statement/helper/route

| Kind | Name / location | What it does | What triggers it | Evidence |
| --- | --- | --- | --- | --- |
| Schema | `CREATE TABLE entity_attachments` | Defines the durable attachment table with `project_id`, `entity_type`, `entity_id`, provider/path metadata, and creator/timestamp fields. | Database bootstrap / schema creation. | `apps/hub-api/hub-api.mjs:688-705` |
| Index | `idx_attachments_entity_lookup` | Speeds up reads by `(project_id, entity_type, entity_id)`. | Database bootstrap / schema creation. | `apps/hub-api/hub-api.mjs:952-953` |
| Index | `idx_attachments_asset_lookup` | Speeds up reads by `(asset_root_id, asset_path)`. | Database bootstrap / schema creation. | `apps/hub-api/hub-api.mjs:952-953` |
| Prepared statement | `insertAttachmentStmt` | Inserts a new row into `entity_attachments`. | Called by `POST /api/hub/attachments`. | `apps/hub-api/hub-api.mjs:1462-1479`, `apps/hub-api/hub-api.mjs:6077-6092` |
| Prepared statement | `deleteAttachmentStmt` | Deletes a row by `attachment_id`. | Called by `DELETE /api/hub/attachments/:attachmentId`. | `apps/hub-api/hub-api.mjs:1480`, `apps/hub-api/hub-api.mjs:6164-6181` |
| Prepared statement | `attachmentsByEntityStmt` | Reads all attachment rows for a specific `(project_id, entity_type, entity_id)` sorted newest first. | Called while building record detail responses. | `apps/hub-api/hub-api.mjs:1481-1486`, `apps/hub-api/hub-api.mjs:2304-2320` |
| Prepared statement | `attachmentByIdStmt` | Reads one attachment row by `attachment_id`. | Called by the delete route before authorization and deletion. | `apps/hub-api/hub-api.mjs:1487`, `apps/hub-api/hub-api.mjs:6140-6158` |
| Helper logic | `recordDetail()` attachment mapper | Embeds attachment data into the returned record detail payload, including `proxy_url`. | Triggered whenever a record detail is built and returned. | `apps/hub-api/hub-api.mjs:2304-2320` |
| Route | `POST /api/hub/attachments` | Validates project/entity/provider/root/path, checks write access, inserts the attachment row, emits `file.attached`, and returns the new attachment payload. | Triggered by frontend `attachFile` calls from the record inspector. | `apps/hub-api/hub-api.mjs:6016-6137` |
| Route | `DELETE /api/hub/attachments/:attachmentId` | Loads the existing row, checks write access, deletes it, emits `file.detached`, and returns `{ deleted: true }`. | Triggered by frontend `detachFile` calls from the record inspector. | `apps/hub-api/hub-api.mjs:6140-6182` |
| Route using helper | `GET /api/hub/records/:recordId` | Returns `recordDetail(record)`, which includes `attachments` loaded from `entity_attachments`. | Triggered whenever the frontend fetches a record detail. | `apps/hub-api/hub-api.mjs:4670-4691`, `apps/hub-api/hub-api.mjs:2304-2320` |
| Route using helper | `PATCH /api/hub/records/:recordId` | Returns the updated `recordDetail(...)` after a record patch, so attachments remain present in the response shape after title/archive updates. | Triggered when record metadata is patched. | `apps/hub-api/hub-api.mjs:4615-4666`, `apps/hub-api/hub-api.mjs:2304-2320` |

### Summary

- I found exactly four prepared statements directly touching `entity_attachments`: insert, delete, read-by-entity, and read-by-id. (`apps/hub-api/hub-api.mjs:1462-1487`)
- I found exactly two direct attachment routes: create and delete. (`apps/hub-api/hub-api.mjs:6016-6182`)
- I found exactly one read path that turns table data into user-facing API data: the `attachments` array inside `recordDetail()`. (`apps/hub-api/hub-api.mjs:2304-2320`)

## Section 2 — Frontend: every call to `attachFile` and `detachFile`

### Requested grep output

Command run:

```bash
grep -rn "attachFile\|detachFile\|entity_attachments\|attachment" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Relevant output:

```text
src/hooks/useRecordInspector.ts:11:  attachFile,
src/hooks/useRecordInspector.ts:12:  detachFile,
src/hooks/useRecordInspector.ts:169:    if (!inspectorRecord || inspectorRecord.attachments.length === 0) {
src/hooks/useRecordInspector.ts:174:      if (current && inspectorRecord.attachments.some((attachment) => attachment.attachment_id === current)) {
src/hooks/useRecordInspector.ts:177:      return inspectorRecord.attachments[0].attachment_id;
src/hooks/useRecordInspector.ts:380:        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
src/hooks/useRecordInspector.ts:387:      const input = form.elements.namedItem('attachment-file') as HTMLInputElement | null;
src/hooks/useRecordInspector.ts:414:        await attachFile(accessToken, {
src/hooks/useRecordInspector.ts:466:    async (attachmentId: string) => {
src/hooks/useRecordInspector.ts:471:        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
src/hooks/useRecordInspector.ts:478:        await detachFile(accessToken, attachmentId, { mutation_context_pane_id: inspectorMutationPaneId });
src/hooks/useRecordInspector.ts:518:      const attachment = inspectorRecord.attachments.find((entry) => entry.attachment_id === attachmentId);
src/hooks/useRecordInspector.ts:527:      const attached = await attachFile(accessToken, {
src/hooks/useRecordInspector.ts:542:          await detachFile(accessToken, attached.attachment_id, { mutation_context_pane_id: inspectorMutationPaneId });
src/hooks/useRecordInspector.ts:549:        await detachFile(accessToken, attachmentId, { mutation_context_pane_id: inspectorMutationPaneId });
src/hooks/useRecordInspector.ts:552:          await detachFile(accessToken, attached.attachment_id, { mutation_context_pane_id: inspectorMutationPaneId });
src/pages/ProjectSpacePage.tsx:1648:                {inspectorRecord.attachments.length > 0 ? (
src/pages/ProjectSpacePage.tsx:1673:                      <FileInspectorActionBar
src/pages/ProjectSpacePage.tsx:1693:                          void onDetachInspectorAttachment(selectedAttachmentId);
src/pages/ProjectSpacePage.tsx:1710:                  <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={onAttachFile}>
src/services/hub/records.ts:607:export const attachFile = async (
src/services/hub/records.ts:632:export const detachFile = async (
```

### Every callsite

| Frontend callsite | API function used | User action that triggers it | Surface | Evidence |
| --- | --- | --- | --- | --- |
| `useRecordInspector.onAttachFile()` | `attachFile` | User selects a file in the record inspector attachment form and submits the `Attach` button. The hook first uploads bytes with `uploadFile`, then calls `attachFile` to create the durable record-to-file link. | Record inspector | `src/hooks/useRecordInspector.ts:373-426`, `src/pages/ProjectSpacePage.tsx:1709-1718` |
| `useRecordInspector.onDetachInspectorAttachment()` | `detachFile` | User clicks `Remove` in `FileInspectorActionBar`, confirms the dialog, and the hook detaches the selected attachment. | Record inspector | `src/hooks/useRecordInspector.ts:465-500`, `src/components/project-space/FileInspectorActionBar.tsx:192-204`, `src/pages/ProjectSpacePage.tsx:1672-1694` |
| `useRecordInspector.relinkInspectorAttachment()` | `attachFile`, then `detachFile` | Internal helper used for attachment “rename” and “move”. It creates a replacement attachment row, then deletes the original row. | Record inspector only | `src/hooks/useRecordInspector.ts:505-574` |
| `useRecordInspector.relinkInspectorAttachment()` rollback path | `detachFile` | Triggered only if the replacement attach succeeds but the inspector request version becomes stale or the old-row delete fails; it removes the replacement row as rollback. | Record inspector only | `src/hooks/useRecordInspector.ts:540-555` |
| `useRecordInspector.onRenameInspectorAttachment()` | Indirect via `relinkInspectorAttachment()` | User opens `Rename` in `FileInspectorActionBar`, submits a new filename, which causes a new attachment row to be attached and the old row detached. | Record inspector | `src/hooks/useRecordInspector.ts:576-600`, `src/components/project-space/FileInspectorActionBar.tsx:122-189`, `src/pages/ProjectSpacePage.tsx:1685-1688` |
| `useRecordInspector.onMoveInspectorAttachment()` | Indirect via `relinkInspectorAttachment()` | User opens `Move` in `FileInspectorActionBar`, picks a pane in `FileMovePopover`, and confirms; the hook rewrites attachment metadata by re-attaching then detaching. | Record inspector | `src/hooks/useRecordInspector.ts:603-632`, `src/components/project-space/FileInspectorActionBar.tsx:108-120`, `src/components/project-space/FileMovePopover.tsx:61-104`, `src/pages/ProjectSpacePage.tsx:1689-1691` |

### Scope of usage

- I found no `attachFile` or `detachFile` callsites outside `src/hooks/useRecordInspector.ts`. (`src/hooks/useRecordInspector.ts:11-12`, `src/services/hub/records.ts:607-649`)
- I found no `attachFile`/`detachFile` usage in the Files module path. `WorkView` wires `FilesModuleSkin` only to `projectFiles`, `paneFiles`, `onUploadProjectFiles`, `onUploadPaneFiles`, and `onOpenFile`. (`src/components/project-space/WorkView.tsx:579-588`)

## Section 3 — Is `entity_attachments` data ever displayed?

### Where attachment data is read

- The backend record detail builder reads `entity_attachments` rows and includes them as `attachments` in the record payload. (`apps/hub-api/hub-api.mjs:2304-2320`)
- The frontend type for `HubRecordDetail` includes an `attachments` array with `attachment_id`, name, MIME type, metadata, and `proxy_url`. (`src/services/hub/types.ts:217-228`)
- `getRecordDetail()` returns that `HubRecordDetail` payload and `useRecordInspector` stores it as `inspectorRecord`. (`src/services/hub/records.ts:51-61`, `src/hooks/useRecordInspector.ts:59-81`)

### Where attachment data is rendered

| UI location | What is shown | Visible to users now? | Evidence |
| --- | --- | --- | --- |
| `ProjectSpacePage` attachments section | An “Attachments” panel inside the record inspector. If attachments exist, each attachment name is rendered as a selectable button. | Yes | `src/pages/ProjectSpacePage.tsx:1646-1669` |
| `ProjectSpacePage` + `FileInspectorActionBar` | For the selected attachment, users get `Download`, `Copy link`, and, when editable, `Move`, `Rename`, and `Remove`. | Yes | `src/pages/ProjectSpacePage.tsx:1672-1695`, `src/components/project-space/FileInspectorActionBar.tsx:92-204` |
| `ProjectSpacePage` attachment summary list | Every attachment is also rendered in a list as `name (mime_type)`. | Yes | `src/pages/ProjectSpacePage.tsx:1698-1703` |
| `ProjectSpacePage` empty state | If no attachments exist, users see “No attachments yet.” | Yes | `src/pages/ProjectSpacePage.tsx:1706-1708` |
| `useRecordInspector` selection logic | Automatically selects the first attachment row so the action bar can render. | Indirectly yes; this affects visible UI state. | `src/hooks/useRecordInspector.ts:168-179` |

### Conclusion

- `entity_attachments` data is not just fetched; it is plainly visible in the record inspector today through the attachment buttons, the attachment summary list, and the action bar for the selected attachment. (`src/pages/ProjectSpacePage.tsx:1646-1708`, `src/components/project-space/FileInspectorActionBar.tsx:92-204`)

## Section 4 — What breaks if `entity_attachments` is removed?

If the table, the two attachment routes, and the frontend `attachFile`/`detachFile` functions were removed, these user-visible and code-level pieces would break:

### Backend breakage

1. The record detail builder would no longer have a source for `attachments`, because it currently reads them only from `attachmentsByEntityStmt`. (`apps/hub-api/hub-api.mjs:1481-1486`, `apps/hub-api/hub-api.mjs:2304-2320`)
2. `GET /api/hub/records/:recordId` would stop returning the attachment data that the frontend expects unless `recordDetail()` and the `HubRecordDetail` contract were changed. (`apps/hub-api/hub-api.mjs:4670-4691`, `src/services/hub/types.ts:217-228`)
3. `PATCH /api/hub/records/:recordId` also returns `recordDetail(...)`, so its response shape would likewise change. (`apps/hub-api/hub-api.mjs:4615-4666`, `apps/hub-api/hub-api.mjs:2304-2320`)

### Frontend breakage

1. `useRecordInspector` would fail to compile if `attachFile` and `detachFile` were deleted, because it imports and calls both directly. (`src/hooks/useRecordInspector.ts:3-15`, `src/hooks/useRecordInspector.ts:414-426`, `src/hooks/useRecordInspector.ts:478-479`, `src/hooks/useRecordInspector.ts:527-555`)
2. The record inspector “Attach” form would stop working, because its submit handler is `onAttachFile`, and that handler’s durable link creation step is `attachFile(...)`. (`src/pages/ProjectSpacePage.tsx:1709-1718`, `src/hooks/useRecordInspector.ts:373-426`)
3. The record inspector “Remove” action would stop working, because it calls `onDetachInspectorAttachment`, which calls `detachFile(...)`. (`src/pages/ProjectSpacePage.tsx:1672-1694`, `src/hooks/useRecordInspector.ts:465-500`)
4. The record inspector “Rename” action would stop working, because it is implemented as re-attach + detach through `relinkInspectorAttachment()`. (`src/components/project-space/FileInspectorActionBar.tsx:122-189`, `src/hooks/useRecordInspector.ts:505-600`)
5. The record inspector “Move” action would stop working for the same reason: it is implemented as re-attach + detach with modified metadata. (`src/components/project-space/FileInspectorActionBar.tsx:108-120`, `src/components/project-space/FileMovePopover.tsx:61-104`, `src/hooks/useRecordInspector.ts:603-632`)
6. The visible attachment list and attachment action bar would disappear unless the inspector were rewritten to source attachment-like data from somewhere else. Right now they render `inspectorRecord.attachments`. (`src/pages/ProjectSpacePage.tsx:1648-1703`, `src/hooks/useRecordInspector.ts:168-179`)

### What would not break directly

- The Files module would not directly break, because it does not use `attachFile`, `detachFile`, or `record.attachments`; it renders tracked files from the `files` runtime. (`src/components/project-space/WorkView.tsx:579-588`)
- Raw file uploads through `uploadFile` would still be possible in other flows, but record-to-file linkage would disappear. `useRecordInspector.onAttachFile()` already shows that uploads and attachments are two separate steps. (`src/hooks/useRecordInspector.ts:395-426`)

### Would visible data disappear?

- Yes. Any attachment currently visible in the record inspector would disappear from the UI if `recordDetail()` stopped producing `attachments` and no replacement source were added. (`apps/hub-api/hub-api.mjs:2304-2320`, `src/pages/ProjectSpacePage.tsx:1648-1708`)

## Section 5 — Recommendation

### Is `entity_attachments` load-bearing?

Yes. `entity_attachments` is currently load-bearing.

Why:

1. It is the only persisted record-to-file relation I found. The `files` table has no `entity_type` or `entity_id` columns; it stores only project/root/provider/path/name metadata. (`apps/hub-api/hub-api.mjs:663-679`)
2. The frontend inspector upload flow does send `attached_entity_type` and `attached_entity_id` in the upload metadata, but the backend upload route inserts `toJson({})` into `files.metadata_json`, so that relation is not persisted in `files`. (`src/hooks/useRecordInspector.ts:396-408`, `apps/hub-api/hub-api.mjs:5951-5963`)
3. The record inspector reads attachments from `record.attachments`, and that array is populated from `entity_attachments`, not from `files`. (`apps/hub-api/hub-api.mjs:2304-2320`, `src/pages/ProjectSpacePage.tsx:1648-1708`)

### Can it be safely removed now?

No, not safely. Removing it would delete the only durable link between records and uploaded assets in the current implementation. (`apps/hub-api/hub-api.mjs:663-679`, `apps/hub-api/hub-api.mjs:688-705`, `apps/hub-api/hub-api.mjs:2304-2320`, `apps/hub-api/hub-api.mjs:5951-5963`)

### Minimum path to make the inspector read from the `files` table instead

The minimum viable path is not just “change one query.” It requires first creating a durable relation inside `files`, because the current upload path drops the record-link metadata.

Minimum sequence:

1. Persist attachment linkage in `files.metadata_json` during `POST /api/hub/files/upload` instead of writing `{}`. The frontend already sends `attached_entity_type` and `attached_entity_id` from the inspector upload flow. (`src/hooks/useRecordInspector.ts:396-408`, `apps/hub-api/hub-api.mjs:5951-5963`)
2. Add a backend read path that queries `files` by that persisted metadata and maps rows into the same `attachments` shape currently returned by `recordDetail()`. Today `recordDetail()` reads only `entity_attachments`. (`apps/hub-api/hub-api.mjs:2304-2320`)
3. Only after that replacement exists could the frontend attachment UI keep rendering without `entity_attachments`, because `ProjectSpacePage` and `useRecordInspector` both depend on `inspectorRecord.attachments`. (`src/hooks/useRecordInspector.ts:168-179`, `src/pages/ProjectSpacePage.tsx:1648-1708`)
4. Rename and move semantics would still need a replacement design. Right now they are implemented by creating and deleting attachment rows, not by mutating `files` rows. (`src/hooks/useRecordInspector.ts:505-632`)

### If removal were attempted anyway, which files would need changes?

At minimum, these files are directly coupled to the current attachment system:

- `apps/hub-api/hub-api.mjs`
  Because it defines the table, prepared statements, routes, and record-detail attachment embedding. (`apps/hub-api/hub-api.mjs:688-705`, `apps/hub-api/hub-api.mjs:1462-1487`, `apps/hub-api/hub-api.mjs:2304-2320`, `apps/hub-api/hub-api.mjs:6016-6182`)
- `src/services/hub/records.ts`
  Because it exports `attachFile` and `detachFile`. (`src/services/hub/records.ts:607-649`)
- `src/services/hub/types.ts`
  Because `HubRecordDetail` currently includes the `attachments` array shape. (`src/services/hub/types.ts:217-228`)
- `src/hooks/useRecordInspector.ts`
  Because it imports `attachFile`/`detachFile`, manages `selectedAttachmentId`, and implements attach/remove/rename/move around those APIs. (`src/hooks/useRecordInspector.ts:3-15`, `src/hooks/useRecordInspector.ts:168-179`, `src/hooks/useRecordInspector.ts:373-633`)
- `src/pages/ProjectSpacePage.tsx`
  Because it renders the visible attachments panel, attach form, and action handlers. (`src/pages/ProjectSpacePage.tsx:1646-1718`)
- `src/components/project-space/FileInspectorActionBar.tsx`
  Because it renders the attachment actions surface. (`src/components/project-space/FileInspectorActionBar.tsx:92-204`)
- `src/components/project-space/FileMovePopover.tsx`
  Because it is the attachment “Move” UI. (`src/components/project-space/FileMovePopover.tsx:53-107`)
