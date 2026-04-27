const parseSeedData = (row, requestLog) => {
  try {
    const parsed = JSON.parse(row.seed_data_json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    requestLog?.warn?.('Failed to parse widget picker seed data.', {
      widgetType: row.widget_type,
      sizeTier: row.size_tier,
      error,
    });
    return {};
  }
};

export const createWidgetPickerSeedDataRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    widgetPickerSeedDataStmt,
  } = deps;

  const listSeedData = withPolicyGate('hub.view', async ({ request, response }) => {
    const rows = widgetPickerSeedDataStmt.all();
    const seedData = rows.reduce((acc, row) => {
      const widgetType = String(row.widget_type || '');
      const sizeTier = String(row.size_tier || '');
      if (!widgetType || !sizeTier) {
        return acc;
      }
      acc[widgetType] = {
        ...(acc[widgetType] || {}),
        [sizeTier]: parseSeedData(row, request.log),
      };
      return acc;
    }, {});

    send(response, jsonResponse(200, okEnvelope({ seedData })));
  });

  return { listSeedData };
};
