import { createRequestLogger } from '../lib/logger.mjs';

/**
 * Incremental schema migrations — additive ALTER TABLE and CREATE INDEX operations applied conditionally based on column/index existence checks.
 */
const migrationLog = createRequestLogger('system', 'SYSTEM', '/db/migrations', 'system');

const notificationReasons = Object.freeze([
  'mention', 'assignment', 'reminder', 'comment_reply', 'automation', 'update', 'comment', 'snapshot',
]);
const notificationReasonCheckSql = notificationReasons.map((reason) => `'${reason}'`).join(', ');

export const runMigrations = (db) => {
  const schemaVersionTable = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_version' LIMIT 1")
    .get();
  if (!schemaVersionTable?.ok) {
    return;
  }

  const versionRow = db.prepare('SELECT version FROM schema_version WHERE id = 1').get();
  if (Number(versionRow?.version) !== 1) {
    return;
  }

  const addColumnIfMissing = (tableName, columnName, columnType) => {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const column = db
        .prepare(`SELECT 1 AS ok FROM pragma_table_info('${tableName}') WHERE name = ? LIMIT 1`)
        .get(columnName);
      if (!column?.ok) {
        db.exec(`
          ALTER TABLE ${tableName}
          ADD COLUMN ${columnName} ${columnType};
        `);
      }
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      if (!/duplicate column name/i.test(String(error?.message || error))) {
        throw error;
      }
    }
  };

  addColumnIfMissing('projects', 'position', 'INTEGER');
  addColumnIfMissing('projects', 'name_prompt_completed', 'INTEGER NOT NULL DEFAULT 0 CHECK (name_prompt_completed IN (0, 1))');
  addColumnIfMissing('panes', 'position', 'INTEGER');

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_project_invites (
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
    CREATE INDEX IF NOT EXISTS idx_pending_project_invites_project_status_created
      ON pending_project_invites(project_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pending_project_invites_email_status
      ON pending_project_invites(LOWER(email), status);
  `);

  db.exec('BEGIN IMMEDIATE;');
  try {
    const notificationScopeColumn = db
      .prepare("SELECT 1 AS ok FROM pragma_table_info('notifications') WHERE name = 'notification_scope' LIMIT 1")
      .get();
    if (!notificationScopeColumn?.ok) {
      db.exec(`
        ALTER TABLE notifications
        ADD COLUMN notification_scope TEXT NOT NULL DEFAULT 'network'
        CHECK (notification_scope IN ('network', 'local'));
      `);
    }
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }

  const notificationsTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notifications' LIMIT 1")
    .get();
  const notificationsSql = String(notificationsTable?.sql || '');
  const hasAllReasons = notificationReasons.every((reason) => notificationsSql.includes(`'${reason}'`));
  if (!hasAllReasons) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        CREATE TABLE notifications_next (
          notification_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          reason TEXT NOT NULL CHECK (reason IN (${notificationReasonCheckSql})),
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          notification_scope TEXT NOT NULL DEFAULT 'network' CHECK (notification_scope IN ('network', 'local')),
          read_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
      `);
      db.exec(`
        INSERT INTO notifications_next (
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
        )
        SELECT
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
        FROM notifications;
      `);
      db.exec('DROP TABLE notifications;');
      db.exec('ALTER TABLE notifications_next RENAME TO notifications;');
      db.exec('CREATE INDEX idx_notifications_user_unread_created ON notifications(user_id, read_at, created_at DESC);');
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      throw error;
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS personal_tasks (
      task_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_updated
      ON personal_tasks(user_id, updated_at DESC, task_id DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_snapshots (
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
    CREATE INDEX IF NOT EXISTS idx_chat_snapshots_project_created
      ON chat_snapshots(project_id, created_at DESC, snapshot_id DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS matrix_accounts (
      user_id TEXT PRIMARY KEY,
      matrix_user_id TEXT NOT NULL UNIQUE,
      matrix_device_id TEXT,
      matrix_password_encrypted TEXT NOT NULL,
      provisioned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bug_reports (
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
    CREATE INDEX IF NOT EXISTS idx_bug_reports_public_created
      ON bug_reports("public", created_at DESC, id DESC);
  `);

  const matrixPasswordColumn = db
    .prepare("SELECT 1 AS ok FROM pragma_table_info('matrix_accounts') WHERE name = 'matrix_password_encrypted' LIMIT 1")
    .get();
  if (!matrixPasswordColumn?.ok) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        ALTER TABLE matrix_accounts
        ADD COLUMN matrix_password_encrypted TEXT;
      `);
      db.exec(`
        UPDATE matrix_accounts
        SET matrix_password_encrypted = '__MATRIX_PASSWORD_RESET_REQUIRED__'
        WHERE matrix_password_encrypted IS NULL;
      `);
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      if (!/duplicate column name/i.test(String(error?.message || error))) {
        throw error;
      }
    }
  }

  const chatSnapshotsTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chat_snapshots' LIMIT 1")
    .get();
  const chatSnapshotsSql = String(chatSnapshotsTable?.sql || '');
  const chatSnapshotsHasExpectedFks = chatSnapshotsSql.includes('FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE')
    && chatSnapshotsSql.includes('FOREIGN KEY(created_by) REFERENCES users(user_id)');
  if (!chatSnapshotsHasExpectedFks) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const orphanedChatSnapshots = db.prepare(`
        SELECT
          COUNT(*) AS orphaned_count,
          SUM(CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM projects p
              WHERE p.project_id = cs.project_id
            ) THEN 1
            ELSE 0
          END) AS missing_project_count,
          SUM(CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM users u
              WHERE u.user_id = cs.created_by
            ) THEN 1
            ELSE 0
          END) AS missing_creator_count
        FROM chat_snapshots cs
        WHERE NOT EXISTS (
          SELECT 1
          FROM projects p
          WHERE p.project_id = cs.project_id
        ) OR NOT EXISTS (
          SELECT 1
          FROM users u
          WHERE u.user_id = cs.created_by
        );
      `).get();
      if (Number(orphanedChatSnapshots?.orphaned_count || 0) > 0) {
        migrationLog.warn('[hub-api] Dropping orphaned chat_snapshots during FK migration', {
          orphaned_count: Number(orphanedChatSnapshots.orphaned_count || 0),
          missing_project_count: Number(orphanedChatSnapshots.missing_project_count || 0),
          missing_creator_count: Number(orphanedChatSnapshots.missing_creator_count || 0),
        });
      }
      db.exec(`
        CREATE TABLE chat_snapshots_next (
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
      `);
      db.exec(`
        INSERT INTO chat_snapshots_next (
          snapshot_id,
          project_id,
          conversation_room_id,
          message_sender_display_name,
          message_text,
          message_timestamp,
          created_by,
          created_at
        )
        SELECT
          cs.snapshot_id,
          cs.project_id,
          cs.conversation_room_id,
          cs.message_sender_display_name,
          cs.message_text,
          cs.message_timestamp,
          cs.created_by,
          cs.created_at
        FROM chat_snapshots cs
        JOIN projects p ON p.project_id = cs.project_id
        JOIN users u ON u.user_id = cs.created_by;
      `);
      db.exec('DROP TABLE chat_snapshots;');
      db.exec('ALTER TABLE chat_snapshots_next RENAME TO chat_snapshots;');
      db.exec(`
        CREATE INDEX idx_chat_snapshots_project_created
        ON chat_snapshots(project_id, created_at DESC, snapshot_id DESC);
      `);
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      throw error;
    }
  }

  const matrixAccountsTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'matrix_accounts' LIMIT 1")
    .get();
  const matrixAccountsSql = String(matrixAccountsTable?.sql || '');
  const matrixAccountsHasExpectedFk = matrixAccountsSql.includes('FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE');
  if (!matrixAccountsHasExpectedFk) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const orphanedMatrixAccounts = db.prepare(`
        SELECT COUNT(*) AS orphaned_count
        FROM matrix_accounts ma
        WHERE NOT EXISTS (
          SELECT 1
          FROM users u
          WHERE u.user_id = ma.user_id
        );
      `).get();
      if (Number(orphanedMatrixAccounts?.orphaned_count || 0) > 0) {
        migrationLog.warn('[hub-api] Dropping orphaned matrix_accounts during FK migration', {
          orphaned_count: Number(orphanedMatrixAccounts.orphaned_count || 0),
        });
      }
      db.exec(`
        CREATE TABLE matrix_accounts_next (
          user_id TEXT PRIMARY KEY,
          matrix_user_id TEXT NOT NULL UNIQUE,
          matrix_device_id TEXT,
          matrix_password_encrypted TEXT NOT NULL,
          provisioned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
      `);
      db.exec(`
        INSERT INTO matrix_accounts_next (
          user_id,
          matrix_user_id,
          matrix_device_id,
          matrix_password_encrypted,
          provisioned_at
        )
        SELECT
          ma.user_id,
          ma.matrix_user_id,
          ma.matrix_device_id,
          COALESCE(ma.matrix_password_encrypted, '__MATRIX_PASSWORD_RESET_REQUIRED__'),
          ma.provisioned_at
        FROM matrix_accounts ma
        JOIN users u ON u.user_id = ma.user_id;
      `);
      db.exec('DROP TABLE matrix_accounts;');
      db.exec('ALTER TABLE matrix_accounts_next RENAME TO matrix_accounts;');
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      throw error;
    }
  }

  const projectTypeColumn = db
    .prepare("SELECT 1 AS ok FROM pragma_table_info('projects') WHERE name = 'project_type' LIMIT 1")
    .get();
  if (!projectTypeColumn?.ok) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        ALTER TABLE projects
        ADD COLUMN project_type TEXT NOT NULL DEFAULT 'team'
        CHECK (project_type IN ('team', 'personal'));
      `);
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      if (!/duplicate column name/i.test(String(error?.message || error))) {
        throw error;
      }
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    const projectIsPersonalColumn = db
      .prepare("SELECT 1 AS ok FROM pragma_table_info('projects') WHERE name = 'is_personal' LIMIT 1")
      .get();
    if (!projectIsPersonalColumn?.ok) {
      db.exec(`
        ALTER TABLE projects
        ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 0
        CHECK (is_personal IN (0, 1));
      `);
    }

    db.prepare(`
      UPDATE projects
      SET is_personal = 1
      WHERE project_type = 'personal'
        AND COALESCE(is_personal, 0) != 1
    `).run();
    db.prepare(`
      UPDATE projects
      SET project_type = 'personal'
      WHERE COALESCE(is_personal, 0) = 1
        AND COALESCE(project_type, 'team') != 'personal'
    `).run();
    db.prepare(`
      UPDATE projects
      SET project_type = 'team'
      WHERE COALESCE(is_personal, 0) = 0
        AND COALESCE(project_type, 'team') != 'team'
    `).run();
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS projects_personal_consistency_insert
      BEFORE INSERT ON projects
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN (
              (COALESCE(NEW.is_personal, 0) = 1 AND COALESCE(NEW.project_type, 'team') != 'personal')
              OR (COALESCE(NEW.is_personal, 0) = 0 AND COALESCE(NEW.project_type, 'team') != 'team')
            )
            THEN RAISE(ABORT, 'projects.is_personal must match project_type')
          END;
      END;

      CREATE TRIGGER IF NOT EXISTS projects_personal_consistency_update
      BEFORE UPDATE OF is_personal, project_type ON projects
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN (
              (COALESCE(NEW.is_personal, 0) = 1 AND COALESCE(NEW.project_type, 'team') != 'personal')
              OR (COALESCE(NEW.is_personal, 0) = 0 AND COALESCE(NEW.project_type, 'team') != 'team')
            )
            THEN RAISE(ABORT, 'projects.is_personal must match project_type')
          END;
      END;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    throw error;
  }

  const projectTasksCollectionIdColumn = db
    .prepare("SELECT 1 AS ok FROM pragma_table_info('projects') WHERE name = 'tasks_collection_id' LIMIT 1")
    .get();
  if (!projectTasksCollectionIdColumn?.ok) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        ALTER TABLE projects
        ADD COLUMN tasks_collection_id TEXT;
      `);
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      if (!/duplicate column name/i.test(String(error?.message || error))) {
        throw error;
      }
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    const parentRecordIdColumn = db
      .prepare("SELECT 1 AS ok FROM pragma_table_info('records') WHERE name = 'parent_record_id' LIMIT 1")
      .get();
    if (!parentRecordIdColumn?.ok) {
      db.exec(`
        ALTER TABLE records
        ADD COLUMN parent_record_id TEXT REFERENCES records(record_id);
      `);
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_records_parent
      ON records(parent_record_id);
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }

  addColumnIfMissing('records', 'source_pane_id', 'TEXT REFERENCES panes(pane_id) ON DELETE SET NULL');
  addColumnIfMissing('records', 'source_view_id', 'TEXT REFERENCES views(view_id) ON DELETE SET NULL');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_records_project_source_pane ON records(project_id, source_pane_id);
    CREATE INDEX IF NOT EXISTS idx_records_project_source_view ON records(project_id, source_view_id);
  `);

  db.exec('BEGIN IMMEDIATE;');
  try {
    const taskStateDueAtColumn = db
      .prepare("SELECT 1 AS ok FROM pragma_table_info('task_state') WHERE name = 'due_at' LIMIT 1")
      .get();
    if (!taskStateDueAtColumn?.ok) {
      db.exec(`
        ALTER TABLE task_state
        ADD COLUMN due_at TEXT;
      `);
    }
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    const taskStateCategoryColumn = db
      .prepare("SELECT 1 AS ok FROM pragma_table_info('task_state') WHERE name = 'category' LIMIT 1")
      .get();
    if (!taskStateCategoryColumn?.ok) {
      db.exec(`
        ALTER TABLE task_state
        ADD COLUMN category TEXT;
      `);
    }
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    // Superseded later by idx_reminders_due_active once dismissed_at exists.
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_personal_owner
      ON projects(created_by)
      WHERE project_type = 'personal';
      CREATE INDEX IF NOT EXISTS idx_reminders_due_unfired
      ON reminders(remind_at)
      WHERE fired_at IS NULL;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    throw error;
  }

  const relationUniqueEdgeIndex = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_record_relations_unique_edge'")
    .get();
  if (!relationUniqueEdgeIndex) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const duplicateGroups = db.prepare(`
        SELECT project_id, from_record_id, to_record_id, via_field_id, COUNT(*) AS duplicate_count
        FROM record_relations
        GROUP BY project_id, from_record_id, to_record_id, via_field_id
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC, project_id, from_record_id, to_record_id, via_field_id
      `).all();
      if (duplicateGroups.length > 0) {
        const duplicateRowsToDelete = duplicateGroups.reduce(
          (total, row) => total + Number(row.duplicate_count || 0) - 1,
          0,
        );
        migrationLog.warn('[hub-api] Deduplicating record_relations before unique index creation', {
          duplicate_groups: duplicateGroups.length,
          duplicate_rows_to_delete: duplicateRowsToDelete,
          sample: duplicateGroups.slice(0, 5),
        });
      }
      db.exec(`
        DELETE FROM record_relations
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM record_relations
          GROUP BY project_id, from_record_id, to_record_id, via_field_id
        );
      `);
      db.exec(`
        CREATE UNIQUE INDEX idx_record_relations_unique_edge
        ON record_relations(project_id, from_record_id, to_record_id, via_field_id);
      `);
      db.exec('COMMIT;');
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
        // no-op
      }
      throw error;
    }
  }

  addColumnIfMissing('reminders', 'dismissed_at', 'TEXT');
  addColumnIfMissing('reminders', 'recurrence_json', 'TEXT');
  addColumnIfMissing('projects', 'reminders_collection_id', 'TEXT');

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      DROP INDEX IF EXISTS idx_reminders_due_unfired;
      CREATE INDEX IF NOT EXISTS idx_reminders_due_active
      ON reminders(remind_at)
      WHERE fired_at IS NULL AND dismissed_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_reminders_visible_undismissed
      ON reminders(remind_at)
      WHERE dismissed_at IS NULL;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
        migrationLog.warn('Rollback failed during migration cleanup.', { error: rollbackError });
      // no-op
    }
    throw error;
  }
};
