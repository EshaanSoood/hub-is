const parseSeedData = (row, requestLog) => {
  try {
    const parsed = JSON.parse(row.seed_data_json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    requestLog?.warn?.('Failed to parse module picker seed data.', {
      moduleType: row.module_type,
      sizeTier: row.size_tier,
      error,
    });
    return {};
  }
};

export const createModulePickerSeedDataRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    modulePickerSeedDataStmt,
  } = deps;

  const listSeedData = withPolicyGate('hub.view', async ({ request, response }) => {
    const rows = modulePickerSeedDataStmt.all();
    const seedData = rows.reduce((acc, row) => {
      const moduleType = String(row.module_type || '');
      const sizeTier = String(row.size_tier || '');
      if (!moduleType || !sizeTier) {
        return acc;
      }
      acc[moduleType] = {
        ...(acc[moduleType] || {}),
        [sizeTier]: parseSeedData(row, request.log),
      };
      return acc;
    }, {});

    send(response, jsonResponse(200, okEnvelope({ seedData })));
  });

  return { listSeedData };
};
