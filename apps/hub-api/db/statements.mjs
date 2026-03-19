/**
 * Centralized data access layer for hub-api.
 *
 * This module is the seam between application logic and the database engine:
 * every reusable prepared statement is defined in one place so the rest of the
 * code can depend on stable statement contracts instead of SQLite-specific
 * inline SQL. Keeping the catalog centralized is the first step toward a future
 * migration from SQLite to Postgres.
 */
export const createStatements = (db) => ({
  users: {
    findBySub: db.prepare('SELECT * FROM users WHERE kc_sub = ?'),
    findById: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    findByEmail: db.prepare('SELECT * FROM users WHERE LOWER(COALESCE(email, \'\')) = LOWER(?) LIMIT 1'),
    insert: db.prepare(`
      INSERT INTO users (user_id, kc_sub, display_name, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE users
      SET display_name = ?, email = ?, updated_at = ?
      WHERE user_id = ?
    `),
  },
  projects: {
    updateTasksCollection: db.prepare(`
      UPDATE projects
      SET tasks_collection_id = ?, updated_at = ?
      WHERE project_id = ?
    `),
    updateRemindersCollection: db.prepare(`
      UPDATE projects
      SET reminders_collection_id = ?, updated_at = ?
      WHERE project_id = ?
    `),
    findById: db.prepare('SELECT * FROM projects WHERE project_id = ?'),
    findByIdWithMembership: db.prepare(`
      SELECT p.*, pm.role AS membership_role, pm.joined_at
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.project_id
      WHERE p.project_id = ? AND pm.user_id = ?
    `),
    findPersonalProject: db.prepare(`
      SELECT p.*, pm.role AS membership_role, pm.joined_at
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.project_id
      WHERE pm.user_id = ?
        AND p.created_by = ?
        AND p.project_type = 'personal'
      ORDER BY p.created_at ASC
      LIMIT 1
    `),
    listPersonalMissingTasksCollectionIds: db.prepare(`
      SELECT p.project_id
      FROM projects p
      WHERE p.project_type = 'personal'
        AND COALESCE(p.tasks_collection_id, '') = ''
      ORDER BY p.created_at ASC, p.project_id ASC
    `),
    listPersonalMissingRemindersCollectionIds: db.prepare(`
      SELECT p.project_id
      FROM projects p
      WHERE p.project_type = 'personal'
        AND COALESCE(p.reminders_collection_id, '') = ''
      ORDER BY p.created_at ASC, p.project_id ASC
    `),
    listForUser: db.prepare(`
      SELECT p.*, pm.role AS membership_role, pm.joined_at
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.project_id
      WHERE pm.user_id = ?
      ORDER BY p.updated_at DESC
    `),
    insert: db.prepare(`
      INSERT INTO projects (project_id, name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    insertWithType: db.prepare(`
      INSERT INTO projects (project_id, name, created_by, project_type, is_personal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
  },
  projectMembers: {
    listForUser: db.prepare(`
      SELECT project_id, role, joined_at
      FROM project_members
      WHERE user_id = ?
      ORDER BY joined_at ASC
    `),
    listWithUsers: db.prepare(`
      SELECT pm.project_id, pm.user_id, pm.role, pm.joined_at, u.display_name, u.email
      FROM project_members pm
      JOIN users u ON u.user_id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY pm.joined_at ASC
    `),
    countOwners: db.prepare(`
      SELECT COUNT(*) AS owner_count
      FROM project_members
      WHERE project_id = ? AND role = 'owner'
    `),
    insert: db.prepare(`
      INSERT OR REPLACE INTO project_members (project_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?)
    `),
    delete: db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?'),
    listPendingInvites: db.prepare(`
      SELECT *
      FROM pending_project_invites
      WHERE project_id = ? AND status = 'pending'
      ORDER BY created_at DESC, invite_request_id DESC
    `),
    findInvite: db.prepare('SELECT * FROM pending_project_invites WHERE invite_request_id = ? LIMIT 1'),
    findPendingByEmail: db.prepare(`
      SELECT *
      FROM pending_project_invites
      WHERE project_id = ?
        AND LOWER(email) = LOWER(?)
        AND status = 'pending'
      LIMIT 1
    `),
    insertInvite: db.prepare(`
      INSERT INTO pending_project_invites (
        invite_request_id,
        project_id,
        email,
        role,
        requested_by_user_id,
        status,
        target_user_id,
        reviewed_by_user_id,
        reviewed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `),
    updateInvite: db.prepare(`
      UPDATE pending_project_invites
      SET status = ?, target_user_id = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ?
      WHERE invite_request_id = ?
    `),
    isMember: db.prepare('SELECT 1 AS ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1'),
    getRole: db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1'),
  },
  panes: {
    findById: db.prepare('SELECT * FROM panes WHERE pane_id = ?'),
    listMembers: db.prepare(`
      SELECT pm.user_id, u.display_name
      FROM pane_members pm
      JOIN users u ON u.user_id = pm.user_id
      LEFT JOIN project_members prj ON prj.project_id = (SELECT project_id FROM panes WHERE pane_id = pm.pane_id) AND prj.user_id = pm.user_id
      WHERE pm.pane_id = ?
        AND COALESCE(prj.role, 'member') != 'owner'
      ORDER BY pm.joined_at ASC
    `),
    listForProject: db.prepare(`
      SELECT p.*
      FROM panes p
      WHERE p.project_id = ?
      ORDER BY p.sort_order ASC, p.created_at ASC
    `),
    nextSortOrder: db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM panes WHERE project_id = ?'),
    insert: db.prepare(`
      INSERT INTO panes (pane_id, project_id, name, sort_order, pinned, layout_config, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE panes
      SET name = ?, sort_order = ?, pinned = ?, layout_config = ?, updated_at = ?
      WHERE pane_id = ?
    `),
    delete: db.prepare('DELETE FROM panes WHERE pane_id = ?'),
  },
  paneMembers: {
    isMember: db.prepare('SELECT 1 AS ok FROM pane_members WHERE pane_id = ? AND user_id = ? LIMIT 1'),
    listUserIds: db.prepare('SELECT user_id FROM pane_members WHERE pane_id = ? ORDER BY joined_at ASC'),
    insert: db.prepare('INSERT OR REPLACE INTO pane_members (pane_id, user_id, joined_at) VALUES (?, ?, ?)'),
    delete: db.prepare('DELETE FROM pane_members WHERE pane_id = ? AND user_id = ?'),
    deleteByUserInProject: db.prepare('DELETE FROM pane_members WHERE user_id = ? AND pane_id IN (SELECT pane_id FROM panes WHERE project_id = ?)'),
  },
  docs: {
    insert: db.prepare('INSERT INTO docs (doc_id, pane_id, created_at, updated_at) VALUES (?, ?, ?, ?)'),
    insertStorage: db.prepare('INSERT INTO doc_storage (doc_id, snapshot_version, snapshot_payload, updated_at) VALUES (?, ?, ?, ?)'),
    findByPaneId: db.prepare('SELECT * FROM docs WHERE pane_id = ?'),
    findById: db.prepare(`
      SELECT d.doc_id, d.pane_id, d.created_at, d.updated_at, ds.snapshot_version, ds.snapshot_payload, ds.updated_at AS storage_updated_at
      FROM docs d
      LEFT JOIN doc_storage ds ON ds.doc_id = d.doc_id
      WHERE d.doc_id = ?
    `),
    findDocProject: db.prepare(`
      SELECT d.doc_id, d.pane_id, p.project_id
      FROM docs d
      JOIN panes p ON p.pane_id = d.pane_id
      WHERE d.doc_id = ?
    `),
    updateStorage: db.prepare(`
      UPDATE doc_storage
      SET snapshot_version = ?, snapshot_payload = ?, updated_at = ?
      WHERE doc_id = ? AND snapshot_version = ?
    `),
    updateTimestamp: db.prepare('UPDATE docs SET updated_at = ? WHERE doc_id = ?'),
    upsertPresence: db.prepare(`
      INSERT INTO doc_presence (doc_id, user_id, cursor_payload, last_seen_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(doc_id, user_id)
      DO UPDATE SET cursor_payload = excluded.cursor_payload, last_seen_at = excluded.last_seen_at
    `),
  },
  collections: {
    listForProject: db.prepare('SELECT * FROM collections WHERE project_id = ? ORDER BY created_at ASC'),
    findById: db.prepare('SELECT * FROM collections WHERE collection_id = ?'),
    findByName: db.prepare('SELECT * FROM collections WHERE project_id = ? AND name = ? LIMIT 1'),
    insert: db.prepare(`
      INSERT INTO collections (collection_id, project_id, name, icon, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertMinimal: db.prepare(`
      INSERT INTO collections (collection_id, project_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    listFields: db.prepare('SELECT * FROM collection_fields WHERE collection_id = ? ORDER BY sort_order ASC, created_at ASC'),
    findFieldById: db.prepare('SELECT * FROM collection_fields WHERE field_id = ?'),
    nextFieldSort: db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM collection_fields WHERE collection_id = ?'),
    insertField: db.prepare(`
      INSERT INTO collection_fields (field_id, collection_id, name, type, config, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
  },
  records: {
    findById: db.prepare('SELECT * FROM records WHERE record_id = ?'),
    listForCollection: db.prepare(`
      SELECT *
      FROM records
      WHERE project_id = ? AND collection_id = ? AND archived_at IS NULL
      ORDER BY updated_at DESC, record_id DESC
    `),
    listPersonalCaptures: db.prepare(`
      SELECT r.record_id, r.project_id, r.collection_id, r.title, r.created_at
      FROM records r
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      LEFT JOIN event_state es ON es.record_id = r.record_id
      WHERE r.project_id = ?
        AND r.archived_at IS NULL
        AND ts.record_id IS NULL
        AND es.record_id IS NULL
      ORDER BY r.created_at DESC, r.record_id DESC
      LIMIT ?
    `),
    insert: db.prepare(`
      INSERT INTO records (record_id, project_id, collection_id, title, created_by, created_at, updated_at, archived_at, parent_record_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `),
    update: db.prepare(`
      UPDATE records
      SET title = ?, updated_at = ?, archived_at = ?
      WHERE record_id = ?
    `),
  },
  recordValues: {
    upsert: db.prepare(`
      INSERT INTO record_values (record_id, field_id, value_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(record_id, field_id)
      DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `),
    listForRecord: db.prepare('SELECT * FROM record_values WHERE record_id = ?'),
  },
  recordRelations: {
    insert: db.prepare(`
      INSERT INTO record_relations (relation_id, project_id, from_record_id, to_record_id, via_field_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    findById: db.prepare('SELECT * FROM record_relations WHERE relation_id = ?'),
    findDuplicate: db.prepare(`
      SELECT relation_id
      FROM record_relations
      WHERE project_id = ? AND from_record_id = ? AND to_record_id = ? AND via_field_id = ?
      LIMIT 1
    `),
    delete: db.prepare('DELETE FROM record_relations WHERE relation_id = ?'),
    listForward: db.prepare(`
      SELECT
        rr.*,
        tr.title AS to_record_title,
        tr.collection_id AS to_collection_id,
        tc.name AS to_collection_name
      FROM record_relations rr
      JOIN records tr ON tr.record_id = rr.to_record_id
      LEFT JOIN collections tc ON tc.collection_id = tr.collection_id
      WHERE rr.from_record_id = ?
      ORDER BY rr.created_at DESC
    `),
    listReverse: db.prepare(`
      SELECT
        rr.*,
        fr.title AS from_record_title,
        fr.collection_id AS from_collection_id,
        fc.name AS from_collection_name
      FROM record_relations rr
      JOIN records fr ON fr.record_id = rr.from_record_id
      LEFT JOIN collections fc ON fc.collection_id = fr.collection_id
      WHERE rr.to_record_id = ?
      ORDER BY rr.created_at DESC
    `),
  },
  views: {
    listForProject: db.prepare('SELECT * FROM views WHERE project_id = ? ORDER BY created_at ASC'),
    findById: db.prepare('SELECT * FROM views WHERE view_id = ?'),
    insert: db.prepare(`
      INSERT INTO views (view_id, project_id, collection_id, type, name, config, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  },
  search: {},
  userSearch: {
    searchProjectMembers: db.prepare(`
      SELECT u.user_id, u.display_name, u.email
      FROM project_members pm
      JOIN users u ON u.user_id = pm.user_id
      WHERE pm.project_id = ?
        AND (
          ? = ''
          OR LOWER(u.display_name) LIKE ?
          OR LOWER(COALESCE(u.email, '')) LIKE ?
        )
      ORDER BY u.display_name COLLATE NOCASE ASC
      LIMIT ?
    `),
    searchRecords: db.prepare(`
      SELECT r.record_id, r.title, r.collection_id, c.name AS collection_name
      FROM records r
      LEFT JOIN collections c ON c.collection_id = r.collection_id
      WHERE r.project_id = ? AND r.archived_at IS NULL
        AND (
          ? = ''
          OR LOWER(r.title) LIKE ?
        )
      ORDER BY r.updated_at DESC
      LIMIT ?
    `),
    searchRecordsExtended: db.prepare(`
      SELECT r.record_id, r.title, r.collection_id, c.name AS collection_name, c.icon AS collection_icon
      FROM records r
      LEFT JOIN collections c ON c.collection_id = r.collection_id
      WHERE r.project_id = ? AND r.archived_at IS NULL
        AND (
          ? = ''
          OR LOWER(r.title) LIKE ?
        )
        AND (
          ? = ''
          OR r.collection_id = ?
        )
        AND (
          ? = ''
          OR r.record_id != ?
        )
      ORDER BY r.updated_at DESC
      LIMIT ?
    `),
  },
  recordCapabilities: {
    insertIgnore: db.prepare('INSERT OR IGNORE INTO record_capabilities (record_id, capability_type, created_at) VALUES (?, ?, ?)'),
    listForRecord: db.prepare('SELECT capability_type FROM record_capabilities WHERE record_id = ? ORDER BY capability_type ASC'),
  },
  tasks: {
    listVisibleForProject: db.prepare(`
      SELECT r.*, ts.category
      FROM records r
      JOIN task_state ts ON ts.record_id = r.record_id
      WHERE r.project_id = ? AND r.archived_at IS NULL AND r.parent_record_id IS NULL
      ORDER BY COALESCE(ts.updated_at, r.updated_at) DESC, r.record_id DESC
    `),
    listAssignedForUser: db.prepare(`
      SELECT r.*, ts.category
      FROM assignments a
      JOIN records r ON r.record_id = a.record_id
      JOIN task_state ts ON ts.record_id = r.record_id
      WHERE a.user_id = ? AND r.archived_at IS NULL AND r.parent_record_id IS NULL
      ORDER BY COALESCE(ts.updated_at, r.updated_at) DESC, r.record_id DESC
    `),
    upsertState: db.prepare(`
      INSERT INTO task_state (record_id, status, priority, due_at, category, completed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id)
      DO UPDATE SET
        status = excluded.status,
        priority = excluded.priority,
        due_at = excluded.due_at,
        category = excluded.category,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `),
    findState: db.prepare('SELECT * FROM task_state WHERE record_id = ?'),
    listSubtasksByParent: db.prepare(`
      SELECT r.*, ts.status, ts.priority, ts.due_at, ts.completed_at, ts.category
      FROM records r
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      WHERE r.parent_record_id = ? AND r.archived_at IS NULL
      ORDER BY ts.due_at ASC NULLS LAST, r.created_at ASC
    `),
    countSubtasksByParent: db.prepare(`
      SELECT COUNT(*) AS count
      FROM records
      WHERE parent_record_id = ? AND archived_at IS NULL
    `),
    deleteAssignments: db.prepare('DELETE FROM assignments WHERE record_id = ?'),
    insertAssignment: db.prepare('INSERT OR REPLACE INTO assignments (record_id, user_id, assigned_at) VALUES (?, ?, ?)'),
    listAssignments: db.prepare('SELECT * FROM assignments WHERE record_id = ? ORDER BY assigned_at ASC'),
    listAssignedForUserInProject: db.prepare(`
      SELECT r.record_id, r.project_id, r.title, r.updated_at, ts.status, ts.priority
      FROM assignments a
      JOIN records r ON r.record_id = a.record_id
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      WHERE a.user_id = ?
        AND r.project_id = ?
        AND r.archived_at IS NULL
      ORDER BY r.updated_at DESC, r.record_id DESC
    `),
    listDueReminders: db.prepare(`
      SELECT r.*, rec.title AS record_title, rec.project_id
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      WHERE r.fired_at IS NULL AND r.dismissed_at IS NULL AND r.remind_at <= ? AND rec.archived_at IS NULL
    `),
    deleteAssignment: db.prepare('DELETE FROM assignments WHERE record_id = ? AND user_id = ?'),
  },
  calendar: {
    listEventsForProject: db.prepare(`
      SELECT r.*, es.start_dt, es.end_dt
      FROM records r
      JOIN event_state es ON es.record_id = r.record_id
      WHERE r.project_id = ? AND r.archived_at IS NULL
      ORDER BY es.start_dt ASC, r.record_id ASC
    `),
    listCalendarRecordsForProject: db.prepare(`
      SELECT r.*
      FROM records r
      JOIN record_capabilities rc ON rc.record_id = r.record_id AND rc.capability_type = 'calendar_event'
      JOIN event_state es ON es.record_id = r.record_id
      WHERE r.project_id = ? AND r.archived_at IS NULL
      ORDER BY es.start_dt ASC
    `),
    upsertEventState: db.prepare(`
      INSERT INTO event_state (record_id, start_dt, end_dt, timezone, location, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id)
      DO UPDATE SET start_dt = excluded.start_dt, end_dt = excluded.end_dt, timezone = excluded.timezone, location = excluded.location, updated_at = excluded.updated_at
    `),
    findEventState: db.prepare('SELECT * FROM event_state WHERE record_id = ?'),
    deleteParticipants: db.prepare('DELETE FROM event_participants WHERE record_id = ?'),
    insertParticipant: db.prepare(`
      INSERT OR REPLACE INTO event_participants (record_id, user_id, role, added_at)
      VALUES (?, ?, ?, ?)
    `),
    listParticipants: db.prepare('SELECT * FROM event_participants WHERE record_id = ? ORDER BY added_at ASC'),
    findParticipantByRecordAndUser: db.prepare('SELECT 1 AS ok FROM event_participants WHERE record_id = ? AND user_id = ? LIMIT 1'),
    upsertRecurrence: db.prepare(`
      INSERT INTO recurrence_rules (record_id, rule_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(record_id)
      DO UPDATE SET rule_json = excluded.rule_json, updated_at = excluded.updated_at
    `),
    findRecurrence: db.prepare('SELECT * FROM recurrence_rules WHERE record_id = ?'),
    deleteReminders: db.prepare('DELETE FROM reminders WHERE record_id = ?'),
    insertReminder: db.prepare(`
      INSERT INTO reminders (reminder_id, record_id, remind_at, channels, created_at, recurrence_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    listReminders: db.prepare('SELECT * FROM reminders WHERE record_id = ? ORDER BY remind_at ASC'),
  },
  reminders: {
    listDue: db.prepare(`
      SELECT r.*, rec.title AS record_title, rec.project_id
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      WHERE r.fired_at IS NULL AND r.dismissed_at IS NULL AND r.remind_at <= ? AND rec.archived_at IS NULL
    `),
    claimFired: db.prepare('UPDATE reminders SET fired_at = ? WHERE reminder_id = ? AND fired_at IS NULL'),
    listForUser: db.prepare(`
      SELECT r.*, rec.title AS record_title, rec.project_id
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      JOIN project_members pm ON pm.project_id = rec.project_id AND pm.user_id = ?
      WHERE r.dismissed_at IS NULL AND rec.archived_at IS NULL
      ORDER BY r.remind_at ASC
    `),
    dismiss: db.prepare(`
      UPDATE reminders SET dismissed_at = ? WHERE reminder_id = ? AND dismissed_at IS NULL
    `),
    insertStandalone: db.prepare(`
      INSERT INTO reminders (reminder_id, record_id, remind_at, channels, created_at, recurrence_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    findById: db.prepare(`
      SELECT r.*, rec.title AS record_title, rec.project_id, rec.archived_at AS record_archived_at
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      WHERE r.reminder_id = ?
    `),
  },
  files: {
    insert: db.prepare(`
      INSERT INTO files (file_id, project_id, asset_root_id, provider, provider_path, name, mime_type, size_bytes, hash, metadata_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listForProject: db.prepare(`
      SELECT *
      FROM files
      WHERE project_id = ?
      ORDER BY created_at DESC, file_id DESC
    `),
    insertBlob: db.prepare('INSERT INTO file_blobs (file_id, storage_pointer, created_at) VALUES (?, ?, ?)'),
    insertAttachment: db.prepare(`
      INSERT INTO entity_attachments (
        attachment_id,
        project_id,
        entity_type,
        entity_id,
        provider,
        asset_root_id,
        asset_path,
        name,
        mime_type,
        size_bytes,
        metadata_json,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteAttachment: db.prepare('DELETE FROM entity_attachments WHERE attachment_id = ?'),
    listAttachmentsForEntity: db.prepare(`
      SELECT ea.*
      FROM entity_attachments ea
      WHERE ea.project_id = ? AND ea.entity_type = ? AND ea.entity_id = ?
      ORDER BY ea.created_at DESC
    `),
    findAttachmentById: db.prepare('SELECT * FROM entity_attachments WHERE attachment_id = ?'),
  },
  assetRoots: {
    findDefaultForProject: db.prepare(`
      SELECT *
      FROM asset_roots
      WHERE project_id = ?
      ORDER BY created_at ASC
      LIMIT 1
    `),
    insert: db.prepare(`
      INSERT INTO asset_roots (asset_root_id, project_id, provider, root_path, connection_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    listForProject: db.prepare('SELECT * FROM asset_roots WHERE project_id = ? ORDER BY created_at ASC'),
    findById: db.prepare('SELECT * FROM asset_roots WHERE asset_root_id = ?'),
  },
  chat: {
    findAccountByUserId: db.prepare('SELECT * FROM matrix_accounts WHERE user_id = ?'),
    insertAccount: db.prepare(`
      INSERT INTO matrix_accounts (
        user_id,
        matrix_user_id,
        matrix_device_id,
        matrix_password_encrypted
      ) VALUES (?, ?, ?, ?)
    `),
    updateAccountCredentials: db.prepare(`
      UPDATE matrix_accounts
      SET matrix_password_encrypted = ?
      WHERE user_id = ?
    `),
    updateAccountDevice: db.prepare(`
      UPDATE matrix_accounts
      SET matrix_device_id = ?
      WHERE user_id = ?
    `),
    deleteAccount: db.prepare('DELETE FROM matrix_accounts WHERE user_id = ?'),
    insertSnapshot: db.prepare(`
      INSERT INTO chat_snapshots (
        snapshot_id,
        project_id,
        conversation_room_id,
        message_sender_display_name,
        message_text,
        message_timestamp,
        created_by,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    findSnapshotById: db.prepare('SELECT * FROM chat_snapshots WHERE snapshot_id = ?'),
    listSnapshotsByProject: db.prepare(`
      SELECT *
      FROM chat_snapshots
      WHERE project_id = ?
      ORDER BY created_at DESC, snapshot_id DESC
      LIMIT ? OFFSET ?
    `),
    deleteSnapshot: db.prepare('DELETE FROM chat_snapshots WHERE snapshot_id = ?'),
  },
  comments: {
    insert: db.prepare(`
      INSERT INTO comments (comment_id, project_id, author_user_id, target_entity_type, target_entity_id, body_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    findById: db.prepare('SELECT * FROM comments WHERE comment_id = ?'),
    listForEntity: db.prepare(`
      SELECT *
      FROM comments
      WHERE project_id = ? AND target_entity_type = ? AND target_entity_id = ?
      ORDER BY created_at ASC
    `),
    updateStatus: db.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE comment_id = ?'),
  },
  commentAnchors: {
    insert: db.prepare(`
      INSERT INTO comment_anchors (comment_id, doc_id, anchor_payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    listForDoc: db.prepare(`
      SELECT ca.*, c.body_json, c.status, c.author_user_id, c.created_at AS comment_created_at
      FROM comment_anchors ca
      JOIN comments c ON c.comment_id = ca.comment_id
      WHERE ca.doc_id = ?
      ORDER BY ca.created_at ASC
    `),
    findByCommentId: db.prepare('SELECT * FROM comment_anchors WHERE comment_id = ? LIMIT 1'),
  },
  mentions: {
    insert: db.prepare(`
      INSERT INTO mentions (mention_id, project_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listForSource: db.prepare(`
      SELECT * FROM mentions
      WHERE project_id = ? AND source_entity_type = ? AND source_entity_id = ?
      ORDER BY created_at ASC
    `),
    delete: db.prepare('DELETE FROM mentions WHERE mention_id = ?'),
    updateContext: db.prepare('UPDATE mentions SET context = ? WHERE mention_id = ?'),
    countForTarget: db.prepare(`
      SELECT COUNT(*) AS mention_count
      FROM mentions
      WHERE project_id = ? AND target_entity_type = ? AND target_entity_id = ?
    `),
    listInboxForUser: db.prepare(`
      SELECT
        m.*,
        d.pane_id AS source_doc_pane_id,
        p.name AS source_doc_pane_name,
        c.target_entity_type AS source_comment_target_entity_type,
        c.target_entity_id AS source_comment_target_entity_id,
        c.author_user_id AS source_comment_author_user_id,
        cdoc.doc_id AS source_comment_doc_id,
        cp.pane_id AS source_comment_pane_id,
        cp.name AS source_comment_pane_name,
        ca.anchor_payload AS source_comment_anchor_payload
      FROM mentions m
      LEFT JOIN docs d ON m.source_entity_type = 'doc' AND d.doc_id = m.source_entity_id
      LEFT JOIN panes p ON p.pane_id = d.pane_id
      LEFT JOIN comments c ON m.source_entity_type = 'comment' AND c.comment_id = m.source_entity_id
      LEFT JOIN docs cdoc ON c.target_entity_type = 'doc' AND cdoc.doc_id = c.target_entity_id
      LEFT JOIN panes cp ON cp.pane_id = cdoc.pane_id
      LEFT JOIN pane_members spm ON spm.pane_id = d.pane_id AND spm.user_id = ?
      LEFT JOIN pane_members cpm ON cpm.pane_id = cdoc.pane_id AND cpm.user_id = ?
      LEFT JOIN project_members spj ON spj.project_id = p.project_id AND spj.user_id = ? AND spj.role = 'owner'
      LEFT JOIN project_members cpj ON cpj.project_id = cp.project_id AND cpj.user_id = ? AND cpj.role = 'owner'
      LEFT JOIN comment_anchors ca ON ca.comment_id = c.comment_id
      WHERE m.project_id = ? AND m.target_entity_type = ? AND m.target_entity_id = ?
        AND (
          (m.source_entity_type = 'doc' AND (spm.user_id IS NOT NULL OR spj.user_id IS NOT NULL))
          OR (
            m.source_entity_type = 'comment'
            AND (
              c.target_entity_type IS NULL
              OR c.target_entity_type != 'doc'
              OR cpm.user_id IS NOT NULL
              OR cpj.user_id IS NOT NULL
            )
          )
          OR (m.source_entity_type != 'doc' AND m.source_entity_type != 'comment')
        )
      ORDER BY m.created_at DESC
    `),
  },
  timeline: {
    insert: db.prepare(`
      INSERT INTO timeline_events (
        timeline_event_id,
        project_id,
        actor_user_id,
        event_type,
        primary_entity_type,
        primary_entity_id,
        secondary_entities_json,
        summary_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listForProject: db.prepare(`
      SELECT *
      FROM timeline_events
      WHERE project_id = ?
      ORDER BY created_at DESC, timeline_event_id DESC
    `),
    listForEntity: db.prepare(`
      SELECT *
      FROM timeline_events
      WHERE project_id = ? AND primary_entity_type = ? AND primary_entity_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `),
  },
  notifications: {
    insert: db.prepare(`
      INSERT INTO notifications (
        notification_id,
        project_id,
        user_id,
        reason,
        entity_type,
        entity_id,
        payload_json,
        notification_scope,
        read_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `),
    listForUser: db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'),
    listUnreadForUser: db.prepare('SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC LIMIT ?'),
    findById: db.prepare('SELECT * FROM notifications WHERE notification_id = ?'),
    markRead: db.prepare('UPDATE notifications SET read_at = ? WHERE notification_id = ? AND user_id = ?'),
  },
  automation: {
    insertRule: db.prepare(`
      INSERT INTO automation_rules (
        automation_rule_id,
        project_id,
        name,
        enabled,
        trigger_json,
        actions_json,
        created_by,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listRules: db.prepare('SELECT * FROM automation_rules WHERE project_id = ? ORDER BY created_at DESC'),
    findRule: db.prepare('SELECT * FROM automation_rules WHERE automation_rule_id = ?'),
    updateRule: db.prepare(`
      UPDATE automation_rules
      SET name = ?, enabled = ?, trigger_json = ?, actions_json = ?, updated_at = ?
      WHERE automation_rule_id = ?
    `),
    deleteRule: db.prepare('DELETE FROM automation_rules WHERE automation_rule_id = ?'),
    listRuns: db.prepare('SELECT * FROM automation_runs WHERE project_id = ? ORDER BY started_at DESC, automation_run_id DESC'),
  },
});
