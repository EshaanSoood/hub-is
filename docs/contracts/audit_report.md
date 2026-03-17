# Hub OS Contract Compliance Audit Report

## Scope
- Canonical contracts:
  - `docs/contracts/Hub OS — Unified Contracts (V1).md`
  - `docs/contracts/Project Space UI Contracts — v1 (Code).md`
- This pass implements the contract-critical features only:
  1. Node-anchored doc comments.
  2. Mentions -> materialized edges -> notifications -> backlinks panel.
  3. Lexical ViewRef embeds for Table/Kanban views.
  4. Record Inspector relation editing (outgoing/incoming + add/remove).

## Files Updated
- API: `apps/hub-api/hub-api.mjs`
- Client API: `src/services/hubContractApi.ts`
- Project Space UI: `src/pages/ProjectSpacePage.tsx`
- Lexical editor wiring: `src/features/notes/CollaborativeLexicalEditor.tsx`
- Lexical ViewRef node/runtime:
  - `src/features/notes/nodes/ViewRefNode.tsx`
  - `src/features/notes/viewEmbedContext.tsx`
- New UI components:
  - `src/components/project-space/CommentComposer.tsx`
  - `src/components/project-space/CommentRail.tsx`
  - `src/components/project-space/MentionPicker.tsx`
  - `src/components/project-space/BacklinksPanel.tsx`
  - `src/components/project-space/ViewEmbedBlock.tsx`
  - `src/components/project-space/RelationsSection.tsx`
  - `src/components/project-space/RelationPicker.tsx`
  - `src/components/project-space/RelationRow.tsx`
- Mention parsing helper: `src/features/notes/mentionTokens.ts`
- Smoke tests: `scripts/contract_smoke_test.mjs`

## Contract Feature 1: Node-Anchored Doc Comments
- Access gate unchanged and enforced via `requireDocAccess` (project member + pane member).
- `POST /api/hub/comments/doc-anchor`:
  - Requires `anchor_payload.kind="node"` and `anchor_payload.nodeKey`.
  - Supports mention refs in comment body (`mentions[]`) and materializes edges from source `comment`.
- `GET /api/hub/comments?project_id=...&doc_id=...`:
  - Returns `comments` and `orphaned_comments`.
  - Each row now carries both `orphaned` (contract-facing) and `is_orphaned` (compat).
- `POST /api/hub/comments/:comment_id/status` resolves/reopens comment threads.
- UI wiring:
  - "Comment on block" action uses focused Lexical `nodeKey`.
  - Dialog composer supports Esc-close and focus return to invoking control.
  - Comment click attempts focus/scroll to the anchored node.
  - Orphaned comments are rendered in a dedicated section.

## Contract Feature 2: Mentions, Materialized Edges, Notifications, Backlinks

### New/Updated endpoints
- `GET /api/hub/projects/:project_id/mentions/search?q=&limit=`
  - Searches project members (`user`) and project records (`record`).
  - Returns `EntityRef`-style items with labels and metadata.
- `POST /api/hub/comments`
  - Accepts `mentions[]` (user/record refs); materializes mention edges from source `comment`.
- `POST /api/hub/comments/doc-anchor`
  - Accepts `mentions[]` and materializes source `comment` mention edges.
- `POST /api/hub/mentions/materialize`
  - Supports `replace_source` for source reconciliation (used by doc-save flow).
- `GET /api/hub/projects/:project_id/backlinks?target_entity_type=&target_entity_id=`
  - Returns mention-backed backlinks, including doc/pane/node context for navigation.

### Mention materialization behavior
- Source of mention refs is client-sent (contract-allowed):
  - Comment composers parse body tokens and send `mentions[]` during create.
  - Doc save path extracts mention tokens from Lexical state and calls materialization with `replace_source=true`.
- Server validates targets:
  - `user` must be a project member.
  - `record` must exist in the same project and not be archived.
- Server deduplicates by `source + target` and only creates notifications for newly inserted `user` mentions.

### UI wiring
- Mention insertion now available in:
  - Doc content (via MentionPicker -> inline token insertion).
  - Comment composers (doc comment dialog + record inspector comments).
- Record inspector now includes "Backlinks / Mentions" panel.
- Backlink items navigate back to pane docs and focus anchored nodes when available.

## Contract Feature 3: View Embeds in Lexical (ViewRef)
- Added custom Lexical node type `view-ref`:
  - Stable serialized shape with versioned payload (`version: 1`, `view_id`, `sizing`).
- Added runtime renderer (`ViewEmbedBlock`):
  - Calls `POST /api/hub/views/query`.
  - Renders compact table/kanban preview.
  - Provides `Open` action and row/card open-to-inspector behavior.
- Added insertion UX in Work doc surface:
  - View picker (`listbox`-style select) + "Insert view block" action.
  - Inserts `ViewRefNode` into Lexical content.

## Contract Feature 4: Record Inspector Relations Editing

### New/Updated endpoints
- `GET /api/hub/projects/:project_id/records/search?query=&collection_id=&exclude_record_id=&limit=`
  - Record-only relation candidate search.
  - Requires project membership.
- `POST /api/hub/records/:record_id/relations`
  - Adds relation edge via `via_field_id`.
  - Validates `project_id`, source/target records, relation field type, project consistency, and optional relation target collection config.
  - Rejects duplicate `(from_record_id, to_record_id, via_field_id)` edges.
- `DELETE /api/hub/relations/:relation_id?project_id=`
  - Removes relation edge in-project for project members.

### RecordDetail relation payload
- `RecordDetail.relations.outgoing` now includes:
  - `relation_id`, `to_record_id`, `via_field_id`
  - `to_record`: `{ record_id, title, collection_id, collection_name }`
- `RecordDetail.relations.incoming` now includes:
  - `relation_id`, `from_record_id`, `via_field_id`
  - `from_record`: `{ record_id, title, collection_id, collection_name }`

### Access rules
- Relations remain project-scoped; only project membership is required.
- Pane membership is not used for relation operations.

### Timeline events
- Relation add: `record.relation_added`
- Relation remove: `record.relation_removed`

## Envelope + Access Rules
- All new API responses use `{ ok, data, error }` envelope.
- No nested page navigation added.
- No spreadsheet behavior was added.
- Pane membership remains the doc gate; views/records remain project-scoped.
- No localStorage was introduced as source-of-truth for panes/docs/views.

## Smoke Test Coverage Additions (`scripts/contract_smoke_test.mjs`)
- Added/updated checks for:
  1. Node-anchored doc comment creation + list payload anchor validation.
  2. Orphan classification after anchored node deletion.
  3. Mention in comment targeting a user -> mention notification created.
  4. Record mention from doc source -> mention edge materialized -> backlinks query returns doc backlink.
  5. ViewRef node saved in doc snapshot -> view query succeeds -> pane gate still enforced on doc access.
  6. Relation field creation + relation candidate search + add relation + outgoing/incoming RecordDetail assertions + remove relation roundtrip.

## Verification Status
- `npm run lint` -> PASS
- `npm run typecheck` -> PASS
- `npm run build` -> PASS
- `node --check apps/hub-api/hub-api.mjs` -> PASS
- `node scripts/contract_smoke_test.mjs` -> BLOCKED in this environment (missing `TOKEN_A`, `TOKEN_B`).

## Remaining Known Gaps
- `scripts/contract_smoke_test.mjs`: full runtime execution requires `TOKEN_A` and `TOKEN_B` to validate live authz/notification behavior end-to-end.
