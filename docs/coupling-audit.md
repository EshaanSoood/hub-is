# Coupling Audit

Audit basis: `npx tsc --noEmit` completed successfully before analysis, and the requested grep scans were used to enumerate `hubContractApi` call sites. `src/services/hubContractApi.ts` is already a migration shim that re-exports `./hub/index`, so the current audit is about remaining caller coupling to the shim rather than inline service code in that file (`src/services/hubContractApi.ts:1-23`, `src/services/hub/index.ts:1-11`).

## Section 1 — Import graph for `src/services/hubContractApi.ts`

I found 29 current importers and 69 unique imported symbols by enumerating the import declarations below.

### Hooks

| Importer | Symbols imported from `hubContractApi.ts` | Citation |
| --- | --- | --- |
| `src/hooks/useAutomationRuntime.ts` | createAutomationRule, deleteAutomationRule, listAutomationRules, listAutomationRuns, updateAutomationRule | `src/hooks/useAutomationRuntime.ts:3-9` |
| `src/hooks/useCalendarRuntime.ts` | queryCalendar | `src/hooks/useCalendarRuntime.ts:2` |
| `src/hooks/usePaneMutations.ts` | addPaneMember, createPane, deletePane, listPanes, listTimeline, removePaneMember, updatePane, type HubPaneSummary | `src/hooks/usePaneMutations.ts:3-12` |
| `src/hooks/useProjectBootstrap.ts` | getProject, listPanes, listProjectMembers, listTimeline, type HubPaneSummary, type HubProject, type HubProjectMember | `src/hooks/useProjectBootstrap.ts:2` |
| `src/hooks/useProjectFilesRuntime.ts` | createAssetRoot, listAssetRoots, listAssets, listTrackedFiles, uploadFile, type HubTrackedFile | `src/hooks/useProjectFilesRuntime.ts:2-9` |
| `src/hooks/useProjectMembers.ts` | addProjectMember, createProjectInvite, type HubProjectMember | `src/hooks/useProjectMembers.ts:3` |
| `src/hooks/useProjectTasksRuntime.ts` | listProjectTasks | `src/hooks/useProjectTasksRuntime.ts:2` |
| `src/hooks/useProjectViewsRuntime.ts` | listCollectionFields, listCollections, listTimeline, listViews, queryView, setRecordValues, type HubCollection, type HubCollectionField, type HubPaneSummary, type HubRecordSummary, type HubView | `src/hooks/useProjectViewsRuntime.ts:4-16` |
| `src/hooks/useQuickCapture.ts` | createRecord, type HubCollection, type HubPaneSummary | `src/hooks/useQuickCapture.ts:2` |
| `src/hooks/useRecordInspector.ts` | addRelation, attachFile, createComment, detachFile, getRecordDetail, listBacklinks, listTimeline, removeRelation, setRecordValues, uploadFile, type HubBacklink, type HubPaneSummary, type HubRecordDetail | `src/hooks/useRecordInspector.ts:3-17` |
| `src/hooks/useTimelineRuntime.ts` | listTimeline | `src/hooks/useTimelineRuntime.ts:3` |
| `src/hooks/useWorkspaceDocRuntime.ts` | authorizeCollabDoc, createDocAnchorComment, getDocSnapshot, listComments, materializeMentions, postDocPresence, saveDocSnapshot, setCommentStatus, uploadFile, type HubMentionTarget | `src/hooks/useWorkspaceDocRuntime.ts:2-13` |

### Pages

| Importer | Symbols imported from `hubContractApi.ts` | Citation |
| --- | --- | --- |
| `src/pages/ProjectSpacePage.tsx` | type HubBacklink, type HubPaneSummary, type HubProject, type HubProjectMember | `src/pages/ProjectSpacePage.tsx:3-8` |
| `src/pages/ProjectsPage.tsx` | createPersonalTask, getHubHome, getRecordDetail, type HubRecordDetail | `src/pages/ProjectsPage.tsx:10` |

### Components

| Importer | Symbols imported from `hubContractApi.ts` | Citation |
| --- | --- | --- |
| `src/components/layout/AppShell.tsx` | listNotifications, markNotificationRead, type HubNotification | `src/components/layout/AppShell.tsx:6` |
| `src/components/project-space/BacklinksPanel.tsx` | type HubBacklink | `src/components/project-space/BacklinksPanel.tsx:1` |
| `src/components/project-space/CommentComposer.tsx` | type HubMentionTarget | `src/components/project-space/CommentComposer.tsx:4` |
| `src/components/project-space/KanbanModuleSkin.tsx` | type HubRecordSummary | `src/components/project-space/KanbanModuleSkin.tsx:19` |
| `src/components/project-space/MentionPicker.tsx` | searchMentionTargets, type HubMentionTarget | `src/components/project-space/MentionPicker.tsx:3` |
| `src/components/project-space/RelationPicker.tsx` | searchRelationRecords, type HubRelationSearchRecord | `src/components/project-space/RelationPicker.tsx:2` |
| `src/components/project-space/RelationsSection.tsx` | type HubRecordDetail | `src/components/project-space/RelationsSection.tsx:3` |
| `src/components/project-space/TableModuleSkin.tsx` | type HubRecordSummary | `src/components/project-space/TableModuleSkin.tsx:11` |
| `src/components/project-space/ViewEmbedBlock.tsx` | queryView, type HubRecordSummary, type HubView | `src/components/project-space/ViewEmbedBlock.tsx:2` |
| `src/components/project-space/WorkView.tsx` | type HubCollectionField, type HubPaneSummary, type HubRecordSummary | `src/components/project-space/WorkView.tsx:4` |

### Services

| Importer | Symbols imported from `hubContractApi.ts` | Citation |
| --- | --- | --- |
| `src/services/hubLive.ts` | authorizeHubLive, type HubNotification | `src/services/hubLive.ts:2` |
| `src/services/projectsService.ts` | type HubEnvelope, type HubProject | `src/services/projectsService.ts:14` |
| `src/services/sessionService.ts` | readEnvelope | `src/services/sessionService.ts:2` |

### Other

| Importer | Symbols imported from `hubContractApi.ts` | Citation |
| --- | --- | --- |
| `src/features/PersonalizedDashboardPanel.tsx` | type getHubHome | `src/features/PersonalizedDashboardPanel.tsx:6` |
| `src/lib/hubRoutes.ts` | type HubHomeEvent, type HubSourcePaneContext, type HubTaskSummary | `src/lib/hubRoutes.ts:1` |

## Section 2 — Current state of `src/services/hub/`

`src/services/hub/` exists and currently contains 12 files: 10 implementation domains, one placeholder (`search.ts`), and one barrel (`index.ts`) (`src/services/hub/index.ts:1-11`, `src/services/hub/search.ts:1`).

- Collection and field API wrappers; exports `listCollections`, `createCollection`, `listCollectionFields`, and `createCollectionField`. (`src/services/hub/collections.ts:5-46`)
- Collaborative document API wrappers; exports `authorizeCollabDoc`, `getDocSnapshot`, `saveDocSnapshot`, and `postDocPresence`. (`src/services/hub/docs.ts:5-47`)
- File upload, tracked file, asset-root, and asset listing API wrappers; exports `uploadFile`, `listTrackedFiles`, `listAssetRoots`, `createAssetRoot`, and `listAssets`. (`src/services/hub/files.ts:5-128`)
- Domain barrel that re-exports every file under `src/services/hub/`. (`src/services/hub/index.ts:1-11`)
- Notification API wrappers; exports `listNotifications` and `markNotificationRead`. (`src/services/hub/notifications.ts:5-25`)
- Pane CRUD and pane-membership API wrappers; exports `listPanes`, `createPane`, `updatePane`, `deletePane`, `addPaneMember`, and `removePaneMember`. (`src/services/hub/panes.ts:5-71`)
- Project CRUD, member, and invite API wrappers; exports `listProjects`, `createProject`, `getProject`, `listProjectMembers`, `addProjectMember`, `createProjectInvite`, and `removeProjectMember`. (`src/services/hub/projects.ts:5-73`)
- Record, relation, comment, timeline, task, dashboard, attachment, and automation API wrappers; exports 28 record-domain functions. (`src/services/hub/records.ts:16-718`)
- Placeholder-only file; it exports nothing (`export {}`). (`src/services/hub/search.ts:1`)
- Transport/auth helpers plus envelope parsing/live authorization; exports `normalizeSourcePane`, `normalizeRecordSummary`, `normalizeRecordDetail`, `hubRequest`, `authorizeHubLive`, and `readEnvelope`. (`src/services/hub/transport.ts:15-82`)
- Shared Hub contract interfaces from `HubErrorPayload` through `HubNotification`. (`src/services/hub/types.ts:1-329`)
- View CRUD and query wrappers; exports `listViews`, `createView`, and `queryView`. (`src/services/hub/views.ts:5-45`)

`src/services/hubContractApi.ts` does not contain inline implementations; it only exports everything from `./hub/index` (`src/services/hubContractApi.ts:1-23`).

`src/services/hub/index.ts` re-exports every domain file under `src/services/hub/`, including the placeholder `search.ts`, so there are no existing domain files that are omitted from the barrel (`src/services/hub/index.ts:1-11`).

Only `src/services/hub/search.ts` is empty/placeholder-only; it contains a single `export {}` and no callable API surface (`src/services/hub/search.ts:1`).

## Section 3 — Symbol origin map

Call counts below are current callers that import each symbol through `src/services/hubContractApi.ts`; direct `src/services/hub/*` imports were not present in `src/` at audit time, so the shim caller count and overall caller count are the same for the current frontend (`src/services/hubContractApi.ts:1-23`, `src/services/hub/index.ts:1-11`).

### transport

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `normalizeSourcePane` | const | Normalizes nullable source-pane payloads into a stable client shape. | 0 | `src/services/hub/transport.ts:15-24` |
| `normalizeRecordSummary` | const | Normalizes `source_pane` on record summary payloads. | 0 | `src/services/hub/transport.ts:26-29` |
| `normalizeRecordDetail` | const | Normalizes `source_pane` on record detail payloads. | 0 | `src/services/hub/transport.ts:31-34` |
| `hubRequest` | const | Wraps authenticated Hub HTTP requests and validates Hub envelopes. | 0 | `src/services/hub/transport.ts:36-64` |
| `authorizeHubLive` | const | Fetches a websocket authorization ticket for Hub Live. | 1 | `src/services/hub/transport.ts:66-71` |
| `readEnvelope` | const | Parses and validates a Hub envelope from a raw `Response`. | 1 | `src/services/hub/transport.ts:73-82` |

### types

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `HubErrorPayload` | type | Hub error object shape. | 0 | `src/services/hub/types.ts:1-4` |
| `HubEnvelope` | type | Generic Hub API envelope wrapper. | 1 | `src/services/hub/types.ts:6-10` |
| `HubProject` | type | Project metadata payload. | 3 | `src/services/hub/types.ts:12-19` |
| `HubUserSummary` | type | Basic Hub user identity payload. | 0 | `src/services/hub/types.ts:21-26` |
| `HubProjectMember` | type | Project membership payload. | 3 | `src/services/hub/types.ts:28-34` |
| `HubProjectInvite` | type | Pending project invite payload. | 0 | `src/services/hub/types.ts:36-48` |
| `HubPaneSummary` | type | Pane metadata plus membership/editor flags. | 7 | `src/services/hub/types.ts:50-60` |
| `HubSourcePaneContext` | type | Source pane reference used for navigation context. | 1 | `src/services/hub/types.ts:62-66` |
| `HubCollabAuthorization` | type | Collaborative document authorization payload. | 0 | `src/services/hub/types.ts:68-79` |
| `HubLiveAuthorization` | type | Hub Live websocket authorization payload. | 0 | `src/services/hub/types.ts:81-87` |
| `HubCollection` | type | Collection metadata payload. | 2 | `src/services/hub/types.ts:89-97` |
| `HubCollectionField` | type | Collection field schema payload. | 2 | `src/services/hub/types.ts:99-106` |
| `HubView` | type | View metadata and config payload. | 2 | `src/services/hub/types.ts:108-115` |
| `HubEntityRef` | type | Typed entity reference payload. | 0 | `src/services/hub/types.ts:117-120` |
| `HubMentionTarget` | type | Mention picker result payload. | 3 | `src/services/hub/types.ts:122-128` |
| `HubBacklink` | type | Backlink payload for reverse mention discovery. | 3 | `src/services/hub/types.ts:130-147` |
| `HubMaterializedMention` | type | Resolved mention payload. | 0 | `src/services/hub/types.ts:149-157` |
| `HubRecordSummary` | type | Record summary payload for lists/views. | 5 | `src/services/hub/types.ts:159-166` |
| `HubRecordDetail` | type | Expanded record payload with schema, relations, comments, and attachments. | 3 | `src/services/hub/types.ts:168-247` |
| `HubRelationSearchRecord` | type | Relation picker search result payload. | 1 | `src/services/hub/types.ts:249-255` |
| `HubTrackedFile` | type | Tracked file metadata payload. | 1 | `src/services/hub/types.ts:257-273` |
| `HubTaskSummary` | type | Task summary payload. | 1 | `src/services/hub/types.ts:275-294` |
| `HubTaskPage` | type | Paginated task query payload. | 0 | `src/services/hub/types.ts:296-299` |
| `HubHomeEvent` | type | Home/dashboard event payload. | 1 | `src/services/hub/types.ts:301-318` |
| `HubNotification` | type | Notification payload. | 2 | `src/services/hub/types.ts:320-331` |

### projects

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `listProjects` | const | Lists all projects visible to the caller. | 0 | `src/services/hub/projects.ts:5-10` |
| `createProject` | const | Creates a project. | 0 | `src/services/hub/projects.ts:12-21` |
| `getProject` | const | Fetches a single project. | 1 | `src/services/hub/projects.ts:23-28` |
| `listProjectMembers` | const | Lists project members. | 1 | `src/services/hub/projects.ts:30-37` |
| `addProjectMember` | const | Adds a project member immediately. | 1 | `src/services/hub/projects.ts:39-52` |
| `createProjectInvite` | const | Creates a project invite request. | 1 | `src/services/hub/projects.ts:54-64` |
| `removeProjectMember` | const | Removes a project member. | 0 | `src/services/hub/projects.ts:66-74` |

### panes

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `listPanes` | const | Lists panes for a project. | 2 | `src/services/hub/panes.ts:5-14` |
| `createPane` | const | Creates a pane. | 1 | `src/services/hub/panes.ts:16-36` |
| `updatePane` | const | Updates pane metadata or layout. | 1 | `src/services/hub/panes.ts:38-48` |
| `deletePane` | const | Deletes a pane. | 1 | `src/services/hub/panes.ts:50-54` |
| `addPaneMember` | const | Adds a user to a pane. | 1 | `src/services/hub/panes.ts:56-62` |
| `removePaneMember` | const | Removes a user from a pane. | 1 | `src/services/hub/panes.ts:64-72` |

### docs

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `authorizeCollabDoc` | const | Fetches collaboration authorization for a document. | 1 | `src/services/hub/docs.ts:5-14` |
| `getDocSnapshot` | const | Fetches the current document snapshot. | 1 | `src/services/hub/docs.ts:16-26` |
| `saveDocSnapshot` | const | Writes a document snapshot. | 1 | `src/services/hub/docs.ts:28-37` |
| `postDocPresence` | const | Posts live cursor/presence data for a document. | 1 | `src/services/hub/docs.ts:39-48` |

### collections

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `listCollections` | const | Lists project collections. | 1 | `src/services/hub/collections.ts:5-14` |
| `createCollection` | const | Creates a collection. | 0 | `src/services/hub/collections.ts:16-25` |
| `listCollectionFields` | const | Lists fields for a collection. | 1 | `src/services/hub/collections.ts:27-36` |
| `createCollectionField` | const | Creates a collection field. | 0 | `src/services/hub/collections.ts:38-47` |

### views

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `listViews` | const | Lists project views. | 1 | `src/services/hub/views.ts:5-10` |
| `createView` | const | Creates a view. | 0 | `src/services/hub/views.ts:12-21` |
| `queryView` | const | Queries a view and returns schema plus records. | 2 | `src/services/hub/views.ts:23-45` |

### records

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `createRecord` | const | Creates a record. | 1 | `src/services/hub/records.ts:16-37` |
| `updateRecord` | const | Updates record metadata such as title/archive state. | 0 | `src/services/hub/records.ts:39-49` |
| `getRecordDetail` | const | Fetches a single record with expanded detail. | 2 | `src/services/hub/records.ts:51-61` |
| `setRecordValues` | const | Writes record field values. | 2 | `src/services/hub/records.ts:63-81` |
| `addRelation` | const | Creates a relation between records. | 1 | `src/services/hub/records.ts:83-118` |
| `removeRelation` | const | Deletes a relation between records. | 1 | `src/services/hub/records.ts:120-137` |
| `searchRelationRecords` | const | Searches records for relation pickers. | 1 | `src/services/hub/records.ts:139-166` |
| `searchMentionTargets` | const | Searches mention targets across users and records. | 1 | `src/services/hub/records.ts:168-185` |
| `listBacklinks` | const | Lists backlinks for a target entity. | 1 | `src/services/hub/records.ts:187-204` |
| `createEventFromNlp` | const | Creates an event record from NLP-derived input. | 0 | `src/services/hub/records.ts:206-234` |
| `queryCalendar` | const | Queries calendar events for a project. | 1 | `src/services/hub/records.ts:236-281` |
| `createComment` | const | Creates a record comment. | 1 | `src/services/hub/records.ts:283-304` |
| `createDocAnchorComment` | const | Creates a document comment anchored to a node payload. | 1 | `src/services/hub/records.ts:306-330` |
| `listComments` | const | Lists record or document comments, including orphaned document comments. | 1 | `src/services/hub/records.ts:332-434` |
| `setCommentStatus` | const | Updates a comment status. | 1 | `src/services/hub/records.ts:436-449` |
| `materializeMentions` | const | Resolves mention tokens into concrete mention payloads. | 1 | `src/services/hub/records.ts:451-468` |
| `listTimeline` | const | Lists project timeline events. | 5 | `src/services/hub/records.ts:470-502` |
| `listProjectTasks` | const | Lists paginated project tasks. | 1 | `src/services/hub/records.ts:504-525` |
| `queryTasks` | const | Queries tasks with filters/pagination. | 0 | `src/services/hub/records.ts:527-552` |
| `createPersonalTask` | const | Creates a personal task. | 1 | `src/services/hub/records.ts:554-562` |
| `getHubHome` | const | Fetches home/dashboard tasks, events, and notifications. | 2 | `src/services/hub/records.ts:564-605` |
| `attachFile` | const | Attaches an uploaded file to a record. | 1 | `src/services/hub/records.ts:607-630` |
| `detachFile` | const | Detaches a file attachment from a record. | 1 | `src/services/hub/records.ts:632-649` |
| `listAutomationRules` | const | Lists automation rules. | 1 | `src/services/hub/records.ts:651-676` |
| `createAutomationRule` | const | Creates an automation rule. | 1 | `src/services/hub/records.ts:678-691` |
| `updateAutomationRule` | const | Updates an automation rule. | 1 | `src/services/hub/records.ts:693-702` |
| `deleteAutomationRule` | const | Deletes an automation rule. | 1 | `src/services/hub/records.ts:704-708` |
| `listAutomationRuns` | const | Lists automation run history. | 1 | `src/services/hub/records.ts:710-735` |

### notifications

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `listNotifications` | const | Lists notifications for the current user. | 1 | `src/services/hub/notifications.ts:5-15` |
| `markNotificationRead` | const | Marks a notification as read. | 1 | `src/services/hub/notifications.ts:17-26` |

### files

| Symbol | Kind | What it does | Callers | Citation |
| --- | --- | --- | --- | --- |
| `uploadFile` | const | Uploads a file payload into Hub file storage. | 3 | `src/services/hub/files.ts:5-48` |
| `listTrackedFiles` | const | Lists tracked files for a project or pane. | 1 | `src/services/hub/files.ts:50-69` |
| `listAssetRoots` | const | Lists project asset roots. | 1 | `src/services/hub/files.ts:71-99` |
| `createAssetRoot` | const | Creates a project asset root. | 1 | `src/services/hub/files.ts:101-110` |
| `listAssets` | const | Lists asset entries under an asset root path. | 1 | `src/services/hub/files.ts:112-128` |

### search

No exported symbols; `src/services/hub/search.ts:1` is placeholder-only.

High-fan-out symbols (5+ callers):
- `HubPaneSummary` has 7 current shim callers (`src/services/hub/types.ts:50-60`).
- `HubRecordSummary` has 5 current shim callers (`src/services/hub/types.ts:159-166`).
- `listTimeline` has 5 current shim callers (`src/services/hub/records.ts:470-502`).

Single-caller symbols (1 caller):
- transport: `authorizeHubLive`, `readEnvelope` (`src/services/hub/transport.ts:66-71`; `src/services/hub/transport.ts:73-82`)
- types: `HubEnvelope`, `HubHomeEvent`, `HubRelationSearchRecord`, `HubSourcePaneContext`, `HubTaskSummary`, `HubTrackedFile` (`src/services/hub/types.ts:6-10`; `src/services/hub/types.ts:301-318`; `src/services/hub/types.ts:249-255`; `src/services/hub/types.ts:62-66`; `src/services/hub/types.ts:275-294`; `src/services/hub/types.ts:257-273`)
- projects: `addProjectMember`, `createProjectInvite`, `getProject`, `listProjectMembers` (`src/services/hub/projects.ts:39-52`; `src/services/hub/projects.ts:54-64`; `src/services/hub/projects.ts:23-28`; `src/services/hub/projects.ts:30-37`)
- panes: `addPaneMember`, `createPane`, `deletePane`, `removePaneMember`, `updatePane` (`src/services/hub/panes.ts:56-62`; `src/services/hub/panes.ts:16-36`; `src/services/hub/panes.ts:50-54`; `src/services/hub/panes.ts:64-72`; `src/services/hub/panes.ts:38-48`)
- docs: `authorizeCollabDoc`, `getDocSnapshot`, `postDocPresence`, `saveDocSnapshot` (`src/services/hub/docs.ts:5-14`; `src/services/hub/docs.ts:16-26`; `src/services/hub/docs.ts:39-48`; `src/services/hub/docs.ts:28-37`)
- collections: `listCollectionFields`, `listCollections` (`src/services/hub/collections.ts:27-36`; `src/services/hub/collections.ts:5-14`)
- views: `listViews` (`src/services/hub/views.ts:5-10`)
- records: `addRelation`, `attachFile`, `createAutomationRule`, `createComment`, `createDocAnchorComment`, `createPersonalTask`, `createRecord`, `deleteAutomationRule`, `detachFile`, `listAutomationRules`, `listAutomationRuns`, `listBacklinks`, `listComments`, `listProjectTasks`, `materializeMentions`, `queryCalendar`, `removeRelation`, `searchMentionTargets`, `searchRelationRecords`, `setCommentStatus`, `updateAutomationRule` (`src/services/hub/records.ts:83-118`; `src/services/hub/records.ts:607-630`; `src/services/hub/records.ts:678-691`; `src/services/hub/records.ts:283-304`; `src/services/hub/records.ts:306-330`; `src/services/hub/records.ts:554-562`; `src/services/hub/records.ts:16-37`; `src/services/hub/records.ts:704-708`; `src/services/hub/records.ts:632-649`; `src/services/hub/records.ts:651-676`; `src/services/hub/records.ts:710-735`; `src/services/hub/records.ts:187-204`; `src/services/hub/records.ts:332-434`; `src/services/hub/records.ts:504-525`; `src/services/hub/records.ts:451-468`; `src/services/hub/records.ts:236-281`; `src/services/hub/records.ts:120-137`; `src/services/hub/records.ts:168-185`; `src/services/hub/records.ts:139-166`; `src/services/hub/records.ts:436-449`; `src/services/hub/records.ts:693-702`)
- notifications: `listNotifications`, `markNotificationRead` (`src/services/hub/notifications.ts:5-15`; `src/services/hub/notifications.ts:17-26`)
- files: `createAssetRoot`, `listAssetRoots`, `listAssets`, `listTrackedFiles` (`src/services/hub/files.ts:101-110`; `src/services/hub/files.ts:71-99`; `src/services/hub/files.ts:112-128`; `src/services/hub/files.ts:50-69`)

## Section 4 — Coupling hotspots

The current hotspot set is the small group of hooks that touch 3+ service domains through the shim.

| File | Domains touched | Why it is a split hotspot | Citation |
| --- | --- | --- | --- |
| `src/hooks/useProjectViewsRuntime.ts` | collections, views, records, types | It loads collections, fields, and views together, then queries view data and writes record values before refreshing timeline state for the same runtime. | `src/hooks/useProjectViewsRuntime.ts:4-16`; `src/hooks/useProjectViewsRuntime.ts:291-297`; `src/hooks/useProjectViewsRuntime.ts:460-464` |
| `src/hooks/useWorkspaceDocRuntime.ts` | docs, records, files, types | It owns document auth/snapshot/presence, record-backed comments and mentions, and file upload in one hook. | `src/hooks/useWorkspaceDocRuntime.ts:2-13`; `src/hooks/useWorkspaceDocRuntime.ts:253-354`; `src/hooks/useWorkspaceDocRuntime.ts:429-530` |
| `src/hooks/useProjectBootstrap.ts` | projects, panes, records, types | It bootstraps the page by fetching project metadata, panes, members, and timeline in one `Promise.all` refresh path. | `src/hooks/useProjectBootstrap.ts:2`; `src/hooks/useProjectBootstrap.ts:35-71` |
| `src/hooks/usePaneMutations.ts` | panes, records, types | It mutates panes but also refreshes timeline state and pane lists, so pane actions are coupled to record-domain timeline refreshes. | `src/hooks/usePaneMutations.ts:3-12`; `src/hooks/usePaneMutations.ts:62-95`; `src/hooks/usePaneMutations.ts:118-122`; `src/hooks/usePaneMutations.ts:210-216` |
| `src/hooks/useRecordInspector.ts` | records, files, types | It mixes record detail/backlink reads, record-field writes, relation mutations, comments, and attachment upload/attach/detach in one runtime. | `src/hooks/useRecordInspector.ts:3-17`; `src/hooks/useRecordInspector.ts:113-207`; `src/hooks/useRecordInspector.ts:246-297`; `src/hooks/useRecordInspector.ts:398-569` |

## Section 5 — Hook extraction status

The 12 extracted project-space hooks all exist under `src/hooks/`, all still import Hub APIs through `src/services/hubContractApi.ts`, none imports a `src/services/hub/*` domain file directly, and each is currently consumed by `ProjectSpacePage.tsx`.

| Hook | Exists | Imports from `hubContractApi.ts` | Citation | Direct `src/services/hub/*` import? | Citation | Used by | Usage citation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `useAutomationRuntime` | Yes | createAutomationRule, deleteAutomationRule, listAutomationRules, listAutomationRuns, updateAutomationRule | `src/hooks/useAutomationRuntime.ts:3-9` | None | `src/hooks/useAutomationRuntime.ts:1-9` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:11`; `src/pages/ProjectSpacePage.tsx:426` |
| `useCalendarRuntime` | Yes | queryCalendar | `src/hooks/useCalendarRuntime.ts:2` | None | `src/hooks/useCalendarRuntime.ts:1-2` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:12`; `src/pages/ProjectSpacePage.tsx:241` |
| `usePaneMutations` | Yes | addPaneMember, createPane, deletePane, listPanes, listTimeline, removePaneMember, updatePane, HubPaneSummary | `src/hooks/usePaneMutations.ts:3-12` | None | `src/hooks/usePaneMutations.ts:1-12` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:13`; `src/pages/ProjectSpacePage.tsx:336` |
| `useProjectBootstrap` | Yes | getProject, listPanes, listProjectMembers, listTimeline, HubPaneSummary, HubProject, HubProjectMember | `src/hooks/useProjectBootstrap.ts:2` | None | `src/hooks/useProjectBootstrap.ts:1-2` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:14`; `src/pages/ProjectSpacePage.tsx:1810` |
| `useProjectFilesRuntime` | Yes | createAssetRoot, listAssetRoots, listAssets, listTrackedFiles, uploadFile, HubTrackedFile | `src/hooks/useProjectFilesRuntime.ts:2-9` | None | `src/hooks/useProjectFilesRuntime.ts:1-9` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:16`; `src/pages/ProjectSpacePage.tsx:279` |
| `useProjectMembers` | Yes | addProjectMember, createProjectInvite, HubProjectMember | `src/hooks/useProjectMembers.ts:3` | None | `src/hooks/useProjectMembers.ts:1-3` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:15`; `src/pages/ProjectSpacePage.tsx:319` |
| `useProjectTasksRuntime` | Yes | listProjectTasks | `src/hooks/useProjectTasksRuntime.ts:2` | None | `src/hooks/useProjectTasksRuntime.ts:1-2` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:17`; `src/pages/ProjectSpacePage.tsx:253` |
| `useProjectViewsRuntime` | Yes | listCollectionFields, listCollections, listTimeline, listViews, queryView, setRecordValues, HubCollection, HubCollectionField, HubPaneSummary, HubRecordSummary, HubView | `src/hooks/useProjectViewsRuntime.ts:4-16` | None | `src/hooks/useProjectViewsRuntime.ts:1-17` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:18`; `src/pages/ProjectSpacePage.tsx:363` |
| `useQuickCapture` | Yes | createRecord, HubCollection, HubPaneSummary | `src/hooks/useQuickCapture.ts:2` | None | `src/hooks/useQuickCapture.ts:1-2` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:19`; `src/pages/ProjectSpacePage.tsx:449` |
| `useRecordInspector` | Yes | addRelation, attachFile, createComment, detachFile, getRecordDetail, listBacklinks, listTimeline, removeRelation, setRecordValues, uploadFile, HubBacklink, HubPaneSummary, HubRecordDetail | `src/hooks/useRecordInspector.ts:3-17` | None | `src/hooks/useRecordInspector.ts:1-17` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:20`; `src/pages/ProjectSpacePage.tsx:403` |
| `useTimelineRuntime` | Yes | listTimeline | `src/hooks/useTimelineRuntime.ts:3` | None | `src/hooks/useTimelineRuntime.ts:1-4` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:21`; `src/pages/ProjectSpacePage.tsx:430` |
| `useWorkspaceDocRuntime` | Yes | authorizeCollabDoc, createDocAnchorComment, getDocSnapshot, listComments, materializeMentions, postDocPresence, saveDocSnapshot, setCommentStatus, uploadFile, HubMentionTarget | `src/hooks/useWorkspaceDocRuntime.ts:2-13` | None | `src/hooks/useWorkspaceDocRuntime.ts:1-16` | `src/pages/ProjectSpacePage.tsx` | `src/pages/ProjectSpacePage.tsx:22`; `src/pages/ProjectSpacePage.tsx:587` |

## Section 6 — `ProjectSpacePage.tsx` current state

`src/pages/ProjectSpacePage.tsx` currently ends at line 1863 (`src/pages/ProjectSpacePage.tsx:1863`).

It still imports directly from `hubContractApi.ts`, but only for shared types: `HubBacklink`, `HubPaneSummary`, `HubProject`, and `HubProjectMember` (`src/pages/ProjectSpacePage.tsx:3-8`).

It also imports all 12 extracted hooks from `src/hooks/` (`src/pages/ProjectSpacePage.tsx:11-22`) and invokes them in the page body: `useCalendarRuntime` (`src/pages/ProjectSpacePage.tsx:241`), `useProjectTasksRuntime` (`src/pages/ProjectSpacePage.tsx:253`), `useProjectFilesRuntime` (`src/pages/ProjectSpacePage.tsx:279`), `useProjectMembers` (`src/pages/ProjectSpacePage.tsx:319`), `usePaneMutations` (`src/pages/ProjectSpacePage.tsx:336`), `useProjectViewsRuntime` (`src/pages/ProjectSpacePage.tsx:363`), `useRecordInspector` (`src/pages/ProjectSpacePage.tsx:403`), `useAutomationRuntime` (`src/pages/ProjectSpacePage.tsx:426`), `useTimelineRuntime` (`src/pages/ProjectSpacePage.tsx:430`), `useQuickCapture` (`src/pages/ProjectSpacePage.tsx:449`), `useWorkspaceDocRuntime` (`src/pages/ProjectSpacePage.tsx:587`), and `useProjectBootstrap` (`src/pages/ProjectSpacePage.tsx:1810`).

| Direct `hubContractApi.ts` imports remaining in `ProjectSpacePage.tsx` | Citation |
| --- | --- |
| type `HubBacklink`, type `HubPaneSummary`, type `HubProject`, type `HubProjectMember` | `src/pages/ProjectSpacePage.tsx:3-8` |

| Hook used by `ProjectSpacePage.tsx` | Import citation | Invocation citation |
| --- | --- | --- |
| `useAutomationRuntime` | `src/pages/ProjectSpacePage.tsx:11` | `src/pages/ProjectSpacePage.tsx:426` |
| `useCalendarRuntime` | `src/pages/ProjectSpacePage.tsx:12` | `src/pages/ProjectSpacePage.tsx:241` |
| `usePaneMutations` | `src/pages/ProjectSpacePage.tsx:13` | `src/pages/ProjectSpacePage.tsx:336` |
| `useProjectBootstrap` | `src/pages/ProjectSpacePage.tsx:14` | `src/pages/ProjectSpacePage.tsx:1810` |
| `useProjectFilesRuntime` | `src/pages/ProjectSpacePage.tsx:16` | `src/pages/ProjectSpacePage.tsx:279` |
| `useProjectMembers` | `src/pages/ProjectSpacePage.tsx:15` | `src/pages/ProjectSpacePage.tsx:319` |
| `useProjectTasksRuntime` | `src/pages/ProjectSpacePage.tsx:17` | `src/pages/ProjectSpacePage.tsx:253` |
| `useProjectViewsRuntime` | `src/pages/ProjectSpacePage.tsx:18` | `src/pages/ProjectSpacePage.tsx:363` |
| `useQuickCapture` | `src/pages/ProjectSpacePage.tsx:19` | `src/pages/ProjectSpacePage.tsx:449` |
| `useRecordInspector` | `src/pages/ProjectSpacePage.tsx:20` | `src/pages/ProjectSpacePage.tsx:403` |
| `useTimelineRuntime` | `src/pages/ProjectSpacePage.tsx:21` | `src/pages/ProjectSpacePage.tsx:430` |
| `useWorkspaceDocRuntime` | `src/pages/ProjectSpacePage.tsx:22` | `src/pages/ProjectSpacePage.tsx:587` |

## Section 7 — Risk assessment for the hub service split

Yes: `hubContractApi.ts` can already serve as a pure barrel shim without changing any caller, because that conversion has effectively already happened. The file contains only documentation plus `export * from './hub/index'`, and `src/services/hub/index.ts` re-exports every domain file (`src/services/hubContractApi.ts:1-23`, `src/services/hub/index.ts:1-11`).

I did not find a circular-import blocker inside `src/services/hub/`. Each concrete domain file imports only `transport.ts` and/or `types.ts` (`src/services/hub/collections.ts:1-3`, `src/services/hub/docs.ts:1-3`, `src/services/hub/files.ts:1-3`, `src/services/hub/notifications.ts:1-3`, `src/services/hub/panes.ts:1-3`, `src/services/hub/projects.ts:1-3`, `src/services/hub/views.ts:1-3`, `src/services/hub/records.ts:1-14`), `transport.ts` itself only imports `types.ts` (`src/services/hub/transport.ts:1-3`), and `types.ts`/`search.ts` have no imports at all (`src/services/hub/types.ts:1-1`, `src/services/hub/search.ts:1`).

I also did not find a side-effect-only caller pattern. The remaining callers import named symbols or types from the shim, as shown in the exhaustive import graph in Section 1; representative examples include `src/hooks/useWorkspaceDocRuntime.ts:2-13`, `src/pages/ProjectsPage.tsx:10`, and `src/services/sessionService.ts:2`.

The main residual risk is not the shim itself; it is the breadth of a few domain files and a few high-fan-out exports. `records.ts` still bundles comments, docs-adjacent anchor comments, timeline, tasks, dashboard/home, file attachment, and automation operations into one domain file (`src/services/hub/records.ts:283-718`), while `HubPaneSummary`, `HubRecordSummary`, and `listTimeline` each fan out to 5+ callers (`src/services/hub/types.ts:50-60`, `src/services/hub/types.ts:159-167`, `src/services/hub/records.ts:470-502`). Those are maintainability risks for a deeper split, but they are not blockers to keeping `hubContractApi.ts` as a shim.

## Section 8 — Recommended split plan

Because the split to domain files already exists, the practical recommendation is to keep `hubContractApi.ts` as a backward-compatible shim and migrate callers incrementally to direct domain imports when convenient rather than creating new service files. The target domain file layout is already this:

| Domain file | Symbols currently owned there | Citation |
| --- | --- | --- |
| `src/services/hub/transport.ts` | normalizeSourcePane, normalizeRecordSummary, normalizeRecordDetail, hubRequest, authorizeHubLive, readEnvelope | `src/services/hub/transport.ts:15-82` |
| `src/services/hub/types.ts` | HubErrorPayload, HubEnvelope, HubProject, HubUserSummary, HubProjectMember, HubProjectInvite, HubPaneSummary, HubSourcePaneContext, HubCollabAuthorization, HubLiveAuthorization, HubCollection, HubCollectionField, HubView, HubEntityRef, HubMentionTarget, HubBacklink, HubMaterializedMention, HubRecordSummary, HubRecordDetail, HubRelationSearchRecord, HubTrackedFile, HubTaskSummary, HubTaskPage, HubHomeEvent, HubNotification | `src/services/hub/types.ts:1-331` |
| `src/services/hub/projects.ts` | listProjects, createProject, getProject, listProjectMembers, addProjectMember, createProjectInvite, removeProjectMember | `src/services/hub/projects.ts:5-74` |
| `src/services/hub/panes.ts` | listPanes, createPane, updatePane, deletePane, addPaneMember, removePaneMember | `src/services/hub/panes.ts:5-72` |
| `src/services/hub/docs.ts` | authorizeCollabDoc, getDocSnapshot, saveDocSnapshot, postDocPresence | `src/services/hub/docs.ts:5-48` |
| `src/services/hub/collections.ts` | listCollections, createCollection, listCollectionFields, createCollectionField | `src/services/hub/collections.ts:5-47` |
| `src/services/hub/views.ts` | listViews, createView, queryView | `src/services/hub/views.ts:5-45` |
| `src/services/hub/records.ts` | createRecord, updateRecord, getRecordDetail, setRecordValues, addRelation, removeRelation, searchRelationRecords, searchMentionTargets, listBacklinks, createEventFromNlp, queryCalendar, createComment, createDocAnchorComment, listComments, setCommentStatus, materializeMentions, listTimeline, listProjectTasks, queryTasks, createPersonalTask, getHubHome, attachFile, detachFile, listAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule, listAutomationRuns | `src/services/hub/records.ts:16-735` |
| `src/services/hub/notifications.ts` | listNotifications, markNotificationRead | `src/services/hub/notifications.ts:5-26` |
| `src/services/hub/files.ts` | uploadFile, listTrackedFiles, listAssetRoots, createAssetRoot, listAssets | `src/services/hub/files.ts:5-128` |
| `src/services/hub/search.ts` | (none) | `src/services/hub/search.ts:1` |

Recommended order of operations:
- 1. Keep `src/services/hubContractApi.ts` unchanged as the compatibility barrel while migrating callers (`src/services/hubContractApi.ts:1-23`).
- 2. Migrate low-risk leaf callers first: `sessionService.ts`, `projectsService.ts`, layout/components, and small single-purpose hooks such as `useCalendarRuntime.ts`, `useProjectTasksRuntime.ts`, and `useProjectMembers.ts` (`src/services/sessionService.ts:2`, `src/services/projectsService.ts:14`, `src/components/layout/AppShell.tsx:6`, `src/hooks/useCalendarRuntime.ts:2`, `src/hooks/useProjectTasksRuntime.ts:2`, `src/hooks/useProjectMembers.ts:3`).
- 3. Migrate medium-coupling hooks next: `useProjectFilesRuntime.ts`, `usePaneMutations.ts`, `useRecordInspector.ts`, and `useWorkspaceDocRuntime.ts`, because they are the main remaining feature runtimes behind `ProjectSpacePage.tsx` (`src/hooks/useProjectFilesRuntime.ts:2-9`, `src/hooks/usePaneMutations.ts:3-12`, `src/hooks/useRecordInspector.ts:3-17`, `src/hooks/useWorkspaceDocRuntime.ts:2-13`).
- 4. Migrate `useProjectViewsRuntime.ts` and `useProjectBootstrap.ts` after that, because they are the largest domain-crossing callers and will surface any hidden type-sharing issues earliest (`src/hooks/useProjectViewsRuntime.ts:4-16`, `src/hooks/useProjectBootstrap.ts:2`).
- 5. Leave `ProjectSpacePage.tsx` itself for last; today it already routes most behavior through extracted hooks and only keeps four direct type imports from the shim (`src/pages/ProjectSpacePage.tsx:3-22`).
- 6. If you want a finer-grained split after caller migration, split `records.ts` internally next, because it is the only existing domain file that still spans several subdomains (`src/services/hub/records.ts:283-718`).
