/**
 * FTS5 full-text search initialization — creates virtual tables, maintenance triggers, and seeds indexes when they fall out of sync with source tables.
 */
export const initSearch = (db) => {
  db.exec(`
    DROP TRIGGER IF EXISTS search_records_fts_insert;
    DROP TRIGGER IF EXISTS search_records_fts_update;

    CREATE VIRTUAL TABLE IF NOT EXISTS search_records_fts USING fts5(
      record_id UNINDEXED,
      space_id UNINDEXED,
      title,
      content_type UNINDEXED
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS search_spaces_fts USING fts5(
      space_id UNINDEXED,
      name
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS search_projects_fts USING fts5(
      project_id UNINDEXED,
      space_id UNINDEXED,
      name
    );

    CREATE TRIGGER search_records_fts_insert AFTER INSERT ON records
    WHEN NEW.archived_at IS NULL BEGIN
      INSERT INTO search_records_fts(record_id, space_id, title, content_type)
      VALUES (NEW.record_id, NEW.space_id, NEW.title, 'record');
    END;

    CREATE TRIGGER search_records_fts_update AFTER UPDATE OF title, archived_at ON records BEGIN
      DELETE FROM search_records_fts WHERE record_id = OLD.record_id;
      INSERT INTO search_records_fts(record_id, space_id, title, content_type)
      SELECT NEW.record_id, NEW.space_id, NEW.title, 'record'
      WHERE NEW.archived_at IS NULL;
    END;

    CREATE TRIGGER IF NOT EXISTS search_records_fts_delete AFTER DELETE ON records BEGIN
      DELETE FROM search_records_fts WHERE record_id = OLD.record_id;
    END;

    CREATE TRIGGER IF NOT EXISTS search_spaces_fts_insert AFTER INSERT ON spaces BEGIN
      INSERT INTO search_spaces_fts(space_id, name)
      VALUES (NEW.space_id, NEW.name);
    END;

    CREATE TRIGGER IF NOT EXISTS search_spaces_fts_update AFTER UPDATE OF name ON spaces BEGIN
      DELETE FROM search_spaces_fts WHERE space_id = OLD.space_id;
      INSERT INTO search_spaces_fts(space_id, name)
      VALUES (NEW.space_id, NEW.name);
    END;

    CREATE TRIGGER IF NOT EXISTS search_spaces_fts_delete AFTER DELETE ON spaces BEGIN
      DELETE FROM search_spaces_fts WHERE space_id = OLD.space_id;
    END;

    CREATE TRIGGER IF NOT EXISTS search_projects_fts_insert AFTER INSERT ON projects BEGIN
      INSERT INTO search_projects_fts(project_id, space_id, name)
      VALUES (NEW.project_id, NEW.space_id, NEW.name);
    END;

    CREATE TRIGGER IF NOT EXISTS search_projects_fts_update AFTER UPDATE OF name ON projects BEGIN
      DELETE FROM search_projects_fts WHERE project_id = OLD.project_id;
      INSERT INTO search_projects_fts(project_id, space_id, name)
      VALUES (NEW.project_id, NEW.space_id, NEW.name);
    END;

    CREATE TRIGGER IF NOT EXISTS search_projects_fts_delete AFTER DELETE ON projects BEGIN
      DELETE FROM search_projects_fts WHERE project_id = OLD.project_id;
    END;
  `);

  db.exec(`
    DELETE FROM search_records_fts;
    INSERT INTO search_records_fts(record_id, space_id, title, content_type)
    SELECT record_id, space_id, title, 'record'
    FROM records
    WHERE archived_at IS NULL;
  `);

  const spacesCount = Number(db.prepare('SELECT COUNT(*) AS count FROM spaces').get()?.count || 0);
  db.exec('DELETE FROM search_spaces_fts;');
  if (spacesCount > 0) {
    db.exec(`
      INSERT INTO search_spaces_fts(space_id, name)
      SELECT space_id, name
      FROM spaces;
    `);
  }

  const projectsCount = Number(db.prepare('SELECT COUNT(*) AS count FROM projects').get()?.count || 0);
  db.exec('DELETE FROM search_projects_fts;');
  if (projectsCount > 0) {
    db.exec(`
      INSERT INTO search_projects_fts(project_id, space_id, name)
      SELECT project_id, space_id, name
      FROM projects;
    `);
  }
};
