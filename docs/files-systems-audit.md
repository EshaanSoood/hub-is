# Files Systems Audit

Compile check: `npx tsc --noEmit` completed successfully with no output on 2026-03-10.

## Section 1 — Every file-related API endpoint

### Route inventory

| Method | URL pattern | What it does | Storage touched | Evidence |
| --- | --- | --- | --- | --- |
| `POST` | `/api/hub/files/upload` | Uploads bytes to Nextcloud, inserts a tracked `files` row plus a `file_blobs.storage_pointer` record, and returns a proxy URL. | Both Nextcloud and SQLite | `apps/hub-api/hub-api.mjs:5918-6008`, `apps/hub-api/hub-api.mjs:663-685`, `apps/hub-api/hub-api.mjs:1451-1460` |
| `POST` | `/api/hub/attachments` | Creates an attachment reference for an entity by writing an `entity_attachments` row that points at an existing asset path. | SQLite only | `apps/hub-api/hub-api.mjs:6016-6137`, `apps/hub-api/hub-api.mjs:688-705`, `apps/hub-api/hub-api.mjs:1462-1495` |
| `DELETE` | `/api/hub/attachments/:attachmentId` | Deletes an attachment reference row and emits a `file.detached` timeline event. | SQLite only | `apps/hub-api/hub-api.mjs:6140-6182`, `apps/hub-api/hub-api.mjs:1481-1486` |
| `GET` | `/api/hub/projects/:projectId/asset-roots` | Lists configured asset roots for a project. | SQLite only | `apps/hub-api/hub-api.mjs:6185-6208`, `apps/hub-api/hub-api.mjs:707-715`, `apps/hub-api/hub-api.mjs:1500-1501` |
| `POST` | `/api/hub/projects/:projectId/asset-roots` | Creates a project asset root; V1 only accepts `nextcloud`. | SQLite only | `apps/hub-api/hub-api.mjs:6212-6247`, `apps/hub-api/hub-api.mjs:1497-1501` |
| `GET` | `/api/hub/projects/:projectId/files` | Lists tracked files from the `files` table, optionally filtered to `scope=pane` using derived `pane_id`. | SQLite only | `apps/hub-api/hub-api.mjs:6251-6288`, `apps/hub-api/hub-api.mjs:2459-2484`, `apps/hub-api/hub-api.mjs:1456-1460` |
| `GET` | `/api/hub/projects/:projectId/assets/list` | Uses `asset_roots` to find a Nextcloud root, then issues a `PROPFIND` to list raw provider assets and builds proxy URLs. | Both Nextcloud and SQLite | `apps/hub-api/hub-api.mjs:6292-6368`, `apps/hub-api/hub-api.mjs:3291-3309`, `apps/hub-api/hub-api.mjs:3364-3368` |
| `POST` | `/api/hub/projects/:projectId/assets/upload` | Uploads bytes directly into a Nextcloud asset root and returns `{ uploaded, path, proxy_url }`, but does not insert a tracked `files` row. | Both Nextcloud and SQLite | `apps/hub-api/hub-api.mjs:6371-6453`, `apps/hub-api/hub-api.mjs:3291-3313`, `apps/hub-api/hub-api.mjs:3315-3362` |
| `DELETE` | `/api/hub/projects/:projectId/assets/delete` | Deletes a raw asset from Nextcloud by provider path. | Both Nextcloud and SQLite | `apps/hub-api/hub-api.mjs:6456-6510`, `apps/hub-api/hub-api.mjs:3291-3313` |
| `GET` | `/api/hub/projects/:projectId/assets/proxy` | Streams asset bytes from Nextcloud through the Hub API after project access checks. | Both Nextcloud and SQLite | `apps/hub-api/hub-api.mjs:6513-6560`, `apps/hub-api/hub-api.mjs:3364-3368` |
| `GET` | `/api/hub/records/:recordId` | Returns a record detail payload that includes attachment rows read from `entity_attachments`; this is the only attachment read path I found. | SQLite only | `apps/hub-api/hub-api.mjs:4615-4691`, `apps/hub-api/hub-api.mjs:2304-2319`, `apps/hub-api/hub-api.mjs:1481-1486` |

### Schema and helper observations that matter to the routes

- `files`, `file_blobs`, `entity_attachments`, and `asset_roots` are separate SQLite tables. `file_blobs` does not store bytes; it stores a `storage_pointer` string, and the upload route writes JSON describing the Nextcloud path into that field. That means the real file bytes still live in Nextcloud, not SQLite. (`apps/hub-api/hub-api.mjs:663-715`, `apps/hub-api/hub-api.mjs:5965-5971`)
- `GET /api/hub/projects/:projectId/files` derives `pane_id` from `files.metadata_json.pane_id` or from the provider path pattern `Pane Files/:paneId/...`. (`apps/hub-api/hub-api.mjs:2459-2478`)
- `POST /api/hub/files/upload` currently ignores `body.metadata` and stores `{}` in `files.metadata_json`; it also does not include `metadata` in the response payload. That is a contract mismatch with the frontend callers that send metadata. (`apps/hub-api/hub-api.mjs:5951-5963`, `apps/hub-api/hub-api.mjs:5995-6008`)

### Requested grep output

Command run:

```bash
grep -n "nextcloud\|Nextcloud\|NEXTCLOUD\|asset_root\|assetRoot\|uploadFile\|listTrackedFiles\|listAssets\|attachFile\|detachFile\|file_id\|files/upload\|/files" apps/hub-api/hub-api.mjs | head -80
```

Relevant output:

```text
15:const NEXTCLOUD_BASE_URL = (process.env.NEXTCLOUD_BASE_URL || '').trim();
16:const NEXTCLOUD_USER = (process.env.NEXTCLOUD_USER || '').trim();
17:const NEXTCLOUD_APP_PASSWORD = (process.env.NEXTCLOUD_APP_PASSWORD || '').trim();
398:  'asset_roots',
664:        file_id TEXT PRIMARY KEY,
666:        asset_root_id TEXT NOT NULL,
677:        FOREIGN KEY(asset_root_id) REFERENCES asset_roots(asset_root_id) ON DELETE CASCADE,
682:        file_id TEXT PRIMARY KEY,
685:        FOREIGN KEY(file_id) REFERENCES files(file_id) ON DELETE CASCADE
694:        asset_root_id TEXT NOT NULL,
703:        FOREIGN KEY(asset_root_id) REFERENCES asset_roots(asset_root_id) ON DELETE CASCADE,
707:      CREATE TABLE asset_roots (
708:        asset_root_id TEXT PRIMARY KEY,
953:      CREATE INDEX idx_attachments_asset_lookup ON entity_attachments(asset_root_id, asset_path);
954:      CREATE INDEX idx_files_project_asset_path ON files(project_id, asset_root_id, provider_path);
1451:  INSERT INTO files (file_id, project_id, asset_root_id, provider, provider_path, name, mime_type, size_bytes, hash, metadata_json, created_by, created_at)
1458:  ORDER BY created_at DESC, file_id DESC
1460:const insertFileBlobStmt = db.prepare('INSERT INTO file_blobs (file_id, storage_pointer, created_at) VALUES (?, ?, ?)');
1490:  FROM asset_roots
1497:  INSERT INTO asset_roots (asset_root_id, project_id, provider, root_path, connection_ref, created_at, updated_at)
1500:const assetRootsByProjectStmt = db.prepare('SELECT * FROM asset_roots WHERE project_id = ? ORDER BY created_at ASC');
1501:const assetRootByIdStmt = db.prepare('SELECT * FROM asset_roots WHERE asset_root_id = ?');
3039:      'nextcloud',
3041:      toJson({ provider: 'nextcloud' }),
3275:const safeNextcloudConfig = () => Boolean(NEXTCLOUD_BASE_URL && NEXTCLOUD_USER && NEXTCLOUD_APP_PASSWORD);
3277:const nextcloudAuthHeader = () =>
3278:  `Basic ${Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_APP_PASSWORD}`, 'utf8').toString('base64')}`;
3280:const nextcloudUrl = (rootPath, relativePath) => {
3288:  return `${NEXTCLOUD_BASE_URL.replace(/\/$/, '')}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}${encoded}`;
3294:    const root = assetRootByIdStmt.get(requestedId);
3298:    if (root.provider !== 'nextcloud') {
3299:      return { error: { status: 400, code: 'invalid_input', message: 'Only nextcloud asset roots are supported in V1.' } };
3306:    return { error: { status: 400, code: 'asset_root_required', message: 'Create an asset root before uploading files.' } };
3308:  if (root.provider !== 'nextcloud') {
3309:    return { error: { status: 400, code: 'invalid_input', message: 'Only nextcloud asset roots are supported in V1.' } };
3315:const uploadToNextcloud = async ({ rootPath, relativePath, mimeType, content }) => {
3316:  if (!safeNextcloudConfig()) {
3317:    return { error: { status: 503, code: 'nextcloud_unavailable', message: 'Nextcloud runtime credentials are not configured.' } };
3328:    const mkcolUrl = nextcloudUrl('/', currentDir);
3332:        Authorization: nextcloudAuthHeader(),
3341:          message: `Nextcloud folder create failed (${mkcolResponse.status}).`,
3347:  const targetUrl = nextcloudUrl(rootPath, normalized);
3351:      Authorization: nextcloudAuthHeader(),
3358:    return { error: { status: 502, code: 'upstream_error', message: `Nextcloud upload failed (${upstream.status}).` } };
3364:const buildAssetProxyPath = ({ projectId, assetRootId, assetPath }) => {
3366:  params.set('asset_root_id', assetRootId);
3394:            nextcloud_configured: safeNextcloudConfig(),
5876:    if (request.method === 'POST' && pathname === '/api/hub/files/upload') {
5918:      const rootResult = resolveProjectAssetRoot(projectId, body.asset_root_id);
5935:      const uploadResult = await uploadToNextcloud({
5954:        root.asset_root_id,
5955:        'nextcloud',
5968:          provider: 'nextcloud',
5969:          asset_root_id: root.asset_root_id,
5984:          provider: 'nextcloud',
5985:          asset_root_id: root.asset_root_id,
5996:              file_id: fileId,
5998:              asset_root_id: root.asset_root_id,
5999:              provider: 'nextcloud',
6006:                assetRootId: root.asset_root_id,
6034:      const provider = asText(body.provider) || 'nextcloud';
6035:      const assetRootId = asText(body.asset_root_id);
6038:      if (!projectId || !entityType || !entityId || !provider || !assetRootId || !assetPath) {
6045:              'project_id, entity_type, entity_id, provider, asset_root_id, asset_path are required.',
6062:      const root = assetRootByIdStmt.get(assetRootId);
6084:        assetRootId,
6104:          asset_root_id: assetRootId,
6122:              asset_root_id: assetRootId,
6130:                assetRootId,
6176:          asset_root_id: attachment.asset_root_id,
6199:      const roots = assetRootsByProjectStmt.all(projectId).map((root) => ({
6200:        asset_root_id: root.asset_root_id,
6208:      send(response, jsonResponse(200, okEnvelope({ asset_roots: roots })));
6233:      const provider = asText(body.provider) || 'nextcloud';
```

## Section 2 — Every file-related frontend service function

### Exported service functions

| Service function | Signature | Endpoint called | Notes | Evidence |
| --- | --- | --- | --- | --- |
| `uploadFile` | `(accessToken, payload)` | `POST /api/hub/files/upload` | Used by file module uploads, record-attachment uploads, and doc asset uploads. | `src/services/hub/files.ts:5-48` |
| `listTrackedFiles` | `(accessToken, projectId, options?)` | `GET /api/hub/projects/:projectId/files` | Lists tracked files for `scope=project` or `scope=pane`. | `src/services/hub/files.ts:50-69` |
| `listAssetRoots` | `(accessToken, projectId)` | `GET /api/hub/projects/:projectId/asset-roots` | Reads project asset root configuration. | `src/services/hub/files.ts:71-99` |
| `createAssetRoot` | `(accessToken, projectId, payload)` | `POST /api/hub/projects/:projectId/asset-roots` | Creates a Nextcloud-backed asset root. | `src/services/hub/files.ts:101-110` |
| `listAssets` | `(accessToken, projectId, assetRootId, path)` | `GET /api/hub/projects/:projectId/assets/list` | Lists raw provider assets under an asset root. | `src/services/hub/files.ts:112-128` |
| `getRecordDetail` | `(accessToken, recordId, options?)` | `GET /api/hub/records/:recordId` | File-related because record detail includes `attachments` in the payload shape. | `src/services/hub/records.ts:51-61`, `src/services/hub/types.ts:217-226` |
| `attachFile` | `(accessToken, payload)` | `POST /api/hub/attachments` | Creates a record/entity attachment reference. | `src/services/hub/records.ts:607-630` |
| `detachFile` | `(accessToken, attachmentId, options?)` | `DELETE /api/hub/attachments/:attachmentId` | Removes an attachment reference. | `src/services/hub/records.ts:632-649` |
| `listRecentFiles` | `()` | None | Legacy/mock Nextcloud service; returns mock data or blocked reasons and does not call Hub API routes. | `src/services/nextcloudService.ts:5-18` |
| `createFolder` | `(folderName)` | None | Legacy/mock stub only. | `src/services/nextcloudService.ts:20-35` |
| `generateShareLink` | `(fileId)` | None | Legacy/mock stub only. | `src/services/nextcloudService.ts:37-62` |
| `requestDownloadBundle` | `()` | None | Legacy/mock stub only. | `src/services/nextcloudService.ts:64-76` |
| `uploadFile` in `nextcloudService.ts` | `(file)` | None | Legacy/mock stub only; unrelated to `src/services/hub/files.ts`. | `src/services/nextcloudService.ts:78-100` |

### Important omissions

- I found backend routes for `POST /api/hub/projects/:projectId/assets/upload` and `DELETE /api/hub/projects/:projectId/assets/delete`, but no frontend service wrapper for either route. `src/services/hub/files.ts` exports only `uploadFile`, `listTrackedFiles`, `listAssetRoots`, `createAssetRoot`, and `listAssets`. (`apps/hub-api/hub-api.mjs:6371-6510`, `src/services/hub/files.ts:5-128`)
- The frontend `uploadFile` service type includes optional `metadata`, but the backend upload route does not persist or echo it. (`src/services/hub/files.ts:7-16`, `apps/hub-api/hub-api.mjs:5951-5963`, `apps/hub-api/hub-api.mjs:5995-6008`)

### Requested grep output

Command run:

```bash
grep -rn "upload\|file\|asset\|attach\|nextcloud" src/services/hub/ --include="*.ts" | grep -i "export\|function\|const.*="
```

Output:

```text
src/services/hub/records.ts:607:export const attachFile = async (
src/services/hub/index.ts:10:export * from './files';
src/services/hub/files.ts:5:export const uploadFile = async (
src/services/hub/files.ts:63:  const data = await hubRequest<{ files: HubTrackedFile[] }>(
```

## Section 3 — Every file-related UI component

### Requested grep output

Command run:

```bash
grep -rln "file\|upload\|asset\|attach\|FilesModule\|FileInspector" src/components/ src/features/ src/pages/ --include="*.tsx"
```

Output:

```text
src/components/project-space/FileInspectorActionBar.tsx
src/components/project-space/TimelineFeed.tsx
src/components/project-space/OverviewView.tsx
src/components/project-space/ModuleGrid.tsx
src/components/project-space/WorkView.tsx
src/components/project-space/FilesModuleSkin.tsx
src/components/auth/ProfilePanel.tsx
src/components/layout/AppShell.tsx
src/features/notes/CollaborativeLexicalEditor.tsx
src/pages/ProjectSpacePage.tsx
```

### Component-by-component notes

| File | What it does | Wiring classification | Evidence |
| --- | --- | --- | --- |
| `src/components/project-space/FilesModuleSkin.tsx` | Renders the actual Files module UI: drag/drop upload entry, file sorting/filtering, upload progress, and file open actions. | (a) Nextcloud/asset-root tracked-files system | `src/components/project-space/FilesModuleSkin.tsx:16-21`, `src/components/project-space/FilesModuleSkin.tsx:499-517` |
| `src/components/project-space/WorkView.tsx` | Wires the `files` module type to `FilesModuleSkin`, passing `projectFiles`, `paneFiles`, upload handlers, and `readOnly`. | (a) Nextcloud/asset-root tracked-files system | `src/components/project-space/WorkView.tsx:86-92`, `src/components/project-space/WorkView.tsx:579-588` |
| `src/pages/ProjectSpacePage.tsx` | Hosts three file surfaces: the work-view file runtime, the Tools-tab asset-root browser/listing UI, and the record attachment UI; it also hosts the doc asset upload form. | (b) record attachments and (a) asset-root/tracked-files, so effectively (c) both | `src/pages/ProjectSpacePage.tsx:264-285`, `src/pages/ProjectSpacePage.tsx:1423-1431`, `src/pages/ProjectSpacePage.tsx:1517-1562`, `src/pages/ProjectSpacePage.tsx:1646-1718` |
| `src/components/project-space/FileInspectorActionBar.tsx` | Renders attachment actions for a selected record attachment: download, copy link, move, rename, and remove. | (b) record attachment system | `src/components/project-space/FileInspectorActionBar.tsx:5-13`, `src/components/project-space/FileInspectorActionBar.tsx:92-204` |
| `src/components/project-space/FileMovePopover.tsx` | Renders the pane picker used by the attachment “Move” action. | (b) record attachment system | `src/components/project-space/FileMovePopover.tsx:3-10`, `src/components/project-space/FileMovePopover.tsx:53-107`, `src/components/project-space/FileInspectorActionBar.tsx:108-120` |
| `src/components/project-space/ModuleGrid.tsx` | Renders pane module cards and the “Add module: Files” structural button, but it does not itself upload/list bytes. | (d) unclear / structural only | `src/components/project-space/ModuleGrid.tsx:32-45`, `src/components/project-space/ModuleGrid.tsx:112-127` |
| `src/features/notes/CollaborativeLexicalEditor.tsx` | Accepts `pendingAssetEmbed` and inserts `Asset: <label> (<reference>)` text into the doc; it renders the result of doc asset uploads but does not perform the upload itself. | (a) Nextcloud/asset-root system, via doc asset embedding | `src/features/notes/CollaborativeLexicalEditor.tsx:37-56`, `src/features/notes/CollaborativeLexicalEditor.tsx:95-117` |
| `src/components/project-space/TimelineFeed.tsx` | Not a file manager; it only provides a “Files” timeline filter for `TimelineEventType = 'file'`. | (d) unclear / incidental | `src/components/project-space/TimelineFeed.tsx:3-4`, `src/components/project-space/TimelineFeed.tsx:31-37`, `src/components/project-space/TimelineFeed.tsx:61-78` |
| `src/components/project-space/OverviewView.tsx` | Not wired to live file APIs; the grep hit is a mock string “Uploaded campaign assets”. | (d) unclear / incidental | `src/components/project-space/OverviewView.tsx:36-43` |
| `src/components/auth/ProfilePanel.tsx` | Not file-related; grep matched “profile”. | (d) unclear / incidental false positive | `src/components/auth/ProfilePanel.tsx:12-18`, `src/components/auth/ProfilePanel.tsx:31-45` |
| `src/components/layout/AppShell.tsx` | Not file-related; grep matched account-profile UI text. | (d) unclear / incidental false positive | `src/components/layout/AppShell.tsx:785-810` |

## Section 4 — Every file-related hook

| Hook | File-related calls | State it manages | UI that consumes it | Evidence |
| --- | --- | --- | --- | --- |
| `useProjectFilesRuntime` | Calls `listAssetRoots`, `createAssetRoot`, `listAssets`, `listTrackedFiles`, and `uploadFile`; exposes `ensureProjectAssetRoot`, upload handlers, asset-root handlers, and open-file behavior. | `assetRoots`, `assetEntries`, `assetWarning`, `newAssetRootPath`, pending/tracked project file lists, pending/tracked pane file lists, upload/removal timers, and in-flight asset-root creation. | Consumed by `ProjectSpacePage`, which passes its file runtime into `WorkView` and renders the Tools-tab asset-root UI. | `src/hooks/useProjectFilesRuntime.ts:1-8`, `src/hooks/useProjectFilesRuntime.ts:89-100`, `src/hooks/useProjectFilesRuntime.ts:102-138`, `src/hooks/useProjectFilesRuntime.ts:140-171`, `src/hooks/useProjectFilesRuntime.ts:216-438`, `src/hooks/useProjectFilesRuntime.ts:466-480`, `src/pages/ProjectSpacePage.tsx:264-285`, `src/pages/ProjectSpacePage.tsx:680-686`, `src/pages/ProjectSpacePage.tsx:1517-1562` |
| `useRecordInspector` | Calls `uploadFile`, `attachFile`, `detachFile`, and `getRecordDetail` for attachment workflows; also refreshes timeline and tracked project files afterward. | `uploadingAttachment`, `selectedAttachmentId`, `inspectorRecord`, `inspectorError`, `inspectorMutationPaneId`, plus other inspector state. | Consumed by `ProjectSpacePage` record inspector, `FileInspectorActionBar`, and the attachment upload form. | `src/hooks/useRecordInspector.ts:3-15`, `src/hooks/useRecordInspector.ts:44-81`, `src/hooks/useRecordInspector.ts:393-450`, `src/hooks/useRecordInspector.ts:462-498`, `src/hooks/useRecordInspector.ts:527-557`, `src/hooks/useRecordInspector.ts:603-632`, `src/pages/ProjectSpacePage.tsx:403-416`, `src/pages/ProjectSpacePage.tsx:1646-1718` |
| `useWorkspaceDocRuntime` | Calls `uploadFile` during `onUploadDocAsset`, then sets `pendingDocAssetEmbed`, refreshes tracked project files, and refreshes timeline. | `uploadingDocAsset`, `pendingDocAssetEmbed`, plus doc-collaboration/comment state. | Consumed by `ProjectSpacePage` doc upload form and `CollaborativeLexicalEditor`. | `src/hooks/useWorkspaceDocRuntime.ts:1-18`, `src/hooks/useWorkspaceDocRuntime.ts:417-460`, `src/pages/ProjectSpacePage.tsx:570-587`, `src/pages/ProjectSpacePage.tsx:1352-1355`, `src/pages/ProjectSpacePage.tsx:1423-1431`, `src/features/notes/CollaborativeLexicalEditor.tsx:37-56`, `src/features/notes/CollaborativeLexicalEditor.tsx:95-117` |

## Section 5 — Map the systems

### System A: Tracked project/pane files

- Purpose: This is the file system behind the Files module and the doc-asset uploader. It tracks uploads in SQLite and serves them back through `GET /projects/:projectId/files`. (`src/components/project-space/FilesModuleSkin.tsx:499-517`, `src/components/project-space/WorkView.tsx:579-588`, `src/hooks/useWorkspaceDocRuntime.ts:417-460`)
- Backend: Uses `files`, `file_blobs`, and `asset_roots`; routes are `POST /api/hub/files/upload`, `GET /api/hub/projects/:projectId/files`, and shared proxy access through `GET /api/hub/projects/:projectId/assets/proxy`. (`apps/hub-api/hub-api.mjs:663-685`, `apps/hub-api/hub-api.mjs:707-715`, `apps/hub-api/hub-api.mjs:5918-6008`, `apps/hub-api/hub-api.mjs:6251-6288`, `apps/hub-api/hub-api.mjs:6513-6560`)
- Frontend: Service functions are `uploadFile` and `listTrackedFiles`; the main hook is `useProjectFilesRuntime`, with `useWorkspaceDocRuntime` reusing `uploadFile` for doc embeds; the UI is `FilesModuleSkin` via `WorkView`, plus the doc upload form in `ProjectSpacePage`. (`src/services/hub/files.ts:5-69`, `src/hooks/useProjectFilesRuntime.ts:102-405`, `src/hooks/useWorkspaceDocRuntime.ts:417-460`, `src/components/project-space/FilesModuleSkin.tsx:499-517`, `src/components/project-space/WorkView.tsx:579-588`, `src/pages/ProjectSpacePage.tsx:1423-1431`)
- Storage: Actual bytes live in Nextcloud; SQLite stores the tracked metadata and a `storage_pointer` JSON blob, not the binary itself. (`apps/hub-api/hub-api.mjs:681-685`, `apps/hub-api/hub-api.mjs:5965-5971`)
- Current status: Partially working. The primary flow is wired end-to-end, but the backend ignores upload `metadata`, while the frontend and regression tests expect it to be preserved/echoed. (`src/services/hub/files.ts:7-16`, `src/hooks/useProjectFilesRuntime.ts:257-267`, `src/hooks/useProjectFilesRuntime.ts:354-366`, `apps/hub-api/hub-api.mjs:5951-5963`, `scripts/hub-provenance-regression.test.mjs:610-620`, `scripts/hub-provenance-regression.test.mjs:780-785`)

### System B: Asset library / raw Nextcloud browser

- Purpose: This is a project-level asset-root management system for browsing raw provider contents under a configured Nextcloud root. The Tools tab exposes root creation and “List assets”; the backend also has raw upload/delete routes. (`src/pages/ProjectSpacePage.tsx:1517-1562`, `src/hooks/useProjectFilesRuntime.ts:102-138`, `src/hooks/useProjectFilesRuntime.ts:413-438`)
- Backend: Uses `asset_roots` plus shared proxy helpers; routes are `GET/POST /projects/:projectId/asset-roots`, `GET /projects/:projectId/assets/list`, `POST /projects/:projectId/assets/upload`, `DELETE /projects/:projectId/assets/delete`, and `GET /projects/:projectId/assets/proxy`. (`apps/hub-api/hub-api.mjs:707-715`, `apps/hub-api/hub-api.mjs:6185-6247`, `apps/hub-api/hub-api.mjs:6292-6560`)
- Frontend: Service functions are `listAssetRoots`, `createAssetRoot`, and `listAssets`. `useProjectFilesRuntime` consumes them. The only visible UI is the Tools-tab “Asset Library Roots” panel in `ProjectSpacePage`. I found no frontend wrapper for the backend’s `/assets/upload` or `/assets/delete` routes. (`src/services/hub/files.ts:71-128`, `src/hooks/useProjectFilesRuntime.ts:102-138`, `src/hooks/useProjectFilesRuntime.ts:413-438`, `src/pages/ProjectSpacePage.tsx:1517-1562`)
- Storage: Actual bytes live in Nextcloud; SQLite stores only root configuration. (`apps/hub-api/hub-api.mjs:707-715`, `apps/hub-api/hub-api.mjs:6371-6453`, `apps/hub-api/hub-api.mjs:6456-6510`)
- Current status: Partially working. Read/list configuration is wired. Raw upload/delete exist in the backend but are not wired in the frontend service layer. (`apps/hub-api/hub-api.mjs:6371-6510`, `src/services/hub/files.ts:5-128`)

### System C: Record/entity attachments

- Purpose: This system attaches an existing asset path to an entity, primarily records, so attachments can be listed and manipulated in the record inspector. (`src/pages/ProjectSpacePage.tsx:1646-1718`, `src/components/project-space/FileInspectorActionBar.tsx:92-204`)
- Backend: Uses `entity_attachments` and `asset_roots`; routes are `POST /api/hub/attachments`, `DELETE /api/hub/attachments/:attachmentId`, and attachment reads are embedded in `GET /api/hub/records/:recordId` through `attachmentsByEntityStmt`. (`apps/hub-api/hub-api.mjs:688-705`, `apps/hub-api/hub-api.mjs:6016-6182`, `apps/hub-api/hub-api.mjs:2304-2319`, `apps/hub-api/hub-api.mjs:4615-4691`)
- Frontend: Service functions are `getRecordDetail`, `attachFile`, and `detachFile`; the hook is `useRecordInspector`; the UI is the attachment section in `ProjectSpacePage`, `FileInspectorActionBar`, and `FileMovePopover`. (`src/services/hub/records.ts:51-61`, `src/services/hub/records.ts:607-649`, `src/hooks/useRecordInspector.ts:393-450`, `src/hooks/useRecordInspector.ts:462-498`, `src/hooks/useRecordInspector.ts:603-632`, `src/pages/ProjectSpacePage.tsx:1646-1718`, `src/components/project-space/FileInspectorActionBar.tsx:92-204`, `src/components/project-space/FileMovePopover.tsx:53-107`)
- Storage: Actual bytes still live in Nextcloud via `asset_root_id + asset_path`; SQLite stores only attachment references and metadata. (`apps/hub-api/hub-api.mjs:688-705`, `apps/hub-api/hub-api.mjs:6077-6092`)
- Current status: Working, but intentionally separate from tracked files. Attachments are listed from `entity_attachments`, not from `files`. (`apps/hub-api/hub-api.mjs:2304-2319`, `apps/hub-api/hub-api.mjs:6283-6288`)

### System D: Legacy/mock `nextcloudService`

- Purpose: Legacy or placeholder Nextcloud-oriented helpers for recent files, folder creation, share links, bundle requests, and uploads. (`src/services/nextcloudService.ts:5-100`)
- Backend: None; there are no Hub API calls in this file. (`src/services/nextcloudService.ts:5-100`)
- Frontend: I found no imports or consumers outside the file itself. (`src/services/nextcloudService.ts:5-100`)
- Storage: None in live code; functions return mock data or blocked reasons. (`src/services/nextcloudService.ts:5-100`)
- Current status: Placeholder/unwired. (`src/services/nextcloudService.ts:5-100`)

## Section 6 — Where they overlap or conflict

1. All live systems share `asset_roots`, but they do not share a single read/write contract above that layer. Tracked files use `files`, attachments use `entity_attachments`, and raw asset browsing uses only `asset_roots` plus Nextcloud. (`apps/hub-api/hub-api.mjs:663-715`)

2. The cleanest upload/list mismatch is between raw asset upload and tracked file listing: `POST /projects/:projectId/assets/upload` uploads to Nextcloud and returns `{ uploaded, path, proxy_url }`, but `GET /projects/:projectId/files` reads only from the `files` table. Since the raw asset upload route never inserts into `files`, an upload through System B will not appear in the Files module’s System A list. (`apps/hub-api/hub-api.mjs:6283-6288`, `apps/hub-api/hub-api.mjs:6371-6453`)

3. Attachments are also separate from tracked files. `POST /api/hub/attachments` writes `entity_attachments`, while `GET /api/hub/projects/:projectId/files` reads `files`. That means “attached to a record” and “listed in the Files module” are different states unless both rows exist. The current record-inspector upload flow explicitly does both by calling `uploadFile` and then `attachFile`. (`src/hooks/useRecordInspector.ts:393-427`, `src/hooks/useRecordInspector.ts:414-450`, `apps/hub-api/hub-api.mjs:6077-6092`, `apps/hub-api/hub-api.mjs:6283-6288`)

4. The frontend and tests assume `POST /api/hub/files/upload` preserves upload metadata, but the backend discards it. `src/services/hub/files.ts` accepts `metadata`, `useProjectFilesRuntime` sends `scope/pane_id`, `useRecordInspector` sends attachment context, and `useWorkspaceDocRuntime` sends doc-attachment context. The backend inserts `toJson({})` into `files.metadata_json` and omits `metadata` from the response body. The fallback path parser in `trackedFileRecord()` hides some of this for pane file listing, but the contract is still inconsistent and already contradicted by the regression tests. (`src/services/hub/files.ts:7-16`, `src/hooks/useProjectFilesRuntime.ts:257-267`, `src/hooks/useProjectFilesRuntime.ts:354-366`, `src/hooks/useRecordInspector.ts:396-408`, `src/hooks/useWorkspaceDocRuntime.ts:431-443`, `apps/hub-api/hub-api.mjs:2459-2478`, `apps/hub-api/hub-api.mjs:5951-5963`, `apps/hub-api/hub-api.mjs:5995-6008`, `scripts/hub-provenance-regression.test.mjs:610-620`, `scripts/hub-provenance-regression.test.mjs:780-785`)

5. `FileInspectorActionBar` uses “Move”, but the implementation does not move file bytes or update the `files` table. It creates a replacement attachment with different metadata and deletes the old attachment. That is a naming collision between “move attachment context” and “move file.” (`src/components/project-space/FileInspectorActionBar.tsx:106-120`, `src/hooks/useRecordInspector.ts:527-557`, `src/hooks/useRecordInspector.ts:603-624`)

6. Multiple systems converge on the same proxy route and URL shape. Tracked files, attachments, and asset listings all generate `proxy_url` values through `buildAssetProxyPath`, so display/download behavior is shared even though their listing tables differ. (`apps/hub-api/hub-api.mjs:2313-2318`, `apps/hub-api/hub-api.mjs:2478-2483`, `apps/hub-api/hub-api.mjs:6356-6364`, `apps/hub-api/hub-api.mjs:6513-6560`)

## Section 7 — Recommendations

1. The systems are intentionally separate at the domain level and should stay separate conceptually:
   - System A is “tracked project/pane files.”
   - System B is “raw asset-root / provider browsing.”
   - System C is “entity attachments.”
   The schema and UI already reflect those distinct concerns. (`apps/hub-api/hub-api.mjs:663-715`, `src/pages/ProjectSpacePage.tsx:1517-1562`, `src/pages/ProjectSpacePage.tsx:1646-1718`, `src/components/project-space/FilesModuleSkin.tsx:499-517`)

2. System B is incomplete relative to System A. The backend exposes `/assets/upload` and `/assets/delete`, but the frontend only lists asset roots and assets. That does not break the Files module directly, but it means there are two partially overlapping file flows with different persistence behavior. (`apps/hub-api/hub-api.mjs:6371-6510`, `src/services/hub/files.ts:71-128`, `src/pages/ProjectSpacePage.tsx:1517-1562`)

3. The smallest contract fix I can justify from the code is to make `POST /api/hub/files/upload` persist and return `body.metadata` in `files.metadata_json` and the response payload. That matches the existing frontend payload shape and the regression-test expectations without changing the conceptual separation between systems. This is an inference from the current code and tests, not a confirmed runtime reproduction from this audit. (`src/services/hub/files.ts:7-16`, `apps/hub-api/hub-api.mjs:5951-5963`, `apps/hub-api/hub-api.mjs:5995-6008`, `scripts/hub-provenance-regression.test.mjs:610-620`, `scripts/hub-provenance-regression.test.mjs:780-785`)

4. If the failing E2E path is specifically “upload through one surface, then expect the Files module list to update,” the minimum behavioral rule should be:
   - Uploads intended to appear in `GET /projects/:projectId/files` must go through `POST /api/hub/files/upload`.
   - Raw asset-library uploads through `POST /projects/:projectId/assets/upload` should either remain intentionally untracked or be changed to also insert a `files` row.
   Right now those two upload endpoints have different side effects, which is the clearest source of an “upload succeeded but list failed” outcome in this codebase. (`apps/hub-api/hub-api.mjs:6283-6288`, `apps/hub-api/hub-api.mjs:6371-6453`)
