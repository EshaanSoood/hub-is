import { createRequestLogger } from '../lib/logger.mjs';

/**
 * Database schema initialization — creates all tables, indexes, and constraints from scratch when no schema exists.
 */
const HUB_API_ALLOW_SCHEMA_RESET = (process.env.HUB_API_ALLOW_SCHEMA_RESET || '').trim().toLowerCase() === 'true';
const schemaLog = createRequestLogger('system', 'SYSTEM', '/db/schema', 'system');

const notificationReasons = Object.freeze([
  'mention', 'assignment', 'reminder', 'comment_reply', 'automation', 'update', 'comment', 'snapshot',
]);
const notificationReasonCheckSql = notificationReasons.map((reason) => `'${reason}'`).join(', ');

const CONTRACT_TABLES = [
  'schema_version',
  'users',
  'calendar_feed_tokens',
  'projects',
  'project_members',
  'pending_project_invites',
  'panes',
  'pane_members',
  'docs',
  'doc_storage',
  'doc_presence',
  'rooms',
  'room_members',
  'room_docs',
  'room_doc_storage',
  'room_doc_presence',
  'collections',
  'collection_fields',
  'records',
  'record_values',
  'record_relations',
  'views',
  'record_capabilities',
  'task_state',
  'assignments',
  'event_state',
  'event_participants',
  'recurrence_rules',
  'reminders',
  'files',
  'file_blobs',
  'entity_attachments',
  'asset_roots',
  'comments',
  'comment_anchors',
  'mentions',
  'timeline_events',
  'notifications',
  'personal_tasks',
  'chat_snapshots',
  'matrix_accounts',
  'automation_rules',
  'automation_runs',
  'bug_reports',
];

const CONTRACT_TRIGGERS = [
  'pane_members_must_be_project_members',
  'records_collection_project_consistency_insert',
  'records_collection_project_consistency_update',
  'record_relations_project_consistency_insert',
  'record_relations_project_consistency_update',
  'comment_anchor_requires_doc_target',
  'comment_anchor_requires_node_key_insert',
  'comment_anchor_requires_node_key_update',
];

const CONTRACT_INDEXES = [
  'idx_project_members_user_project',
  'idx_pane_members_user_pane',
  'idx_panes_project_sort',
  'idx_docs_pane_unique',
  'idx_rooms_space_status_created',
  'idx_room_members_user_room',
  'idx_room_docs_room_unique',
  'idx_records_project_collection_updated',
  'idx_record_values_field_record',
  'idx_record_values_record_field',
  'idx_record_relations_unique_edge',
  'idx_record_relations_project_from',
  'idx_record_relations_project_to',
  'idx_views_project_collection_type',
  'idx_event_state_start',
  'idx_event_participants_user_record',
  'idx_reminders_due_active',
  'idx_reminders_visible_undismissed',
  'idx_attachments_entity_lookup',
  'idx_attachments_asset_lookup',
  'idx_files_project_asset_path',
  'idx_comments_entity_lookup',
  'idx_mentions_target_lookup',
  'idx_timeline_project_created',
  'idx_timeline_primary_lookup',
  'idx_notifications_user_unread_created',
  'idx_pending_project_invites_project_status_created',
  'idx_pending_project_invites_email_status',
  'idx_personal_tasks_user_updated',
  'idx_chat_snapshots_project_created',
  'idx_automation_runs_rule_started',
  'idx_projects_personal_owner',
  'idx_bug_reports_public_created',
];

const nowIso = () => new Date().toISOString();

const quoteIdentifier = (identifier) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const resetSchemaToContractV1 = (db) => {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN IMMEDIATE;');
  try {
    // Prevent startup races: if another process already installed the contract schema
    // while this process waited for the write lock, do not drop/recreate it.
    if (schemaReady(db)) {
      db.exec('COMMIT;');
      db.exec('PRAGMA foreign_keys = ON;');
      return;
    }

    const objects = db.prepare(`
      SELECT type, name
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND type IN ('trigger', 'view', 'table')
      ORDER BY CASE type WHEN 'trigger' THEN 1 WHEN 'view' THEN 2 ELSE 3 END
    `).all();

    for (const object of objects) {
      const escaped = quoteIdentifier(object.name);
      if (object.type === 'trigger') {
        db.exec(`DROP TRIGGER IF EXISTS ${escaped};`);
      } else if (object.type === 'view') {
        db.exec(`DROP VIEW IF EXISTS ${escaped};`);
      } else {
        db.exec(`DROP TABLE IF EXISTS ${escaped};`);
      }
    }

    db.exec(`
      CREATE TABLE schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL CHECK (version >= 1),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE users (
        user_id TEXT PRIMARY KEY,
        kc_sub TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE calendar_feed_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE projects (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_by TEXT NOT NULL,
        is_personal INTEGER NOT NULL DEFAULT 0 CHECK (is_personal IN (0, 1)),
        project_type TEXT NOT NULL DEFAULT 'team' CHECK (project_type IN ('team', 'personal')),
        tasks_collection_id TEXT,
        reminders_collection_id TEXT,
        position INTEGER,
        name_prompt_completed INTEGER NOT NULL DEFAULT 0 CHECK (name_prompt_completed IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (is_personal = 0 AND project_type = 'team')
          OR (is_personal = 1 AND project_type = 'personal')
        ),
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE project_members (
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT CHECK (role IN ('owner', 'member')),
        joined_at TEXT NOT NULL,
        PRIMARY KEY(project_id, user_id),
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE pending_project_invites (
        invite_request_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('member')),
        requested_by_user_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        target_user_id TEXT,
        reviewed_by_user_id TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE panes (
        pane_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        position INTEGER,
        pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
        layout_config TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE pane_members (
        pane_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY(pane_id, user_id),
        FOREIGN KEY(pane_id) REFERENCES panes(pane_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE docs (
        doc_id TEXT PRIMARY KEY,
        pane_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(pane_id) REFERENCES panes(pane_id) ON DELETE CASCADE
      );

      CREATE TABLE doc_storage (
        doc_id TEXT PRIMARY KEY,
        snapshot_version INTEGER NOT NULL DEFAULT 0,
        snapshot_payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE
      );

      CREATE TABLE doc_presence (
        doc_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        cursor_payload TEXT,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY(doc_id, user_id),
        FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE rooms (
        room_id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived_at TEXT,
        FOREIGN KEY(space_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE room_members (
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'participant')),
        joined_at TEXT NOT NULL,
        PRIMARY KEY(room_id, user_id),
        FOREIGN KEY(room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE room_docs (
        doc_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
      );

      CREATE TABLE room_doc_storage (
        doc_id TEXT PRIMARY KEY,
        snapshot_version INTEGER NOT NULL DEFAULT 0,
        snapshot_payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(doc_id) REFERENCES room_docs(doc_id) ON DELETE CASCADE
      );

      CREATE TABLE room_doc_presence (
        doc_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        cursor_payload TEXT,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY(doc_id, user_id),
        FOREIGN KEY(doc_id) REFERENCES room_docs(doc_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE collections (
        collection_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE collection_fields (
        field_id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE
      );

      CREATE TABLE records (
        record_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        title TEXT NOT NULL,
        source_pane_id TEXT,
        source_view_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        parent_record_id TEXT REFERENCES records(record_id),
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
        FOREIGN KEY(source_pane_id) REFERENCES panes(pane_id) ON DELETE SET NULL,
        FOREIGN KEY(source_view_id) REFERENCES views(view_id) ON DELETE SET NULL,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE record_values (
        record_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(record_id, field_id),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(field_id) REFERENCES collection_fields(field_id) ON DELETE CASCADE
      );

      CREATE TABLE record_relations (
        relation_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        from_record_id TEXT NOT NULL,
        to_record_id TEXT NOT NULL,
        via_field_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(from_record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(to_record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(via_field_id) REFERENCES collection_fields(field_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE views (
        view_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE record_capabilities (
        record_id TEXT NOT NULL,
        capability_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(record_id, capability_type),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE task_state (
        record_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        priority TEXT,
        due_at TEXT,
        category TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE assignments (
        record_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        PRIMARY KEY(record_id, user_id),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE event_state (
        record_id TEXT PRIMARY KEY,
        start_dt TEXT NOT NULL,
        end_dt TEXT NOT NULL,
        timezone TEXT NOT NULL,
        location TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE event_participants (
        record_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT,
        added_at TEXT NOT NULL,
        PRIMARY KEY(record_id, user_id),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE recurrence_rules (
        record_id TEXT PRIMARY KEY,
        rule_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE reminders (
        reminder_id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        channels TEXT NOT NULL,
        created_at TEXT NOT NULL,
        fired_at TEXT,
        dismissed_at TEXT,
        recurrence_json TEXT,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE files (
        file_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        asset_root_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_path TEXT NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        hash TEXT,
        metadata_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(asset_root_id) REFERENCES asset_roots(asset_root_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE file_blobs (
        file_id TEXT PRIMARY KEY,
        storage_pointer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(file_id) REFERENCES files(file_id) ON DELETE CASCADE
      );

      CREATE TABLE entity_attachments (
        attachment_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        asset_root_id TEXT NOT NULL,
        asset_path TEXT NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(asset_root_id) REFERENCES asset_roots(asset_root_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE asset_roots (
        asset_root_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        root_path TEXT NOT NULL,
        connection_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE comments (
        comment_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        author_user_id TEXT NOT NULL,
        target_entity_type TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        body_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(author_user_id) REFERENCES users(user_id)
      );

      CREATE TABLE comment_anchors (
        comment_id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        anchor_payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
        FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE
      );

      CREATE TABLE mentions (
        mention_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_entity_type TEXT NOT NULL,
        source_entity_id TEXT NOT NULL,
        target_entity_type TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE timeline_events (
        timeline_event_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        primary_entity_type TEXT NOT NULL,
        primary_entity_id TEXT NOT NULL,
        secondary_entities_json TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(actor_user_id) REFERENCES users(user_id)
      );

      CREATE TABLE notifications (
        notification_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN (${notificationReasonCheckSql})),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        -- notification_scope: 'network' = server-generated, requires relay (assignments, mentions, etc.)
        -- notification_scope: 'local' = client-generated, device-only (reminders, personal alerts)
        -- Local notifications are never written by the server. This column exists to keep the model coherent when reminders are built.
        notification_scope TEXT NOT NULL DEFAULT 'network' CHECK (notification_scope IN ('network', 'local')),
        read_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE personal_tasks (
        task_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE chat_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_room_id TEXT NOT NULL,
        message_sender_display_name TEXT NOT NULL,
        message_text TEXT NOT NULL,
        message_timestamp TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE matrix_accounts (
        user_id TEXT PRIMARY KEY,
        matrix_user_id TEXT NOT NULL UNIQUE,
        matrix_device_id TEXT,
        matrix_password_encrypted TEXT NOT NULL,
        provisioned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE automation_rules (
        automation_rule_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        trigger_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE automation_runs (
        automation_run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        automation_rule_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
        input_event_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(automation_rule_id) REFERENCES automation_rules(automation_rule_id) ON DELETE CASCADE
      );

      CREATE TABLE bug_reports (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        reporter_name TEXT,
        reporter_email TEXT,
        description TEXT NOT NULL,
        screenshot_path TEXT,
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'in_progress', 'fixed', 'wont_fix')),
        "public" INTEGER NOT NULL DEFAULT 0 CHECK ("public" IN (0, 1)),
        notes TEXT
      );

      CREATE TRIGGER pane_members_must_be_project_members
      BEFORE INSERT ON pane_members
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM panes p
              JOIN project_members pm ON pm.project_id = p.project_id
              WHERE p.pane_id = NEW.pane_id
                AND pm.user_id = NEW.user_id
            )
            THEN RAISE(ABORT, 'pane_members must be a subset of project_members')
          END;
      END;

      CREATE TRIGGER records_collection_project_consistency_insert
      BEFORE INSERT ON records
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM collections c
              WHERE c.collection_id = NEW.collection_id
                AND c.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'records.project_id must match collections.project_id')
          END;
      END;

      CREATE TRIGGER records_collection_project_consistency_update
      BEFORE UPDATE OF project_id, collection_id ON records
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM collections c
              WHERE c.collection_id = NEW.collection_id
                AND c.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'records.project_id must match collections.project_id')
          END;
      END;

      CREATE TRIGGER record_relations_project_consistency_insert
      BEFORE INSERT ON record_relations
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM records rf
              JOIN records rt ON rt.record_id = NEW.to_record_id
              WHERE rf.record_id = NEW.from_record_id
                AND rf.project_id = NEW.project_id
                AND rt.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'record_relations records must match relation project_id')
          END;
      END;

      CREATE TRIGGER record_relations_project_consistency_update
      BEFORE UPDATE OF project_id, from_record_id, to_record_id ON record_relations
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM records rf
              JOIN records rt ON rt.record_id = NEW.to_record_id
              WHERE rf.record_id = NEW.from_record_id
                AND rf.project_id = NEW.project_id
                AND rt.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'record_relations records must match relation project_id')
          END;
      END;

      CREATE TRIGGER comment_anchor_requires_doc_target
      BEFORE INSERT ON comment_anchors
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM comments c
              WHERE c.comment_id = NEW.comment_id
                AND c.target_entity_type = 'doc'
                AND c.target_entity_id = NEW.doc_id
            )
            THEN RAISE(ABORT, 'comment_anchors require doc target')
          END;
      END;

      CREATE TRIGGER comment_anchor_requires_node_key_insert
      BEFORE INSERT ON comment_anchors
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN COALESCE(json_extract(NEW.anchor_payload, '$.kind'), '') != 'node'
              OR COALESCE(json_extract(NEW.anchor_payload, '$.nodeKey'), '') = ''
            THEN RAISE(ABORT, 'comment_anchors must be node-key anchors')
          END;
      END;

      CREATE TRIGGER comment_anchor_requires_node_key_update
      BEFORE UPDATE OF anchor_payload ON comment_anchors
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN COALESCE(json_extract(NEW.anchor_payload, '$.kind'), '') != 'node'
              OR COALESCE(json_extract(NEW.anchor_payload, '$.nodeKey'), '') = ''
            THEN RAISE(ABORT, 'comment_anchors must be node-key anchors')
          END;
      END;

      CREATE INDEX idx_project_members_user_project ON project_members(user_id, project_id);
      CREATE INDEX idx_pane_members_user_pane ON pane_members(user_id, pane_id);
      CREATE INDEX idx_panes_project_sort ON panes(project_id, sort_order);
      CREATE UNIQUE INDEX idx_docs_pane_unique ON docs(pane_id);
      CREATE INDEX idx_rooms_space_status_created ON rooms(space_id, status, created_at DESC, room_id DESC);
      CREATE INDEX idx_room_members_user_room ON room_members(user_id, room_id);
      CREATE UNIQUE INDEX idx_room_docs_room_unique ON room_docs(room_id);
      CREATE INDEX idx_records_project_collection_updated ON records(project_id, collection_id, updated_at DESC);
      CREATE INDEX idx_records_project_source_pane ON records(project_id, source_pane_id);
      CREATE INDEX idx_records_project_source_view ON records(project_id, source_view_id);
      CREATE INDEX IF NOT EXISTS idx_records_parent ON records(parent_record_id);
      CREATE INDEX idx_record_values_field_record ON record_values(field_id, record_id);
      CREATE INDEX idx_record_values_record_field ON record_values(record_id, field_id);
      CREATE INDEX idx_record_relations_project_from ON record_relations(project_id, from_record_id);
      CREATE INDEX idx_record_relations_project_to ON record_relations(project_id, to_record_id);
      CREATE UNIQUE INDEX idx_record_relations_unique_edge ON record_relations(project_id, from_record_id, to_record_id, via_field_id);
      CREATE INDEX idx_views_project_collection_type ON views(project_id, collection_id, type);
      CREATE INDEX idx_event_state_start ON event_state(start_dt);
      CREATE INDEX idx_event_participants_user_record ON event_participants(user_id, record_id);
      CREATE INDEX idx_reminders_due_active ON reminders(remind_at)
        WHERE fired_at IS NULL AND dismissed_at IS NULL;
      CREATE INDEX idx_reminders_visible_undismissed ON reminders(remind_at)
        WHERE dismissed_at IS NULL;
      CREATE INDEX idx_attachments_entity_lookup ON entity_attachments(project_id, entity_type, entity_id);
      CREATE INDEX idx_attachments_asset_lookup ON entity_attachments(asset_root_id, asset_path);
      CREATE INDEX idx_files_project_asset_path ON files(project_id, asset_root_id, provider_path);
      CREATE INDEX idx_comments_entity_lookup ON comments(project_id, target_entity_type, target_entity_id, created_at DESC);
      CREATE INDEX idx_mentions_target_lookup ON mentions(project_id, target_entity_type, target_entity_id);
      CREATE INDEX idx_timeline_project_created ON timeline_events(project_id, created_at DESC);
      CREATE INDEX idx_timeline_primary_lookup ON timeline_events(project_id, primary_entity_type, primary_entity_id, created_at DESC);
      CREATE INDEX idx_notifications_user_unread_created ON notifications(user_id, read_at, created_at DESC);
      CREATE INDEX idx_pending_project_invites_project_status_created
        ON pending_project_invites(project_id, status, created_at DESC);
      CREATE INDEX idx_pending_project_invites_email_status
        ON pending_project_invites(LOWER(email), status);
      CREATE INDEX idx_personal_tasks_user_updated
        ON personal_tasks(user_id, updated_at DESC, task_id DESC);
      CREATE INDEX idx_chat_snapshots_project_created
        ON chat_snapshots(project_id, created_at DESC, snapshot_id DESC);
      CREATE INDEX idx_automation_runs_rule_started ON automation_runs(automation_rule_id, started_at DESC);
      CREATE UNIQUE INDEX idx_projects_personal_owner ON projects(created_by)
        WHERE project_type = 'personal';
      CREATE INDEX idx_bug_reports_public_created ON bug_reports("public", created_at DESC, id DESC);
    `);

    db.prepare('INSERT INTO schema_version (id, version, updated_at) VALUES (1, 1, ?)').run(nowIso());

    db.exec('COMMIT;');
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
      schemaLog.warn('Schema reset rollback failed.', { error: rollbackError });
    }
    db.exec('PRAGMA foreign_keys = ON;');
    throw error;
  }
};

const schemaReady = (db) => {
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name),
  );
  const triggers = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
      .all()
      .map((row) => row.name),
  );
  const indexes = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name),
  );

  for (const name of CONTRACT_TABLES) {
    if (!tables.has(name)) {
      return false;
    }
  }

  for (const name of CONTRACT_TRIGGERS) {
    if (!triggers.has(name)) {
      return false;
    }
  }

  for (const name of CONTRACT_INDEXES) {
    if (!indexes.has(name)) {
      return false;
    }
  }

  const versionRow = db.prepare('SELECT version FROM schema_version WHERE id = 1').get();
  return Number(versionRow?.version) === 1;
};

const userTableCount = (db) =>
  Number(
    db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get()?.count || 0,
  );

const userTableCountWithWriteLock = (db) => {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const count = userTableCount(db);
    db.exec('COMMIT;');
    return count;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
      schemaLog.warn('Schema empty-check rollback failed.', { error: rollbackError });
    }
    throw error;
  }
};

export const initSchema = (db) => {
  if (schemaReady(db)) {
    return;
  }

  if (userTableCountWithWriteLock(db) === 0) {
    resetSchemaToContractV1(db);
    return;
  }

  if (!HUB_API_ALLOW_SCHEMA_RESET) {
    throw new Error('Contract schema mismatch. Set HUB_API_ALLOW_SCHEMA_RESET=true to recreate schema v1.');
  }

  resetSchemaToContractV1(db);
};
