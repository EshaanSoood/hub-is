# Data Model Implementation Report (Contract V1)

## Final Reality
- Persistence layer is SQLite in `apps/hub-api/hub-api.mjs`.
- Schema is contract-first and exclusive (legacy schema removed).
- Runtime bootstrap behavior:
  - On startup, server checks contract table set + `schema_version=1`.
  - Destructive reset requires explicit opt-in: `HUB_API_ALLOW_SCHEMA_RESET=true`.
  - If schema is missing/incompatible and reset is not allowed, startup fails fast with an error.
  - If reset is allowed, it drops non-system tables/triggers/views and recreates contract schema v1.

## Final Schema (implemented)
All tables below are implemented in `resetSchemaToContractV1()`.

### Identity and membership
- `users`
- `projects`
- `project_members`

### Panes and docs
- `panes`
- `pane_members`
- `docs`
- `doc_storage`
- `doc_presence`

### Collections and records
- `collections`
- `collection_fields`
- `records`
- `record_values`
- `record_relations`
- `views`

### Capabilities
- `record_capabilities`
- `task_state`
- `assignments`
- `event_state`
- `event_participants`
- `recurrence_rules`
- `reminders`

### Files and assets
- `files`
- `file_blobs`
- `entity_attachments`
- `asset_roots`

`file_blobs` remains in the schema for contract completeness but is reserved/not used in V1 web flows.
Actual binary storage is Nextcloud (`asset_roots`), while Hub persists provider references and metadata in `files` and `entity_attachments`.

### Comments/mentions
- `comments`
- `comment_anchors`
- `mentions`

### Timeline/notifications/automation
- `timeline_events`
- `notifications`
- `automation_rules`
- `automation_runs`

### Schema control
- `schema_version`

## Keys and Constraints
- PK/FK relationships exist for all core ownership paths.
- Enforced uniqueness:
  - one doc per pane: `docs.pane_id UNIQUE`
  - one storage row per doc: `doc_storage.doc_id PK`
  - composite membership/value constraints via composite PKs.

## Implemented Invariants
### Pane membership subset of project membership
- Enforced by trigger:
  - `pane_members_must_be_project_members`

### Record project consistency
- Enforced by triggers:
  - `records_collection_project_consistency_insert`
  - `records_collection_project_consistency_update`

### Relation project consistency
- Enforced by triggers:
  - `record_relations_project_consistency_insert`
  - `record_relations_project_consistency_update`

### Doc-range comment anchor guard
- Enforced by trigger:
  - `comment_anchor_requires_doc_target`
  - blocks anchor insert unless comment target entity type is `doc` and entity id matches `doc_id`.

## Indexing (implemented)
High-priority indexes from contract are present:
- Membership/pane traversal:
  - `idx_project_members_user_project`
  - `idx_pane_members_user_pane`
  - `idx_panes_project_sort`
- Records/values/relations:
  - `idx_records_project_collection_updated`
  - `idx_record_values_field_record`
  - `idx_record_values_record_field`
  - `idx_record_relations_project_from`
  - `idx_record_relations_project_to`
- Views/calendar participants:
  - `idx_views_project_collection_type`
  - `idx_event_state_start`
  - `idx_event_participants_user_record`
- Attachments/comments/mentions:
  - `idx_attachments_entity_lookup`
  - `idx_comments_entity_lookup`
  - `idx_mentions_target_lookup`
- Timeline/notifications/automation:
  - `idx_timeline_project_created`
  - `idx_timeline_primary_lookup`
  - `idx_notifications_user_unread_created`
  - `idx_automation_runs_rule_started`

## Mapping to Contract Entities
- Identity: `users`, `project_members`
- Project container: `projects`
- Workspace/pane model: `panes`, `pane_members`, `docs`, `doc_storage`, `doc_presence`
- Relational data model: `collections`, `collection_fields`, `records`, `record_values`, `record_relations`, `views`
- Capability overlays: `record_capabilities`, `task_state`, `assignments`, `event_state`, `event_participants`, `recurrence_rules`, `reminders`
- Attachments + asset roots: `files`, `file_blobs`, `entity_attachments`, `asset_roots`
- Conversation graph: `comments`, `comment_anchors`, `mentions`
- Activity + delivery + automation: `timeline_events`, `notifications`, `automation_rules`, `automation_runs`

## Migration / Reset Strategy Used
- Strategy selected: contract bootstrap/reset (single authoritative v1 schema creation path).
- Behavior:
  - incompatible DB state is dropped and rebuilt.
  - no legacy table compatibility path retained.
- Reasoning:
  - user requirement explicitly allows clean-slate schema replacement.
  - app is single-user/not live and prioritizes strict contract alignment.

## Vertical Slice Minimum Schema Checklist
Required for UI vertical slice and all present:
1. Project/membership: **present**
2. Pane/pane_members/doc/doc_storage: **present**
3. Collections/fields/records/values/views: **present**
4. Record capabilities (task/event/reminder/participants): **present**
5. Comments + anchors + mentions: **present**
6. Timeline + notifications: **present**
7. Files + entity attachments: **present**
8. Asset roots: **present**
9. Automation rules/runs scaffold: **present**
