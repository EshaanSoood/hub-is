import { seedModulePickerSeedData } from './modulePickerSeedInitialData.mjs';

export const installModulePickerSeedData = (db, nowIso) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS module_picker_seed_data (
      module_type TEXT NOT NULL,
      size_tier TEXT NOT NULL CHECK (size_tier IN ('S', 'M', 'L')),
      seed_data_json TEXT NOT NULL CHECK (json_valid(seed_data_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(module_type, size_tier)
    );
  `);

  seedModulePickerSeedData(db, nowIso);
};
