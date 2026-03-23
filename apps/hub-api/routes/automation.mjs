export const createAutomationRoutes = (deps) => {
  const {
    withAuth,
    withProjectPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    asBoolean,
    parseJson,
    parseJsonObject,
    toJson,
    nowIso,
    newId,
    emitTimelineEvent,
    automationRulesByProjectStmt,
    automationRuleByIdStmt,
    automationRunsByProjectStmt,
    insertAutomationRuleStmt,
    updateAutomationRuleStmt,
    deleteAutomationRuleStmt,
  } = deps;

  const listProjectAutomationRules = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const rules = automationRulesByProjectStmt.all(projectId).map((rule) => ({
      automation_rule_id: rule.automation_rule_id,
      project_id: rule.project_id,
      name: rule.name,
      enabled: rule.enabled === 1,
      trigger_json: parseJson(rule.trigger_json, {}),
      actions_json: parseJson(rule.actions_json, []),
      created_by: rule.created_by,
      created_at: rule.created_at,
      updated_at: rule.updated_at,
    }));
    send(response, jsonResponse(200, okEnvelope({ automation_rules: rules })));
  };

  const createAutomationRule = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'write' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for automation rule creation.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const name = asText(body.name);
    if (!name) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Rule name is required.')));
      return;
    }

    const timestamp = nowIso();
    const ruleId = newId('aut');
    insertAutomationRuleStmt.run(
      ruleId,
      projectId,
      name,
      asBoolean(body.enabled, true) ? 1 : 0,
      toJson(parseJsonObject(body.trigger_json, {})),
      toJson(Array.isArray(body.actions_json) ? body.actions_json : []),
      auth.user.user_id,
      timestamp,
      timestamp,
    );

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'automation.rule_created',
      primaryEntityType: 'automation_rule',
      primaryEntityId: ruleId,
      summary: { name },
    });

    send(response, jsonResponse(201, okEnvelope({ automation_rule_id: ruleId })));
  };

  const updateAutomationRule = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const ruleId = params.ruleId;
    const rule = automationRuleByIdStmt.get(ruleId);
    if (!rule) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Automation rule not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: rule.project_id,
      requiredCapability: 'write',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for automation rule update.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const nextName = asText(body.name) || rule.name;
    const enabled = body.enabled === undefined ? rule.enabled === 1 : asBoolean(body.enabled, true);
    const triggerJson = body.trigger_json === undefined ? parseJson(rule.trigger_json, {}) : parseJsonObject(body.trigger_json, {});
    const actionsJson = body.actions_json === undefined ? parseJson(rule.actions_json, []) : (Array.isArray(body.actions_json) ? body.actions_json : []);

    updateAutomationRuleStmt.run(nextName, enabled ? 1 : 0, toJson(triggerJson), toJson(actionsJson), nowIso(), ruleId);
    emitTimelineEvent({
      projectId: rule.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'automation.rule_updated',
      primaryEntityType: 'automation_rule',
      primaryEntityId: ruleId,
      summary: { name: nextName, enabled },
    });
    send(response, jsonResponse(200, okEnvelope({ updated: true })));
  };

  const deleteAutomationRule = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const ruleId = params.ruleId;
    const rule = automationRuleByIdStmt.get(ruleId);
    if (!rule) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Automation rule not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: rule.project_id,
      requiredCapability: 'write',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    deleteAutomationRuleStmt.run(ruleId);
    send(response, jsonResponse(200, okEnvelope({ deleted: true })));
  };

  const listAutomationRuns = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const runs = automationRunsByProjectStmt.all(projectId).map((run) => ({
      automation_run_id: run.automation_run_id,
      project_id: run.project_id,
      automation_rule_id: run.automation_rule_id,
      status: run.status,
      input_event_json: parseJson(run.input_event_json, {}),
      output_json: parseJson(run.output_json, {}),
      started_at: run.started_at,
      finished_at: run.finished_at,
    }));

    send(response, jsonResponse(200, okEnvelope({ automation_runs: runs })));
  };

  return {
    createAutomationRule,
    deleteAutomationRule,
    listAutomationRuns,
    listProjectAutomationRules,
    updateAutomationRule,
  };
};
