import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from './migrations.mjs';
import { initSearch } from './search-setup.mjs';
import { initSchema } from './schema.mjs';
import { createStatements } from './statements.mjs';

export const initializeDatabase = (hubDbPath) => {
  const db = new DatabaseSync(hubDbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  initSchema(db);
  initSearch(db);
  const stmts = createStatements(db);
  return { db, stmts };
};
