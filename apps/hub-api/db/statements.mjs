import { createWidgetPickerSeedQueries } from './widgetPickerSeedQueries.mjs';

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
  widgetPickerSeedData: createWidgetPickerSeedQueries(db),
  calendarFeedTokens: {
    findByUserId: db.prepare('SELECT * FROM calendar_feed_tokens WHERE user_id = ? LIMIT 1'),
    findByToken: db.prepare('SELECT * FROM calendar_feed_tokens WHERE token = ? LIMIT 1'),
    insert: db.prepare(`
      INSERT INTO calendar_feed_tokens (token, user_id, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE
      SET token = EXCLUDED.token,
          created_at = EXCLUDED.created_at
    `),
  },
  spaces: {
    updateTasksCollection: db.prepare(`
      UPDATE spaces
      SET tasks_collection_id = ?, updated_at = ?
      WHERE space_id = ?
    `),
    updateRemindersCollection: db.prepare(`
      UPDATE spaces
      SET reminders_collection_id = ?, updated_at = ?
      WHERE space_id = ?
    `),
    findById: db.prepare('SELECT * FROM spaces WHERE space_id = ?'),
    findByIdWithMembership: db.prepare(`
      SELECT p.*, pm.role AS membership_role, pm.joined_at
      FROM spaces p
      JOIN space_members pm ON pm.space_id = p.space_id
      WHERE p.space_id = ? AND pm.user_id = ?
    `),
    findPersonalSpace: db.prepare(`
      SELECT p.*, pm.role AS membership_role, pm.joined_at
      FROM spaces p
      JOIN space_members pm ON pm.space_id = p.space_id
      WHERE pm.user_id = ?
        AND p.created_by = ?
        AND p.space_type = 'personal'
      ORDER BY p.created_at ASC
      LIMIT 1
    `),
    listPersonalMissingTasksCollectionIds: db.prepare(`
      SELECT p.space_id
      FROM spaces p
      WHERE p.space_type = 'personal'
        AND COALESCE(p.tasks_collection_id, '') = ''
      ORDER BY p.created_at ASC, p.space_id ASC
    `),
    listPersonalMissingRemindersCollectionIds: db.prepare(`
      SELECT p.space_id
      FROM spaces p
      WHERE p.space_type = 'personal'
        AND COALESCE(p.reminders_collection_id, '') = ''
      ORDER BY p.created_at ASC, p.space_id ASC
    `),
    listForUser: db.prepare(`
      SELECT p.*, pm.role AS membership_role, pm.joined_at
      FROM spaces p
      JOIN space_members pm ON pm.space_id = p.space_id
      WHERE pm.user_id = ?
      ORDER BY
        CASE WHEN p.position IS NULL THEN 1 ELSE 0 END ASC,
        p.position ASC,
        p.created_at DESC,
        p.space_id DESC
    `),
    updatePosition: db.prepare(`
      UPDATE spaces
      SET position = ?, updated_at = ?
      WHERE space_id = ?
    `),
    updateName: db.prepare(`
      UPDATE spaces
      SET name = ?, name_prompt_completed = 1, updated_at = ?
      WHERE space_id = ?
    `),
    insert: db.prepare(`
      INSERT INTO spaces (space_id, name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    insertWithType: db.prepare(`
      INSERT INTO spaces (space_id, name, created_by, space_type, is_personal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
  },
  spaceMembers: {
    listForUser: db.prepare(`
      SELECT space_id, role, joined_at
      FROM space_members
      WHERE user_id = ?
      ORDER BY joined_at ASC
    `),
    listWithUsers: db.prepare(`
      SELECT pm.space_id, pm.user_id, pm.role, pm.joined_at, u.display_name, u.email
      FROM space_members pm
      JOIN users u ON u.user_id = pm.user_id
      WHERE pm.space_id = ?
      ORDER BY pm.joined_at ASC
    `),
    countOwners: db.prepare(`
      SELECT COUNT(*) AS owner_count
      FROM space_members
      WHERE space_id = ? AND role = 'owner'
    `),
    insert: db.prepare(`
      INSERT OR REPLACE INTO space_members (space_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?)
    `),
    delete: db.prepare('DELETE FROM space_members WHERE space_id = ? AND user_id = ?'),
    listPendingInvites: db.prepare(`
      SELECT *
      FROM pending_space_invites
      WHERE space_id = ? AND status = 'pending'
      ORDER BY created_at DESC, invite_request_id DESC
    `),
    findInvite: db.prepare('SELECT * FROM pending_space_invites WHERE invite_request_id = ? LIMIT 1'),
    findPendingByEmail: db.prepare(`
      SELECT *
      FROM pending_space_invites
      WHERE space_id = ?
        AND LOWER(email) = LOWER(?)
        AND status = 'pending'
      LIMIT 1
    `),
    insertInvite: db.prepare(`
      INSERT INTO pending_space_invites (
        invite_request_id,
        space_id,
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
      UPDATE pending_space_invites
      SET status = ?, target_user_id = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ?
      WHERE invite_request_id = ?
    `),
    deleteInvite: db.prepare('DELETE FROM pending_space_invites WHERE invite_request_id = ?'),
    isMember: db.prepare('SELECT 1 AS ok FROM space_members WHERE space_id = ? AND user_id = ? LIMIT 1'),
    getRole: db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ? LIMIT 1'),
  },
  projects: {
    findById: db.prepare('SELECT * FROM projects WHERE project_id = ?'),
    listMembers: db.prepare(`
      SELECT pm.user_id, u.display_name
      FROM project_members pm
      JOIN users u ON u.user_id = pm.user_id
      LEFT JOIN space_members prj ON prj.space_id = (SELECT space_id FROM projects WHERE project_id = pm.project_id) AND prj.user_id = pm.user_id
      WHERE pm.project_id = ?
        AND COALESCE(prj.role, 'member') != 'owner'
      ORDER BY pm.joined_at ASC
    `),
    listForSpace: db.prepare(`
      SELECT p.*
      FROM projects p
      WHERE p.space_id = ?
      ORDER BY
        CASE WHEN p.position IS NULL THEN 1 ELSE 0 END ASC,
        p.position ASC,
        p.sort_order ASC,
        p.created_at ASC
    `),
    nextSortOrder: db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM projects WHERE space_id = ?'),
    insert: db.prepare(`
      INSERT INTO projects (project_id, space_id, name, sort_order, position, pinned, layout_config, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE projects
      SET name = ?, sort_order = ?, position = ?, pinned = ?, layout_config = ?, updated_at = ?
      WHERE project_id = ?
    `),
    delete: db.prepare('DELETE FROM projects WHERE project_id = ?'),
  },
  projectMembers: {
    isMember: db.prepare('SELECT 1 AS ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1'),
    listUserIds: db.prepare('SELECT user_id FROM project_members WHERE project_id = ? ORDER BY joined_at ASC'),
    insert: db.prepare('INSERT OR REPLACE INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, ?)'),
    delete: db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?'),
    deleteByUserInSpace: db.prepare('DELETE FROM project_members WHERE user_id = ? AND project_id IN (SELECT project_id FROM projects WHERE space_id = ?)'),
  },
  docs: {
    insert: db.prepare('INSERT INTO docs (doc_id, project_id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
    insertStorage: db.prepare('INSERT INTO doc_storage (doc_id, snapshot_version, snapshot_payload, updated_at) VALUES (?, ?, ?, ?)'),
    findByProjectId: db.prepare('SELECT * FROM docs WHERE project_id = ? ORDER BY position ASC, created_at ASC'),
    findFirstByProjectId: db.prepare('SELECT * FROM docs WHERE project_id = ? ORDER BY position ASC, created_at ASC LIMIT 1'),
    findById: db.prepare(`
      SELECT d.doc_id, d.project_id, d.title, d.position, d.created_at, d.updated_at, ds.snapshot_version, ds.snapshot_payload, ds.updated_at AS storage_updated_at
      FROM docs d
      LEFT JOIN doc_storage ds ON ds.doc_id = d.doc_id
      WHERE d.doc_id = ?
    `),
    findDocSpace: db.prepare(`
      SELECT d.doc_id, d.project_id, d.title, d.position, p.space_id
      FROM docs d
      JOIN projects p ON p.project_id = d.project_id
      WHERE d.doc_id = ?
    `),
    maxPositionForProject: db.prepare('SELECT COALESCE(MAX(position), -1) AS max_position FROM docs WHERE project_id = ?'),
    countForProject: db.prepare('SELECT COUNT(*) AS count FROM docs WHERE project_id = ?'),
    updateMeta: db.prepare(`
      UPDATE docs
      SET title = ?, position = ?, updated_at = ?
      WHERE doc_id = ?
    `),
    deleteStorage: db.prepare('DELETE FROM doc_storage WHERE doc_id = ?'),
    delete: db.prepare('DELETE FROM docs WHERE doc_id = ?'),
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
    listForSpace: db.prepare('SELECT * FROM collections WHERE space_id = ? ORDER BY created_at ASC'),
    findById: db.prepare('SELECT * FROM collections WHERE collection_id = ?'),
    findByName: db.prepare('SELECT * FROM collections WHERE space_id = ? AND name = ? LIMIT 1'),
    insert: db.prepare(`
      INSERT INTO collections (collection_id, space_id, name, icon, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertMinimal: db.prepare(`
      INSERT INTO collections (collection_id, space_id, name, created_at, updated_at)
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
      WHERE space_id = ? AND collection_id = ? AND archived_at IS NULL
      ORDER BY updated_at DESC, record_id DESC
    `),
    listPersonalCaptures: db.prepare(`
      SELECT r.record_id, r.space_id, r.collection_id, r.title, r.created_at
      FROM records r
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      LEFT JOIN event_state es ON es.record_id = r.record_id
      WHERE r.space_id = ?
        AND r.archived_at IS NULL
        AND ts.record_id IS NULL
        AND es.record_id IS NULL
      ORDER BY r.created_at DESC, r.record_id DESC
      LIMIT ?
    `),
    insert: db.prepare(`
      INSERT INTO records (
        record_id,
        space_id,
        collection_id,
        title,
        source_project_id,
        source_view_id,
        created_by,
        created_at,
        updated_at,
        archived_at,
        parent_record_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
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
      INSERT INTO record_relations (relation_id, space_id, from_record_id, to_record_id, via_field_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    findById: db.prepare('SELECT * FROM record_relations WHERE relation_id = ?'),
    findDuplicate: db.prepare(`
      SELECT relation_id
      FROM record_relations
      WHERE space_id = ? AND from_record_id = ? AND to_record_id = ? AND via_field_id = ?
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
    listForSpace: db.prepare('SELECT * FROM views WHERE space_id = ? ORDER BY created_at ASC'),
    findById: db.prepare('SELECT * FROM views WHERE view_id = ?'),
    insert: db.prepare(`
      INSERT INTO views (view_id, space_id, collection_id, type, name, config, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE views
      SET name = ?, config = ?, updated_at = ?
      WHERE view_id = ?
    `),
  },
  search: {},
  userSearch: {
    searchSpaceMembers: db.prepare(`
      SELECT u.user_id, u.display_name, u.email
      FROM space_members pm
      JOIN users u ON u.user_id = pm.user_id
      WHERE pm.space_id = ?
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
      WHERE r.space_id = ? AND r.archived_at IS NULL
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
      WHERE r.space_id = ? AND r.archived_at IS NULL
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
    listVisibleForSpace: db.prepare(`
      SELECT r.*, ts.category
      FROM records r
      JOIN task_state ts ON ts.record_id = r.record_id
      WHERE r.space_id = ? AND r.archived_at IS NULL AND r.parent_record_id IS NULL
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
    listAssignedForUserInSpace: db.prepare(`
      SELECT r.record_id, r.space_id, r.title, r.updated_at, ts.status, ts.priority
      FROM assignments a
      JOIN records r ON r.record_id = a.record_id
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      WHERE a.user_id = ?
        AND r.space_id = ?
        AND r.archived_at IS NULL
      ORDER BY r.updated_at DESC, r.record_id DESC
    `),
    listDueReminders: db.prepare(`
      SELECT r.*, rec.title AS record_title, rec.space_id
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      WHERE r.fired_at IS NULL AND r.dismissed_at IS NULL AND r.remind_at <= ? AND rec.archived_at IS NULL
    `),
    deleteAssignment: db.prepare('DELETE FROM assignments WHERE record_id = ? AND user_id = ?'),
  },
  calendar: {
    listEventsForSpace: db.prepare(`
      SELECT r.*, es.start_dt, es.end_dt
      FROM records r
      JOIN event_state es ON es.record_id = r.record_id
      WHERE r.space_id = ? AND r.archived_at IS NULL
      ORDER BY es.start_dt ASC, r.record_id ASC
    `),
    listCalendarRecordsForSpace: db.prepare(`
      SELECT r.*
      FROM records r
      JOIN record_capabilities rc ON rc.record_id = r.record_id AND rc.capability_type = 'calendar_event'
      JOIN event_state es ON es.record_id = r.record_id
      WHERE r.space_id = ? AND r.archived_at IS NULL
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
      SELECT r.*, rec.title AS record_title, rec.space_id
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      WHERE r.fired_at IS NULL AND r.dismissed_at IS NULL AND r.remind_at <= ? AND rec.archived_at IS NULL
    `),
    claimFired: db.prepare('UPDATE reminders SET fired_at = ? WHERE reminder_id = ? AND fired_at IS NULL'),
    listForUser: db.prepare(`
      -- Parameter order: user_id, scope, personal_space_id, scope, space_id, project_id, project_id.
      -- project_id is bound twice to support (? = '' OR rec.source_project_id = ?).
      SELECT r.*, rec.title AS record_title, rec.space_id
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      JOIN space_members pm ON pm.space_id = rec.space_id AND pm.user_id = ?
      WHERE r.dismissed_at IS NULL
        AND rec.archived_at IS NULL
        AND (
          (? = 'personal' AND rec.space_id = ?)
          OR (
            ? = 'space'
            AND rec.space_id = ?
            AND (? = '' OR rec.source_project_id = ?)
          )
        )
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
      SELECT r.*, rec.title AS record_title, rec.space_id, rec.archived_at AS record_archived_at
      FROM reminders r
      JOIN records rec ON rec.record_id = r.record_id
      WHERE r.reminder_id = ?
    `),
  },
  bugReports: {
    // Intentionally rely on table defaults so new submissions stay private until triaged.
    insert: db.prepare(`
      INSERT INTO bug_reports (
        id,
        created_at,
        reporter_name,
        reporter_email,
        description,
        screenshot_path
      ) VALUES (?, ?, ?, ?, ?, ?)
    `),
    listPublic: db.prepare(`
      SELECT id, created_at, description, status
      FROM bug_reports
      WHERE "public" = 1
        AND (
          ? = ''
          OR created_at < ?
          OR (created_at = ? AND id < ?)
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `),
  },
  files: {
    insert: db.prepare(`
      INSERT INTO files (file_id, space_id, asset_root_id, provider, provider_path, name, mime_type, size_bytes, hash, metadata_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listForSpace: db.prepare(`
      SELECT *
      FROM files
      WHERE space_id = ?
      ORDER BY created_at DESC, file_id DESC
    `),
    insertBlob: db.prepare('INSERT INTO file_blobs (file_id, storage_pointer, created_at) VALUES (?, ?, ?)'),
    insertAttachment: db.prepare(`
      INSERT INTO entity_attachments (
        attachment_id,
        space_id,
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
      WHERE ea.space_id = ? AND ea.entity_type = ? AND ea.entity_id = ?
      ORDER BY ea.created_at DESC
    `),
    findAttachmentById: db.prepare('SELECT * FROM entity_attachments WHERE attachment_id = ?'),
  },
  assetRoots: {
    findDefaultForSpace: db.prepare(`
      SELECT *
      FROM asset_roots
      WHERE space_id = ?
      ORDER BY created_at ASC
      LIMIT 1
    `),
    insert: db.prepare(`
      INSERT INTO asset_roots (asset_root_id, space_id, provider, root_path, connection_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    listForSpace: db.prepare('SELECT * FROM asset_roots WHERE space_id = ? ORDER BY created_at ASC'),
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
        space_id,
        conversation_room_id,
        message_sender_display_name,
        message_text,
        message_timestamp,
        created_by,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    findSnapshotById: db.prepare('SELECT * FROM chat_snapshots WHERE snapshot_id = ?'),
    listSnapshotsBySpace: db.prepare(`
      SELECT *
      FROM chat_snapshots
      WHERE space_id = ?
      ORDER BY created_at DESC, snapshot_id DESC
      LIMIT ? OFFSET ?
    `),
    deleteSnapshot: db.prepare('DELETE FROM chat_snapshots WHERE snapshot_id = ?'),
  },
  comments: {
    insert: db.prepare(`
      INSERT INTO comments (comment_id, space_id, author_user_id, target_entity_type, target_entity_id, body_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    findById: db.prepare('SELECT * FROM comments WHERE comment_id = ?'),
    listForEntity: db.prepare(`
      SELECT *
      FROM comments
      WHERE space_id = ? AND target_entity_type = ? AND target_entity_id = ?
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
      INSERT INTO mentions (mention_id, space_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listForSource: db.prepare(`
      SELECT * FROM mentions
      WHERE space_id = ? AND source_entity_type = ? AND source_entity_id = ?
      ORDER BY created_at ASC
    `),
    delete: db.prepare('DELETE FROM mentions WHERE mention_id = ?'),
    updateContext: db.prepare('UPDATE mentions SET context = ? WHERE mention_id = ?'),
    countForTarget: db.prepare(`
      SELECT COUNT(*) AS mention_count
      FROM mentions
      WHERE space_id = ? AND target_entity_type = ? AND target_entity_id = ?
    `),
    listInboxForUser: db.prepare(`
      SELECT
        m.*,
        d.project_id AS source_doc_project_id,
        p.name AS source_doc_project_name,
        c.target_entity_type AS source_comment_target_entity_type,
        c.target_entity_id AS source_comment_target_entity_id,
        c.author_user_id AS source_comment_author_user_id,
        cdoc.doc_id AS source_comment_doc_id,
        cp.project_id AS source_comment_project_id,
        cp.name AS source_comment_project_name,
        ca.anchor_payload AS source_comment_anchor_payload
      FROM mentions m
      LEFT JOIN docs d ON m.source_entity_type = 'doc' AND d.doc_id = m.source_entity_id
      LEFT JOIN projects p ON p.project_id = d.project_id
      LEFT JOIN comments c ON m.source_entity_type = 'comment' AND c.comment_id = m.source_entity_id
      LEFT JOIN docs cdoc ON c.target_entity_type = 'doc' AND cdoc.doc_id = c.target_entity_id
      LEFT JOIN projects cp ON cp.project_id = cdoc.project_id
      LEFT JOIN project_members spm ON spm.project_id = d.project_id AND spm.user_id = ?
      LEFT JOIN project_members cpm ON cpm.project_id = cdoc.project_id AND cpm.user_id = ?
      LEFT JOIN space_members spj ON spj.space_id = p.space_id AND spj.user_id = ? AND spj.role = 'owner'
      LEFT JOIN space_members cpj ON cpj.space_id = cp.space_id AND cpj.user_id = ? AND cpj.role = 'owner'
      LEFT JOIN comment_anchors ca ON ca.comment_id = c.comment_id
      WHERE m.space_id = ? AND m.target_entity_type = ? AND m.target_entity_id = ?
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
        space_id,
        actor_user_id,
        event_type,
        primary_entity_type,
        primary_entity_id,
        secondary_entities_json,
        summary_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listForSpace: db.prepare(`
      SELECT *
      FROM timeline_events
      WHERE space_id = ?
      ORDER BY created_at DESC, timeline_event_id DESC
    `),
    listForEntity: db.prepare(`
      SELECT *
      FROM timeline_events
      WHERE space_id = ? AND primary_entity_type = ? AND primary_entity_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `),
  },
  notifications: {
    insert: db.prepare(`
      INSERT INTO notifications (
        notification_id,
        space_id,
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
        space_id,
        name,
        enabled,
        trigger_json,
        actions_json,
        created_by,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listRules: db.prepare('SELECT * FROM automation_rules WHERE space_id = ? ORDER BY created_at DESC'),
    findRule: db.prepare('SELECT * FROM automation_rules WHERE automation_rule_id = ?'),
    updateRule: db.prepare(`
      UPDATE automation_rules
      SET name = ?, enabled = ?, trigger_json = ?, actions_json = ?, updated_at = ?
      WHERE automation_rule_id = ?
    `),
    deleteRule: db.prepare('DELETE FROM automation_rules WHERE automation_rule_id = ?'),
    listRuns: db.prepare('SELECT * FROM automation_runs WHERE space_id = ? ORDER BY started_at DESC, automation_run_id DESC'),
  },
});
