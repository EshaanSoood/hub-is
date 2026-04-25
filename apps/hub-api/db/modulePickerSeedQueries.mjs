export const createModulePickerSeedQueries = (db) => ({
  listAll: db.prepare(`
    SELECT module_type, size_tier, seed_data_json, updated_at
    FROM module_picker_seed_data
    ORDER BY module_type ASC, size_tier ASC
  `),
});
