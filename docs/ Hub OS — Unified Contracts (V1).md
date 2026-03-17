# Hub OS — Unified Contracts (V1)  
**Scope:** Local-first, strong realtime collaboration, Notion-like relational power **without** nested-page navigation.  
**UI core:** Project Spaces → Work panes → **one Lexical doc per pane**.  
**Data core:** Generic **Records** (collections + fields + relations). Tasks/Events are Records with capabilities.  
**Access core:** Keycloak auth. **Project membership** + **pane membership** (pane gates doc/workspace only).  
**Calendar rule:** Single shared project calendar dataset. Events can be **tagged to participants** for “Relevant” filtering + notifications, but **All** view shows everything.

---

## 0) Glossary / Primitives

### 0.1 EntityRef (universal reference)
A common identifier used everywhere (timeline, comments, mentions, attachments, notifications, automations).

- `entity_type`: `"project" | "pane" | "doc" | "collection" | "record" | "file" | "comment" | "automation_rule" | "timeline_event" | ...`
- `entity_id`: `string` (UUID recommended)
> **Extensibility:** `entity_type` is extensible. Consumers must handle unknown values gracefully.

### 0.2 Project vs Pane
- **Project**: container for records, views, membership, modules.
- **Pane**: a *workspace surface* inside a project. Contains:
  - layout config (module grid)
  - exactly one doc
  - a subset of project members (pane_members)

### 0.3 Record
A “row” in a collection with typed fields + relations.  
Examples: task, calendar event, milestone, meeting, capture, knowledge article.

### 0.4 Capability
A behavior overlay on a record (e.g., task behaviors, event behaviors, recurrence, reminders).

---

## 1) Access & Membership Contracts

### 1.1 Auth (Keycloak)
- Source of truth for authentication.
- App maintains a minimal local `users` mirror keyed by Keycloak subject (`kc_sub`).

### 1.2 Membership rules
- **Project membership** controls access to project-wide objects (records, collections, views, assets).
- **Pane membership** controls access to:
  - the pane itself
  - the pane doc + doc comments + presence
  - pane-specific layout configuration

**Invariant:** `pane_members ⊆ project_members` (enforced by app logic).

### 1.3 No read-only (V1)
- If you are in a scope (project or pane), you can do everything in that scope.

---

## 2) Data Model Contracts (Tables / Entities)

> Note: This is an entity-level contract. Implementation can be SQL tables, SQLite schema, etc.  
> Primary keys assumed `UUID` unless otherwise stated.

### 2.1 Identity
#### `users`
- `user_id` (PK)
- `kc_sub` (unique)
- `display_name`
- `email` (optional)
- `created_at`, `updated_at`

### 2.2 Projects
#### `projects`
- `project_id` (PK)
- `name`
- `created_by` (FK users.user_id)
- `created_at`, `updated_at`

#### `project_members`
- `project_id` (FK projects)
- `user_id` (FK users)
- `role` (optional: `"owner" | "admin" | "member" | "guest"`, but no read-only semantics)
- `joined_at`
- **PK:** (`project_id`, `user_id`)
- **V1 role semantics:** `guest` is treated as a `member` alias (no reduced capability set in V1).

### 2.3 Panes + Doc (one doc per pane)
#### `panes`
- `pane_id` (PK)
- `project_id` (FK projects)
- `name`
- `sort_order` (int)
- `pinned` (bool)
- `layout_config` (json) — module grid + defaults
- `created_by` (FK users)
- `created_at`, `updated_at`

#### `pane_members`
- `pane_id` (FK panes)
- `user_id` (FK users)
- `joined_at`
- **PK:** (`pane_id`, `user_id`)

#### `docs`
- `doc_id` (PK)
- `pane_id` (FK panes, unique)
- `created_at`, `updated_at`

#### `doc_storage`
Stores CRDT/Yjs state and snapshots (storage backend abstracted).
- `doc_id` (FK docs, unique)
- `snapshot_version` (int)
- `snapshot_payload` (blob/json)
- `updated_at`

#### `doc_presence` (ephemeral / optional persistence)
- `doc_id`
- `user_id`
- `cursor_payload` (json)
- `last_seen_at`
- **PK:** (`doc_id`, `user_id`)

### 2.4 Collections (schema) + Records (data)
#### `collections`
- `collection_id` (PK)
- `project_id` (FK projects)
- `name`
- `icon` (optional)
- `color` (optional)
- `created_at`, `updated_at`

#### `collection_fields`
- `field_id` (PK)
- `collection_id` (FK collections)
- `name`
- `type` (enum):
  - `text | number | date | checkbox | select | multi_select | person | relation | file`
  - reserved for v2: `formula | rollup`
- `config` (json) — e.g. select options; relation target collection; file constraints
  - For `relation` type: `{ "target_collection_id": uuid, "cardinality": "one_to_one" | "one_to_many" | "many_to_many", "inverse_field_id"?: uuid }`
- `sort_order` (int)
- `created_at`, `updated_at`

#### `records`
- `record_id` (PK)
- `project_id` (FK projects)
- `collection_id` (FK collections)
- `title` (string)
- `created_by` (FK users)
- `created_at`, `updated_at`
- `archived_at` (nullable)

#### `record_values`
Typed values for flexible schemas.
- `record_id` (FK records)
- `field_id` (FK collection_fields)
- `value_json` (json) — normalized by field type
- `updated_at`
- **PK:** (`record_id`, `field_id`)

#### `record_relations`
Explicit edges (supports rollups later).
- `relation_id` (PK)
- `project_id` (FK projects)
- `from_record_id` (FK records)
- `to_record_id` (FK records)
- `via_field_id` (FK collection_fields) — relation field that defines/owns this link
- `created_by` (FK users)
- `created_at`
- **Uniqueness invariant:** (`project_id`, `from_record_id`, `to_record_id`, `via_field_id`) must be unique to prevent duplicate logical edges.

> **Rollup-ready hook:** `via_field_id` allows rollups to traverse relations deterministically.

### 2.5 Views (Table / Kanban now; others later)
#### `views`
- `view_id` (PK)
- `project_id` (FK projects)
- `collection_id` (FK collections)
- `type` (extensible enum)
  - V1 allowed values: `table | kanban`
  - Reserved for later phases: `list | calendar | timeline | gallery`
- `name`
- `config` (json)
  - visible fields
  - filters/sorts
  - grouping (kanban)
  - date-field mapping (calendar, later)
- `created_by`, `created_at`, `updated_at`

> V1 default: views are shared at project level (no per-user overrides yet).

### 2.6 Capabilities (Tasks, Events, Recurrence, Reminders)
#### `record_capabilities`
- `record_id` (FK records)
- `capability_type` (`task | calendar_event | recurring | remindable | meeting | milestone | capture`)
- `created_at`
- **PK:** (`record_id`, `capability_type`)

#### `task_state`
- `record_id` (PK, FK records)
- `status` (string; config can be select options in Tasks collection)
- `priority` (nullable)
- `completed_at` (nullable)
- `updated_at`

#### `assignments`
- `record_id` (FK records)
- `user_id` (FK users)
- `assigned_at`
- **PK:** (`record_id`, `user_id`)

#### `event_state`
- `record_id` (PK, FK records)
- `start_dt` (datetime)
- `end_dt` (datetime)
- `timezone` (IANA string, default project timezone)
- `location` (nullable)
- `updated_at`
- **Temporal invariants:** `start_dt <= end_dt`; `timezone` must be a valid IANA TZ identifier.
- **Datetime serialization:** `start_dt`, `end_dt`, and `updated_at` must be RFC 3339 / ISO 8601 timestamps with explicit timezone offset (`Z` or `±HH:MM`).

#### `event_participants`
Used for **Relevant** calendar filtering + notification targeting.  
**Not** a visibility gate (All shows everything).
- `record_id` (FK records)
- `user_id` (FK users)
- `role` (optional: organizer/required/optional)
- `added_at`
- **PK:** (`record_id`, `user_id`)

#### `recurrence_rules`
- `record_id` (PK, FK records)
- `rule_json` (json) — recurrence rule using iCal RRULE semantics or equivalent JSON shape:
  `{ "frequency": "daily|weekly|monthly", "interval": int, "byday": string[], "count": int|null, "until": datetime|null }`
- `updated_at`

#### `reminders`
- `reminder_id` (PK)
- `record_id` (FK records)
- `remind_at` (datetime)
- `channels` (json) — e.g. in_app/email
- `created_at`, `fired_at` (nullable)

### 2.7 Files (Attachments) + Asset Library (Nextcloud wrapper)
#### Attachments (Hub-owned)
##### `files`
- `file_id` (PK)
- `project_id` (FK projects)
- `name`
- `mime_type`
- `size_bytes`
- `hash` (optional)
- `created_by` (FK users)
- `created_at`

##### `file_blobs`
- `file_id` (PK, FK files)
- `storage_pointer` (string/json)
- `created_at`

##### `entity_attachments`
- `attachment_id` (PK)
- `project_id` (FK projects)
- `entity_type`
- `entity_id`
- `file_id` (FK files)
- `created_by` (FK users)
- `created_at`
- **Cross-project integrity invariant:** attachment `project_id`, attached entity project scope, and referenced file `project_id` must match.

#### Asset Library (Nextcloud)
##### `asset_roots`
- `asset_root_id` (PK)
- `project_id` (FK projects)
- `provider` (`nextcloud`)
- `root_path` (string)
- `connection_ref` (string/json) — reference to stored credentials/integration config
- `created_at`, `updated_at`

> V1 guarantee: asset listings reflect current Nextcloud state (no client-side caching).

### 2.8 Comments, Mentions, Backlinks
#### `comments`
- `comment_id` (PK)
- `project_id` (FK projects)
- `author_user_id` (FK users)
- `target_entity_type`
- `target_entity_id`
- `body_json` (json) — rich text/comment format
- `status` (`open | resolved`)
- `created_at`, `updated_at`

#### `comment_anchors` (doc-range comments)
- `comment_id` (PK, FK comments)
- `doc_id` (FK docs)
- `anchor_payload` (json) — strategy for stable ranges in Lexical/Yjs
- `created_at`, `updated_at`

#### `mentions`
Materialized mention edges for search/backlinks/notifications.
- `mention_id` (PK)
- `project_id` (FK projects)
- `source_entity_type`
- `source_entity_id`
- `target_entity_type`
- `target_entity_id`
- `context` (json) — snippet/anchor metadata
- `created_at`

> Backlinks are derived from `mentions` initially (can be materialized later).

### 2.9 Timeline, Notifications, Automations
#### `timeline_events` (append-only)
- `timeline_event_id` (PK)
- `project_id` (FK projects)
- `actor_user_id` (FK users)
- `event_type` (string)
- `primary_entity_type`
- `primary_entity_id`
- `secondary_entities_json` (json array of EntityRef)
- `summary_json` (json) — small, safe payload for display
- `created_at`

#### `notifications`
- `notification_id` (PK)
- `project_id` (FK projects)
- `user_id` (FK users)
- `reason` (`mention | assignment | reminder | comment_reply | automation`)
- `entity_type`
- `entity_id`
- `payload_json` (json)
- `read_at` (nullable)
- `created_at`

#### `automation_rules` (Activity Pieces public builder)
- `automation_rule_id` (PK)
- `project_id` (FK projects)
- `name`
- `enabled` (bool)
- `trigger_json` (json) — event type + filters
- `actions_json` (json) — list of actions
- `created_by`, `created_at`, `updated_at`

#### `automation_runs` (audit)
- `automation_run_id` (PK)
- `project_id` (FK projects)
- `automation_rule_id` (FK automation_rules)
- `status` (`queued | running | success | failed`)
- `input_event_json` (json)
- `output_json` (json)
- `started_at`, `finished_at`

> Internal execution may use n8n, but this contract never exposes n8n to users.

---

## 3) Module Contracts (UI Surfaces → Data Requirements)

### 3.1 Record Inspector (quick dismissible detail view)
**Open from:** table row, kanban card, mention, timeline item, calendar entry.

**Reads:**
- record core + all record_values
- capabilities state (task_state/event_state/recurrence/reminders)
- relations (in/out)
- attachments
- comments
- timeline slice (for this record)

**Writes:**
- update field value
- add/remove relation
- add/remove attachment
- add comment / resolve comment
- task actions (complete, change status, assign)
- event actions (reschedule, set participants, set recurrence/reminders)

### 3.2 Database Views (Table + Kanban)
**Reads:**
- view config + collection schema
- records with selected fields
- grouping metadata (kanban)

**Writes:**
- inline field edits
- create record
- move card between groups (updates a field)
- open record inspector

### 3.3 Tasks Module
**Definition:** records where capability includes `task`.

**Reads/Writes:**
- list tasks (filters: status, assignee, due date)
- create task
- assign users
- reminders
- open inspector

### 3.4 Calendar Module
**Definition:** records where capability includes `calendar_event`.

**Two built-in filters:**
- **Relevant:** events where `event_participants` includes current user
- **All:** all events in project

**Reads/Writes:**
- create event (from NLP or form)
- edit time/recurrence/reminders
- set participants (used for Relevant + notifications)
- open inspector

**Notification rule:**
- default notifications/reminders target `event_participants`, not “everyone”.

### 3.5 Timeline Module
**Reads:**
- timeline_events by project
- filters by entity type, actor, time

### 3.6 Files Module (Attachments)
**Reads/Writes:**
- upload attachment (creates file + blob)
- attach/detach to EntityRef
- browse attachments by entity/project

### 3.7 Asset Library Module (Nextcloud wrapper)
**Reads/Writes (via backend proxy to Nextcloud):**
- list folder entries
- upload/move/rename/delete
- embed folder listing into a pane doc

### 3.8 Inbox Module (Capture)
**Definition:** Capture records (capability includes `capture`).

**Reads/Writes:**
- create capture item (mini Lexical snippet + optional link/file)
- triage:
  - convert capture → record in another collection
  - attach/embed into pane doc (creates mention/backlink)
  - archive capture

### 3.9 Comments + Mentions
**Comments:**
- entity comments (record/file/etc.)
- doc-range comments anchored in `comment_anchors`

**Mentions:**
- mention detection from doc content + comments
- create `mentions` edges
- create notifications for mentioned users

### 3.10 Automations (Activity Pieces)
**Reads/Writes:**
- CRUD automation_rules
- view run history (automation_runs)
- triggers consume timeline-style event payloads

---

## 4) API Contracts (Payload Shapes)

> Endpoints are not named here; these are contract payloads.

### 4.1 Common response envelope
- `ok`: boolean
- `data`: object | null
- `error`: { `code`, `message` } | null

### 4.2 Pane
#### `PaneSummary`
- `pane_id`, `project_id`, `name`, `sort_order`, `pinned`
- `layout_config`
- `doc_id`
- `members`: [{ `user_id`, `display_name` }]

#### `GetPaneResponse`
- `pane`: PaneSummary

### 4.3 Doc
#### `DocSnapshot`
- `doc_id`
- `snapshot_version`
- `snapshot_payload`

#### `DocPresenceState`
- `doc_id`
- `users`: [{ `user_id`, `cursor_payload`, `last_seen_at` }]

### 4.4 Collections / Schema
#### `CollectionSchema`
- `collection_id`, `name`
- `fields`: [{ `field_id`, `name`, `type`, `config`, `sort_order` }]

### 4.5 Records
#### `RecordSummary`
- `record_id`, `collection_id`, `title`
- `fields`: { `field_id`: `value_json` } (subset)
- `updated_at`

#### `RecordDetail`
- `record_id`, `project_id`, `collection_id`, `title`
- `schema`: CollectionSchema
- `values`: { `field_id`: `value_json` }
- `capabilities`:
  - `task_state` (nullable)
  - `event_state` (nullable)
  - `recurrence_rule` (nullable)
  - `reminders` (list)
  - `participants` (list, for events)
  - `assignments` (list, for tasks)
- `relations`:
  - `outgoing`: [{ `relation_id`, `to_record_id`, `via_field_id` }]
  - `incoming`: [{ `relation_id`, `from_record_id`, `via_field_id` }]
- `attachments`: [{ `file_id`, `name`, `mime_type`, `size_bytes` }]
- `comments`: list of comment threads
- `activity`: list of timeline_events (scoped to record)

### 4.6 Views
#### `ViewConfig`
- `view_id`, `collection_id`, `type`, `name`
- `config` (json)

#### `ViewQueryRequest`
- `view_id` (or ad-hoc query with `collection_id + config`)
- `mode`: optional (e.g., for calendar: `relevant | all`)
- `pagination`: { `cursor`, `limit` }

#### `ViewQueryResponse`
- `schema`: CollectionSchema
- `records`: RecordSummary[]
- `next_cursor` (nullable)

### 4.7 Calendar creation from NLP
#### `CreateEventFromNlpRequest`
- `project_id`
- `pane_id` (optional: used only to prefill participants or log context)
- `nlp_fields_json` (matches your parser output)
- `participants_user_ids` (optional; default can be pane members or explicit selection)

**Result:**
- creates a Record in Events collection
- attaches `calendar_event` capability + recurrence/reminders if present
- adds participants
- logs timeline event
- sends notifications only to participants (if any notification is emitted)

### 4.8 Attachments
#### `UploadFileResponse`
- `file`: { `file_id`, `name`, `mime_type`, `size_bytes` }

#### `AttachFileRequest`
- `project_id`
- `entity`: EntityRef
- `file_id`

### 4.9 Comments
#### `CreateCommentRequest`
- `project_id`
- `target`: EntityRef
- `body_json`
- `anchor` (optional):
  - `doc_id`
  - `anchor_payload`

---

## 5) Event Contracts (Timeline / Notifications / Automations)

### 5.1 Event payload
- `event_type`
- `project_id`
- `actor_user_id`
- `primary_entity`: EntityRef
- `secondary_entities`: EntityRef[]
- `summary_json`
- `created_at`

### 5.2 Minimum event types (V1)
**Pane**
- `pane.created`
- `pane.updated`
- `pane.member_added`
- `pane.member_removed`

**Doc**
- `doc.snapshot_saved`
- `doc.comment_created`

**Records**
- `record.created`
- `record.updated`
- `record.archived`
- `record.relation_added`
- `record.relation_removed`

**Tasks**
- `task.assigned`
- `task.status_changed`
- `task.completed`
- `task.reminder_scheduled`

**Calendar**
- `event.created`
- `event.rescheduled`
- `event.participants_changed`
- `event.reminder_scheduled`
- `event.reminder_fired`

**Files**
- `file.uploaded`
- `file.attached`
- `file.detached`

**Comments / Mentions**
- `comment.created`
- `comment.resolved`
- `mention.created`

**Automations**
- `automation.rule_created`
- `automation.rule_updated`
- `automation.run_started`
- `automation.run_finished`

### 5.3 Notification rules (V1)
- Mentions → notify mentioned users
- Task assignment → notify assignees
- Event reminders → notify event participants
- Comment reply → notify thread participants (optional, but recommended)

No “broadcast to everyone” unless explicitly designed later.

---

## 6) Non-goals / V2 Hooks (explicitly planned)

### 6.1 Rollups (V2)
**Infra hooks already present:**
- `record_relations.via_field_id`
- extensible `collection_fields.type` includes reserved `rollup`
- room for a computed cache table later, e.g.:
  - `computed_values(record_id, field_id, value_json, updated_at)`

### 6.2 Formulas (V2)
**Infra hooks already present:**
- reserved `collection_fields.type = formula`
- evaluation engine + dependency graph to be added later

### 6.3 Versioned attachments (V2)
Plan to add:
- `file_versions` or `asset_versions` without changing attachment contract.

### 6.4 Analytics / Progress tracking (V2)
Derive from:
- task_state, timeline_events, record_values

### 6.5 Meeting transcription pipeline (V1.5/V2)
- Integration config table (Zoom)
- Asset ingestion
- Transcription (whisper.cpp locally or API key remote)
- Summary insertion into doc + record fields
- Emits timeline + notifications (scoped)

---

## 7) UX Contract Notes (non-code)
- Record detail UI is **quick dismissible** (slide-in from left or expand card).
- Panes are not pages; they are work canvases.
- No infinite nesting navigation.
- “Wiki” is implemented as Knowledge records + linking + backlinks + search, not a tree.

---
