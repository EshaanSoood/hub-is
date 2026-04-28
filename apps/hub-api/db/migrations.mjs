import { createRequestLogger } from '../lib/logger.mjs';

const migrationLog = createRequestLogger('system', 'SYSTEM', '/db/migrations', 'system');

const tableExists = (db, tableName) =>
  Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(tableName)?.ok);

const indexExists = (db, indexName) =>
  Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1").get(indexName)?.ok);

const tableColumns = (db, tableName) =>
  new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));

export const runMigrations = (db) => {
  if (!tableExists(db, 'schema_version') || !tableExists(db, 'docs')) {
    return;
  }

  const version = Number(db.prepare('SELECT version FROM schema_version WHERE id = 1').get()?.version || 0);
  if (version >= 2) {
    return;
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
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
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
      migrationLog.warn('Rollback failed while applying schema v2 migration.', { error: rollbackError });
    }
    throw error;
  }
};
