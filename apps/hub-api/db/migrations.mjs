import { createRequestLogger } from '../lib/logger.mjs';

const migrationLog = createRequestLogger('system', 'SYSTEM', '/db/migrations', 'system');

const tableExists = (db, tableName) =>
  Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(tableName)?.ok);

const indexExists = (db, indexName) =>
  Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1").get(indexName)?.ok);

const triggerExists = (db, triggerName) =>
  Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'trigger' AND name = ? LIMIT 1").get(triggerName)?.ok);

const tableColumns = (db, tableName) =>
  new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));

export const runMigrations = (db) => {
  if (!tableExists(db, 'schema_version') || !tableExists(db, 'docs')) {
    return;
  }

  const version = Number(db.prepare('SELECT version FROM schema_version WHERE id = 1').get()?.version || 0);
  if (version >= 3) {
    return;
  }

  if (version < 3) {
    db.exec('PRAGMA foreign_keys = OFF;');
  }
  db.exec('BEGIN IMMEDIATE;');
  try {
    if (version < 2) {
      const columns = tableColumns(db, 'docs');
      if (!columns.has('title')) {
        db.exec("ALTER TABLE docs ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled';");
      }
      if (!columns.has('position')) {
        db.exec('ALTER TABLE docs ADD COLUMN position INTEGER NOT NULL DEFAULT 0;');
      }
      if (indexExists(db, 'idx_docs_project_unique')) {
        db.exec('DROP INDEX idx_docs_project_unique;');
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_docs_project_position_created_at ON docs(project_id, position, created_at);');
      db.prepare('UPDATE schema_version SET version = 2, updated_at = ? WHERE id = 1').run(new Date().toISOString());
    }

    if (version < 3) {
      const spaceColumns = tableColumns(db, 'spaces');
      if (!spaceColumns.has('pending_deletion_at')) {
        db.exec('ALTER TABLE spaces ADD COLUMN pending_deletion_at TEXT;');
      }

      if (triggerExists(db, 'project_members_must_be_space_members')) {
        db.exec('DROP TRIGGER project_members_must_be_space_members;');
      }
      if (indexExists(db, 'idx_space_members_user_space')) {
        db.exec('DROP INDEX idx_space_members_user_space;');
      }

      db.exec(`
        CREATE TABLE space_members_v3 (
          space_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
          joined_at TEXT NOT NULL,
          expires_at TEXT,
          invited_by TEXT,
          approved_by TEXT,
          cooldown_until TEXT,
          PRIMARY KEY(space_id, user_id),
          FOREIGN KEY(space_id) REFERENCES spaces(space_id) ON DELETE CASCADE,
          FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY(invited_by) REFERENCES users(user_id),
          FOREIGN KEY(approved_by) REFERENCES users(user_id)
        );
      `);
      db.exec(`
        INSERT INTO space_members_v3 (
          space_id,
          user_id,
          role,
          joined_at,
          expires_at,
          invited_by,
          approved_by,
          cooldown_until
        )
        SELECT
          space_id,
          user_id,
          CASE
            WHEN role IN ('owner', 'admin', 'member', 'viewer', 'guest') THEN role
            ELSE 'member'
          END,
          joined_at,
          NULL,
          NULL,
          NULL,
          NULL
        FROM space_members;
      `);
      db.exec('DROP TABLE space_members;');
      db.exec('ALTER TABLE space_members_v3 RENAME TO space_members;');
      db.exec('CREATE INDEX idx_space_members_user_space ON space_members(user_id, space_id);');

      if (indexExists(db, 'idx_pending_space_invites_space_status_created')) {
        db.exec('DROP INDEX idx_pending_space_invites_space_status_created;');
      }
      if (indexExists(db, 'idx_pending_space_invites_email_status')) {
        db.exec('DROP INDEX idx_pending_space_invites_email_status;');
      }

      db.exec(`
        CREATE TABLE pending_space_invites_v3 (
          invite_request_id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
          expires_after_days INTEGER,
          requested_by_user_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
          target_user_id TEXT,
          reviewed_by_user_id TEXT,
          reviewed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(space_id) REFERENCES spaces(space_id) ON DELETE CASCADE
        );
      `);
      db.exec(`
        INSERT INTO pending_space_invites_v3 (
          invite_request_id,
          space_id,
          email,
          role,
          expires_after_days,
          requested_by_user_id,
          status,
          target_user_id,
          reviewed_by_user_id,
          reviewed_at,
          created_at,
          updated_at
        )
        SELECT
          invite_request_id,
          space_id,
          email,
          CASE
            WHEN role IN ('owner', 'admin', 'member', 'viewer', 'guest') THEN role
            ELSE 'member'
          END,
          NULL,
          requested_by_user_id,
          status,
          target_user_id,
          reviewed_by_user_id,
          reviewed_at,
          created_at,
          updated_at
        FROM pending_space_invites;
      `);
      db.exec('DROP TABLE pending_space_invites;');
      db.exec('ALTER TABLE pending_space_invites_v3 RENAME TO pending_space_invites;');
      db.exec(`
        CREATE INDEX idx_pending_space_invites_space_status_created
          ON pending_space_invites(space_id, status, created_at DESC);
      `);
      db.exec(`
        CREATE INDEX idx_pending_space_invites_email_status
          ON pending_space_invites(LOWER(email), status);
      `);

      if (indexExists(db, 'idx_spaces_personal_owner')) {
        db.exec('DROP INDEX idx_spaces_personal_owner;');
      }
      db.exec(`
        CREATE INDEX idx_spaces_personal_owner ON spaces(created_by)
          WHERE space_type = 'personal';
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS pending_space_invite_projects (
          invite_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          FOREIGN KEY(invite_id) REFERENCES pending_space_invites(invite_request_id) ON DELETE CASCADE,
          FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pending_space_invite_projects_invite
          ON pending_space_invite_projects(invite_id);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS space_member_project_access (
          space_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          access_level TEXT NOT NULL DEFAULT 'write' CHECK (access_level IN ('read', 'write')),
          granted_at TEXT NOT NULL,
          granted_by TEXT NOT NULL,
          FOREIGN KEY(space_id, user_id) REFERENCES space_members(space_id, user_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY(granted_by) REFERENCES users(user_id)
        );
      `);
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_space_member_project_access_unique
          ON space_member_project_access(space_id, user_id, project_id);
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_space_member_project_access_project
          ON space_member_project_access(project_id);
      `);

      db.exec(`
        CREATE TRIGGER project_members_must_be_space_members
        BEFORE INSERT ON project_members
        FOR EACH ROW
        BEGIN
          SELECT
            CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM projects p
                JOIN space_members pm ON pm.space_id = p.space_id
                WHERE p.project_id = NEW.project_id
                  AND pm.user_id = NEW.user_id
              )
              THEN RAISE(ABORT, 'project_members must be a subset of space_members')
            END;
        END;
      `);
      db.exec('DROP TRIGGER IF EXISTS space_member_project_access_role_guard_insert;');
      db.exec('DROP TRIGGER IF EXISTS space_member_project_access_role_guard_update;');
      db.exec(`
        CREATE TRIGGER space_member_project_access_role_guard_insert
        BEFORE INSERT ON space_member_project_access
        FOR EACH ROW
        BEGIN
          SELECT
            CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM space_members sm
                WHERE sm.space_id = NEW.space_id
                  AND sm.user_id = NEW.user_id
                  AND sm.role IN ('viewer', 'guest')
              )
              THEN RAISE(ABORT, 'space_member_project_access requires viewer or guest membership')
            END;
        END;
      `);
      db.exec(`
        CREATE TRIGGER space_member_project_access_role_guard_update
        BEFORE UPDATE ON space_member_project_access
        FOR EACH ROW
        BEGIN
          SELECT
            CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM space_members sm
                WHERE sm.space_id = NEW.space_id
                  AND sm.user_id = NEW.user_id
                  AND sm.role IN ('viewer', 'guest')
              )
              THEN RAISE(ABORT, 'space_member_project_access requires viewer or guest membership')
            END;
        END;
      `);

      db.prepare('UPDATE schema_version SET version = 3, updated_at = ? WHERE id = 1').run(new Date().toISOString());
    }

    db.exec('COMMIT;');
    if (version < 3) {
      db.exec('PRAGMA foreign_keys = ON;');
    }
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
      migrationLog.warn('Rollback failed while applying schema v2 migration.', { error: rollbackError });
    }
    try {
      db.exec('PRAGMA foreign_keys = ON;');
    } catch (pragmaError) {
      migrationLog.warn('Failed to restore foreign_keys after migration error.', { error: pragmaError });
    }
    throw error;
  }
};
