export const createWidgetPickerSeedQueries = (db) => ({
  listAll: db.prepare(`
    SELECT widget_type, size_tier, seed_data_json, updated_at
    FROM widget_picker_seed_data
    ORDER BY widget_type ASC, size_tier ASC
  `),
});
