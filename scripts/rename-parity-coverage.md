# Rename Parity Coverage

Source of truth: `scripts/rename-functional-parity.e2e.test.mjs`.

This document describes what the harness actually asserts today. It does not
list planned coverage or inferred behavior.

## Contract surface

The single rename-sensitive contract object lives at the top of
`scripts/rename-functional-parity.e2e.test.mjs` as `PARITY_CONTRACT`.

It currently centralizes:

- DB names: `projects`, `project_members`, `pending_project_invites`,
  `panes`, `pane_members`, `search_projects_fts`, `search_panes_fts`,
  `project_id`, `pane_id`, `space_id`, `coordination_pane_id`
- Index names: `idx_project_members_user_project`,
  `idx_projects_personal_owner`,
  `idx_pending_project_invites_project_status_created`,
  `idx_pending_project_invites_email_status`,
  `idx_pane_members_user_pane`
- API path segments: `projects`, `panes`
- Request keys: `project_id`, `source_pane_id`,
  `mutation_context_pane_id`, `asset_root_id`, `asset_path`,
  `entity_type`, `entity_id`, `root_path`, `path`, and the other current
  wire keys used by the test
- Response keys and strict response shapes for the exercised rename surfaces

The harness still contains non-contract string literals for fixture IDs,
non-rename table names, and non-rename fields such as `title`, `icon`,
`color`, and `config`.

## DB object coverage

### Tables asserted to exist

The schema test asserts exact table-name parity via `sqlite_master` for:

- `asset_roots`
- `assignments`
- `automation_rules`
- `automation_runs`
- `bug_reports`
- `calendar_feed_tokens`
- `chat_snapshots`
- `collection_fields`
- `collections`
- `comment_anchors`
- `comments`
- `doc_presence`
- `doc_storage`
- `docs`
- `entity_attachments`
- `event_participants`
- `event_state`
- `file_blobs`
- `files`
- `matrix_accounts`
- `mentions`
- `module_picker_seed_data`
- `notifications`
- `pane_members`
- `panes`
- `pending_project_invites`
- `personal_tasks`
- `project_members`
- `projects`
- `record_capabilities`
- `record_relations`
- `record_values`
- `records`
- `recurrence_rules`
- `reminders`
- `schema_version`
- `search_panes_fts`
- `search_panes_fts_config`
- `search_panes_fts_content`
- `search_panes_fts_data`
- `search_panes_fts_docsize`
- `search_panes_fts_idx`
- `search_projects_fts`
- `search_projects_fts_config`
- `search_projects_fts_content`
- `search_projects_fts_data`
- `search_projects_fts_docsize`
- `search_projects_fts_idx`
- `search_records_fts`
- `search_records_fts_config`
- `search_records_fts_content`
- `search_records_fts_data`
- `search_records_fts_docsize`
- `search_records_fts_idx`
- `task_state`
- `timeline_events`
- `users`
- `views`

### Tables asserted for exact column shape

The schema test also asserts exact `PRAGMA table_info(...)` shape
(column name, declared type, `NOT NULL`, and PK position) for:

- `projects`
- `project_members`
- `pending_project_invites`
- `panes`
- `pane_members`
- `docs`
- `collections`
- `records`
- `views`
- `files`
- `entity_attachments`
- `asset_roots`
- `chat_snapshots`
- `automation_rules`
- `automation_runs`
- `notifications`
- `timeline_events`
- `search_projects_fts`
- `search_panes_fts`
- `search_records_fts`

### Indexes asserted to exist

The schema test asserts exact index-name parity via `sqlite_master` for:

- `idx_attachments_asset_lookup`
- `idx_attachments_entity_lookup`
- `idx_automation_runs_rule_started`
- `idx_bug_reports_public_created`
- `idx_chat_snapshots_project_created`
- `idx_comments_entity_lookup`
- `idx_docs_pane_unique`
- `idx_event_participants_user_record`
- `idx_event_state_start`
- `idx_files_project_asset_path`
- `idx_mentions_target_lookup`
- `idx_module_picker_seed_module_size`
- `idx_notifications_user_unread_created`
- `idx_pane_members_user_pane`
- `idx_panes_project_sort`
- `idx_pending_project_invites_email_status`
- `idx_pending_project_invites_project_status_created`
- `idx_personal_tasks_user_updated`
- `idx_project_members_user_project`
- `idx_projects_personal_owner`
- `idx_record_relations_project_from`
- `idx_record_relations_project_to`
- `idx_record_relations_unique_edge`
- `idx_record_values_field_record`
- `idx_record_values_record_field`
- `idx_records_parent`
- `idx_records_project_collection_updated`
- `idx_records_project_source_pane`
- `idx_records_project_source_view`
- `idx_reminders_due_active`
- `idx_reminders_visible_undismissed`
- `idx_timeline_primary_lookup`
- `idx_timeline_project_created`
- `idx_views_project_collection_type`

## Trigger coverage

The schema test asserts exact trigger-name parity via `sqlite_master` for all
trigger names below. The behavior tests then exercise each trigger family as
follows.

### `pane_members_must_be_project_members`

- Positive: inserting `pane_members(pan_alpha_a, usr_member)` succeeds after
  `usr_member` is added to `project_members(prj_alpha, usr_member)`.
- Negative: inserting `pane_members(pan_alpha_a, usr_outsider)` throws
  `pane_members must be a subset of project_members`.

### `records_collection_project_consistency_insert`

- Positive: inserting `rec_consistent_insert` into `records` with
  `project_id='prj_alpha'` and `collection_id='col_alpha_a'` succeeds.
- Negative: inserting `rec_inconsistent_insert` with `project_id='prj_alpha'`
  and `collection_id='col_beta_a'` throws
  `records.project_id must match collections.project_id`.

### `records_collection_project_consistency_update`

- Positive: updating `rec_consistent_insert.collection_id` from `col_alpha_a`
  to `col_alpha_b` succeeds because both collections belong to `prj_alpha`.
- Negative: updating `rec_consistent_insert.project_id` to `prj_beta` throws
  `records.project_id must match collections.project_id`.
- Near-miss: updating only `rec_consistent_insert.title` succeeds.

### `record_relations_project_consistency_insert`

- Positive: inserting `rel_consistent_insert` from `rec_alpha_source` to
  `rec_alpha_target` in `prj_alpha` succeeds.
- Negative: inserting `rel_inconsistent_insert` from `rec_alpha_source` to
  `rec_beta_source` while keeping `project_id='prj_alpha'` throws
  `record_relations records must match relation project_id`.

### `record_relations_project_consistency_update`

- Positive: updating `rel_consistent_insert.to_record_id` to `rec_alpha_third`
  succeeds because the new target stays in `prj_alpha`.
- Positive: updating `rel_consistent_insert.via_field_id` from
  `fld_alpha_rel` to `fld_alpha_rel_two` succeeds because both fields belong to
  the same project.
- Negative: updating `rel_consistent_insert.project_id` to `prj_beta` while
  pointing at `rec_alpha_third` throws
  `record_relations records must match relation project_id`.

### `comment_anchor_requires_doc_target`

- Positive: inserting `comment_anchors(cmt_doc_ok, doc_alpha_a, node-anchor)`
  succeeds when `cmt_doc_ok` targets entity type `doc`.
- Negative: inserting `comment_anchors(cmt_record_bad, doc_alpha_a, node-anchor)`
  throws `comment_anchors require doc target` because `cmt_record_bad` targets a
  record instead of a doc.

### `comment_anchor_requires_node_key_insert`

- Positive: inserting `comment_anchors(cmt_doc_ok, doc_alpha_a, {kind:'node', ...})`
  succeeds.
- Negative: inserting `comment_anchors(cmt_bad_anchor_insert, doc_alpha_b, {kind:'text'})`
  throws `comment_anchors must be node-key anchors`.

### `comment_anchor_requires_node_key_update`

- Positive: updating only `comment_anchors.updated_at` for
  `cmt_bad_anchor_update` succeeds.
- Negative: updating `comment_anchors.anchor_payload` for
  `cmt_bad_anchor_update` to `{kind:'text'}` throws
  `comment_anchors must be node-key anchors`.

### `search_projects_fts_insert`

- Positive: inserting `projects(prj_search, 'Search Alpha', ...)` creates a
  matching row in `search_projects_fts`.
- Negative / near-miss: inserting unrelated `collections(col_search_unrelated, ...)`
  leaves the `search_projects_fts` row count unchanged.

### `search_projects_fts_update`

- Positive: updating `projects(prj_search).name` to `Search Beta` updates the
  mirrored FTS row.
- Negative / near-miss: updating only `projects(prj_search).position` leaves the
  mirrored FTS `name` unchanged.

### `search_projects_fts_delete`

- Positive: deleting `projects(prj_search)` removes the mirrored FTS row.
- Negative / near-miss: none beyond the update near-miss above.

### `search_panes_fts_insert`

- Positive: inserting `panes(pan_search, 'Search Pane', ...)` creates a
  matching row in `search_panes_fts`.
- Negative / near-miss: inserting unrelated `collections(col_search_unrelated, ...)`
  leaves the `search_panes_fts` row count unchanged.

### `search_panes_fts_update`

- Positive: updating `panes(pan_search).name` to `Search Pane Beta` updates the
  mirrored FTS row.
- Negative / near-miss: updating only `panes(pan_search).position` leaves the
  mirrored FTS `name` unchanged.

### `search_panes_fts_delete`

- Positive: deleting `panes(pan_search)` removes the mirrored FTS row.
- Negative / near-miss: none beyond the update near-miss above.

### `search_records_fts_insert`

- Positive: inserting `records(rec_search, 'Search Record', ...)` creates a
  matching row in `search_records_fts`.
- Negative / near-miss: inserting unrelated `collections(col_search_unrelated, ...)`
  leaves the `search_records_fts` row count unchanged.

### `search_records_fts_update`

- Positive: updating `records(rec_search).title` to `Search Record Beta`
  updates the mirrored FTS row.
- Negative / near-miss: updating only `records(rec_search).updated_at` leaves
  the mirrored FTS `title` unchanged.

### `search_records_fts_delete`

- Positive: deleting `records(rec_search)` removes the mirrored FTS row.
- Negative / near-miss: none beyond the update near-miss above.

## Cascade and nulling coverage

### Delete pane `pan_shared`

Starting row:

- `panes.pan_shared` in `prj_cascade`

Rows or fields asserted after delete:

- `records.rec_cascade.source_pane_id` becomes `NULL`
- Owner-access query for `prj_cascade` returns only `pan_private`

Rows-surviving expectation asserted:

- `pan_private` still exists and is still returned by the access query

### Delete user `usr_member`

Starting row:

- `users.usr_member`

Rows asserted deleted:

- `project_members` rows for `usr_member`
- `pane_members` rows for `usr_member`

Rows-surviving expectation asserted:

- None explicitly queried after the delete beyond the absence of
  `usr_member`-scoped memberships

### Delete project `prj_cascade`

Starting row:

- `projects.prj_cascade`

Rows asserted deleted:

- `panes` rows with `project_id='prj_cascade'`
- `docs` rows for `pan_shared` and `pan_private`
- `collections` rows with `project_id='prj_cascade'`
- `records` rows with `project_id='prj_cascade'`
- `asset_roots` rows with `project_id='prj_cascade'`
- `files` rows with `project_id='prj_cascade'`
- `entity_attachments` rows with `project_id='prj_cascade'`

Rows-surviving expectation asserted:

- `projects.prj_other` still exists
- `panes.pan_other` still exists
- `docs(doc_other)` still exists
- `collections.col_other` still exists
- `records.rec_other` still exists
- `asset_roots.ast_other` still exists
- `files.fil_other` still exists
- `entity_attachments.att_other` still exists

## Behavioral query coverage

### Access predicate query

Exact query under test:

```sql
SELECT p.pane_id AS work_id
FROM panes p
LEFT JOIN project_members owners
  ON owners.project_id = p.project_id
  AND owners.user_id = ?
  AND owners.role = 'owner'
LEFT JOIN pane_members editors
  ON editors.pane_id = p.pane_id
  AND editors.user_id = ?
WHERE p.project_id = ?
  AND (owners.user_id IS NOT NULL OR editors.user_id IS NOT NULL)
ORDER BY p.sort_order ASC, p.pane_id ASC
```

Fixture setup:

- Users: `usr_owner`, `usr_member`, `usr_extra`
- Projects: `prj_cascade`, `prj_other`
- Panes:
  - `pan_shared` in `prj_cascade`
  - `pan_private` in `prj_cascade`
  - `pan_other` in `prj_other`
- Memberships:
  - `usr_owner` owner of `prj_cascade`
  - `usr_owner` owner of `prj_other`
  - `usr_member` member of `prj_cascade`
  - `usr_member` explicit editor on `pan_shared`

Variants asserted:

- Owner case: `usr_owner` in `prj_cascade` gets `['pan_shared', 'pan_private']`
- Member case: `usr_member` in `prj_cascade` gets `['pan_shared']`
- Non-member case: `usr_extra` in `prj_cascade` gets `[]`
- Removed-editor case: after deleting `pane_members(pan_shared, usr_member)`,
  `usr_member` in `prj_cascade` gets `[]`
- Wrong-space case: `usr_member` in `prj_other` gets `[]`
- Missing-space case: `usr_member` in `prj_missing` gets `[]`
- Post-pane-delete case: after deleting `pan_shared`, `usr_owner` in
  `prj_cascade` gets `['pan_private']`

## API coverage

Response shape note:

- Wherever the harness calls `assertExactKeys(...)` or
  `assertExactArrayItemKeys(...)`, it is enforcing exact key equality.
- If a route is not listed below as "strict shape", the harness only asserts
  success/failure status and a smaller semantic subset.

### Auxiliary auth/bootstrap routes

#### `GET /api/hub/me`

- Cases:
  - unauthenticated -> exact `401`
  - authenticated -> success envelope only
- Request fields: none
- Response assertions:
  - no strict shape assertion
  - extracts `data.user.user_id` for later fixtures

### Rename-touched project routes

#### `GET /api/hub/projects`

- Status codes pinned:
  - unauthenticated -> `401`
  - authenticated success -> `200`
- Request fields: none
- Response assertions:
  - exact envelope data keys: `projects`
  - every project item exact keys:
    `project_id`, `name`, `created_by`, `created_at`, `updated_at`,
    `position`, `is_personal`, `membership_role`, `needs_name_prompt`
  - list contains `prj_api_parity`

#### `POST /api/hub/projects`

- Status codes pinned:
  - create success -> `201`
  - duplicate `project_id` -> `409`
  - missing `name` -> `400`
- Request fields sent:
  - success: `name`, `project_id`
  - duplicate: `name`, `project_id`
  - invalid: `project_id`
- Response assertions:
  - success exact envelope data keys: `project`
  - success exact project keys:
    `project_id`, `name`, `created_by`, `created_at`, `updated_at`,
    `position`, `is_personal`, `membership_role`, `needs_name_prompt`

#### `GET /api/hub/projects/:projectId`

- Status codes pinned:
  - member success -> `200`
  - non-member -> `404`
- Request fields: none
- Response assertions:
  - success exact envelope data keys: `project`
  - success exact project keys:
    `project_id`, `name`, `created_by`, `created_at`, `updated_at`,
    `position`, `is_personal`, `membership_role`, `needs_name_prompt`

#### `PATCH /api/hub/projects/:projectId`

- Status codes pinned:
  - success -> `200`
  - invalid negative `position` -> `400`
- Request fields sent:
  - success: `name`, `position`
  - invalid: `position`
- Response assertions:
  - exact envelope data keys: `project`
  - exact project keys:
    `project_id`, `name`, `created_by`, `created_at`, `updated_at`,
    `position`, `is_personal`, `membership_role`, `needs_name_prompt`

#### `GET /api/hub/projects/:projectId/members`

- Status codes pinned:
  - success -> `200`
- Request fields: none
- Response assertions:
  - exact envelope data keys: `members`, `pending_invites`
  - exact member item keys:
    `project_id`, `user_id`, `role`, `joined_at`, `display_name`, `email`
  - confirms `memberId` is present
  - does not currently assert invite item shape because this flow does not
    create a pending invite

#### `POST /api/hub/projects/:projectId/members`

- Status codes pinned:
  - success -> `200`
  - duplicate member -> `409`
- Request fields sent:
  - `user_id`, `role`
- Response assertions:
  - exact data keys: `project_id`, `user_id`, `role`

#### `DELETE /api/hub/projects/:projectId/members/:userId`

- Status codes pinned:
  - success -> `200`
  - post-removal access check on removed user -> `404` from subsequent
    `GET /api/hub/projects/:projectId`
- Request fields: none
- Response assertions:
  - exact data keys: `removed`

### Rename-touched pane routes

#### `GET /api/hub/projects/:projectId/panes`

- Status codes pinned:
  - member success -> `200`
  - non-member -> `403`
- Request fields: none
- Response assertions:
  - exact envelope data keys: `panes`
  - every pane item exact keys:
    `pane_id`, `project_id`, `name`, `sort_order`, `position`, `pinned`,
    `layout_config`, `doc_id`, `members`, `can_edit`
  - owner default list contains the default pane
  - member list length is `3`
  - member list distinguishes `can_edit=true` on assigned pane and
    `can_edit=false` on private pane

#### `POST /api/hub/projects/:projectId/panes`

- Status codes pinned:
  - success -> `201`
- Request fields sent:
  - assigned pane case:
    `name`, `pinned`, `layout_config`, `position`, `sort_order`,
    `member_user_ids`
  - private pane case:
    `name`, `pinned`, `layout_config`, `position`, `sort_order`
- Response assertions:
  - exact envelope data keys: `pane`
  - exact pane keys:
    `pane_id`, `project_id`, `name`, `sort_order`, `position`, `pinned`,
    `layout_config`, `doc_id`, `members`, `can_edit`

#### `PATCH /api/hub/panes/:paneId`

- Status codes pinned:
  - assigned pane success -> `200`
  - private pane forbidden update -> `403`
- Request fields sent:
  - success:
    `name`, `pinned`, `position`, `sort_order`, `layout_config`
  - forbidden case:
    `name`
- Response assertions:
  - success exact envelope data keys: `pane`
  - success exact pane keys:
    `pane_id`, `project_id`, `name`, `sort_order`, `position`, `pinned`,
    `layout_config`, `doc_id`, `members`, `can_edit`

#### `POST /api/hub/panes/:paneId/members`

- Status codes pinned:
  - success -> `200`
  - non-project-member add -> `400`
- Request fields sent:
  - `user_id`
- Response assertions:
  - success exact envelope data keys: `pane`
  - success exact pane keys:
    `pane_id`, `project_id`, `name`, `sort_order`, `position`, `pinned`,
    `layout_config`, `doc_id`, `members`, `can_edit`

### Rename-touched collection and record routes

#### `GET /api/hub/projects/:projectId/collections`

- Status codes pinned:
  - success -> `200`
- Request fields: none
- Response assertions:
  - exact envelope data keys: `collections`
  - every collection item exact keys:
    `collection_id`, `project_id`, `name`, `icon`, `color`,
    `created_at`, `updated_at`

#### `POST /api/hub/projects/:projectId/collections`

- Status codes pinned:
  - success -> `201`
- Request fields sent:
  - `name`, `icon`, `color`
- Response assertions:
  - exact data keys: `collection_id`

#### `GET /api/hub/collections/:collectionId/fields`

- Status codes pinned:
  - success -> `200`
- Request fields: none
- Response assertions:
  - exact envelope data keys: `fields`
  - every field item exact keys:
    `field_id`, `collection_id`, `name`, `type`, `config`, `sort_order`

#### `POST /api/hub/collections/:collectionId/fields`

- Status codes pinned:
  - success -> `201`
- Request fields sent:
  - `name`, `type`, `config`
- Response assertions:
  - exact data keys: `field_id`

#### `POST /api/hub/projects/:projectId/records`

- Status codes pinned:
  - success -> `201`
- Request fields sent:
  - `collection_id`, `title`, `source_pane_id`
- Response assertions:
  - exact data keys: `record_id`

### Rename-touched file and asset routes

#### `GET /api/hub/projects/:projectId/asset-roots`

- Status codes pinned:
  - success -> `200`
- Request fields: none
- Response assertions:
  - exact envelope data keys: `asset_roots`
  - every asset root item exact keys:
    `asset_root_id`, `project_id`, `provider`, `root_path`,
    `connection_ref`, `created_at`, `updated_at`

#### `POST /api/hub/projects/:projectId/asset-roots`

- Status codes pinned:
  - success -> `201`
  - unsupported provider -> `400`
- Request fields sent:
  - success: `provider`, `root_path`
  - invalid: `provider`, `root_path`
- Response assertions:
  - success exact data keys: `asset_root_id`

#### `POST /api/hub/projects/:projectId/assets/upload`

- Status codes pinned:
  - success -> `200`
- Request fields sent:
  - `asset_root_id`, `path`, `name`, `mime_type`, `content_base64`
- Response assertions:
  - exact data keys:
    `uploaded`, `provider`, `asset_root_id`, `path`, `proxy_url`

#### `GET /api/hub/projects/:projectId/assets/list`

- Status codes pinned:
  - root list success -> `200`
  - subdirectory list success -> `200`
- Query params sent:
  - `asset_root_id`, `path`
- Response assertions:
  - exact data keys: `provider`, `path`, `entries`
  - every entry exact keys: `name`, `path`, `proxy_url`
  - root listing contains `Uploads`
  - subdirectory listing contains `Uploads/asset.txt`

#### `GET /api/hub/projects/:projectId/assets/proxy`

- Status codes pinned:
  - success -> `200`
- Query params sent:
  - `asset_root_id`, `path`
- Response assertions:
  - response body equals `asset-bytes`
  - no JSON shape assertion; this is a raw proxy response

#### `DELETE /api/hub/projects/:projectId/assets/delete`

- Status codes pinned:
  - success -> `200`
- Query params sent:
  - `asset_root_id`, `path`
- Response assertions:
  - exact data keys: `deleted`

#### `POST /api/hub/files/upload`

- Status codes pinned:
  - project-scoped upload success -> `201`
  - pane-scoped upload success -> `201`
  - member project write without pane context -> `403`
  - invalid base64 -> `400`
- Request fields sent:
  - project file:
    `project_id`, `name`, `mime_type`, `content_base64`, `metadata`
  - pane file:
    `project_id`, `name`, `mime_type`, `content_base64`,
    `mutation_context_pane_id`, `metadata`
  - forbidden file:
    `project_id`, `name`, `mime_type`, `content_base64`
  - invalid file:
    `project_id`, `name`, `mime_type`, `content_base64`
- Response assertions:
  - success exact envelope data keys: `file`
  - upload file exact keys:
    `file_id`, `project_id`, `asset_root_id`, `provider`, `asset_path`,
    `name`, `mime_type`, `size_bytes`, `metadata`, `proxy_url`
  - pane-scoped upload additionally asserts
    `file.metadata.pane_id === assignedPane.pane_id`

#### `GET /api/hub/projects/:projectId/files`

- Status codes pinned:
  - full list success -> `200`
  - pane-scoped list success -> `200`
  - pane scope without `pane_id` -> `400`
  - pane scope with missing pane -> `404`
- Query params sent:
  - none
  - `scope=pane&pane_id=<assignedPane>`
  - `scope=pane`
  - `scope=pane&pane_id=pan_missing`
- Response assertions:
  - exact envelope data keys: `files`
  - listed file exact keys:
    `file_id`, `project_id`, `asset_root_id`, `provider`, `asset_path`,
    `provider_path`, `name`, `mime_type`, `size_bytes`, `created_by`,
    `created_at`, `scope`, `pane_id`, `metadata`, `proxy_url`
  - full list contains the project-scoped uploaded file
  - pane-only list equals the pane-scoped uploaded file only

#### `POST /api/hub/attachments`

- Status codes pinned:
  - success -> `201`
- Request fields sent:
  - `project_id`, `entity_type`, `entity_id`, `provider`,
    `asset_root_id`, `asset_path`, `name`, `mime_type`, `size_bytes`,
    `mutation_context_pane_id`, `metadata`
- Response assertions:
  - exact envelope data keys: `attachment_id`, `attachment`
  - exact attachment keys:
    `attachment_id`, `project_id`, `entity_type`, `entity_id`, `provider`,
    `asset_root_id`, `asset_path`, `name`, `mime_type`, `size_bytes`,
    `metadata`, `proxy_url`

#### `DELETE /api/hub/attachments/:attachmentId`

- Status codes pinned:
  - success -> `200`
- Query params sent:
  - `mutation_context_pane_id`
- Response assertions:
  - exact data keys: `deleted`

## Known omissions in current coverage

These are intentional omissions from this document because the test does not
assert them today:

- No exact success-status assertion for `GET /api/hub/me`
- No strict shape assertion for the successful `/api/hub/me` payload
- No pending-invite creation flow, so no runtime shape assertion for
  `pending_invite` payloads despite `pendingInvite` existing in the contract.
  This becomes required when the broader refactor's permission work begins.
