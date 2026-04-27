import { seedWidgetPickerSeedData } from './widgetPickerSeedInitialData.mjs';

export const installWidgetPickerSeedData = (db, nowIso) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS widget_picker_seed_data (
      widget_type TEXT NOT NULL,
      size_tier TEXT NOT NULL CHECK (size_tier IN ('S', 'M', 'L')),
      seed_data_json TEXT NOT NULL CHECK (json_valid(seed_data_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(widget_type, size_tier)
    );

    CREATE INDEX IF NOT EXISTS idx_widget_picker_seed_widget_size
      ON widget_picker_seed_data(widget_type, size_tier);
  `);

  seedWidgetPickerSeedData(db, nowIso);
};
