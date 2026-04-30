import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { ensureRepoDir, loadEnvFilesIntoProcess, resolveRepoPath } from '../dev/lib/env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');

const TARGET_FILES = [
  'src/services/hub/collections.ts',
  'src/services/hub/docs.ts',
  'src/services/hub/files.ts',
  'src/services/hub/notifications.ts',
  'src/services/hub/projects.ts',
  'src/services/hub/records.ts',
  'src/services/hub/reminders.ts',
  'src/services/hub/search.ts',
  'src/services/hub/spaces.ts',
  'src/services/hub/transport.ts',
  'src/services/hub/views.ts',
  'src/services/sessionService.ts',
  'src/context/AuthzContext.tsx',
  'src/components/project-space/widget-picker/useWidgetPickerSeedData.ts',
];

const TOKEN_NAMES = {
  owner: 'HUB_OWNER_ACCESS_TOKEN',
  member: 'HUB_ACCESS_TOKEN',
  collab: 'HUB_COLLAB_ACCESS_TOKEN',
  outsider: 'HUB_NON_MEMBER_ACCESS_TOKEN',
};

const INVENTORY_PRIORITY = new Map([
  ['GET /api/hub/dev/bootstrap-auth', 10],
  ['GET /api/hub/me', 20],
  ['GET /api/hub/spaces', 30],
  ['GET /api/hub/spaces/:spaceId', 40],
  ['GET /api/hub/spaces/:spaceId/projects', 50],
  ['GET /api/hub/spaces/:spaceId/members', 60],
  ['GET /api/hub/spaces/:spaceId/collections', 70],
  ['GET /api/hub/collections/:collectionId/fields', 80],
  ['GET /api/hub/spaces/:spaceId/views', 90],
  ['POST /api/hub/views/query', 100],
  ['GET /api/hub/records/:recordId', 110],
  ['GET /api/hub/comments', 120],
  ['GET /api/hub/notifications/:notificationId/read', 130],
  ['DELETE /api/hub/relations/:relationId', 900],
  ['DELETE /api/hub/attachments/:attachmentId', 910],
  ['DELETE /api/hub/projects/:projectId/members/:userId', 920],
  ['DELETE /api/hub/spaces/:spaceId/members/:userId', 930],
  ['DELETE /api/hub/docs/:docId', 940],
  ['DELETE /api/hub/projects/:projectId', 950],
]);

const asArray = (value) => (Array.isArray(value) ? value : []);

const formatMs = (value) => `${value.toFixed(2)}ms`;

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'item';

const getSpaceId = (space) => String(space?.space_id || space?.id || '').trim();

const getWorkProjectId = (project) => String(project?.project_id || project?.id || '').trim();

const safeJson = async (response) => {
  return response.json().catch(() => null);
};

const decodeJwtPayload = (token) => {
  try {
    const [, payload] = String(token || '').split('.');
    if (!payload) {
      return null;
    }
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const assertFreshToken = (tokenName, token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    throw new Error(`${tokenName} is missing exp. Run npm run dev:secure:tokens first.`);
  }
  const expiresAtMs = Number(payload.exp) * 1000;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000) {
    throw new Error(`${tokenName} expires too soon. Run npm run dev:secure:tokens first.`);
  }
};

const inferMethod = (lines, index) => {
  for (let cursor = Math.max(0, index - 3); cursor < Math.min(lines.length, index + 8); cursor += 1) {
    const match = lines[cursor].match(/method:\s*'([A-Z]+)'/);
    if (match) {
      return match[1];
    }
  }
  return 'GET';
};

const inferParamName = (expression) => {
  const trimmed = String(expression || '').trim();
  const simple = trimmed.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!simple) {
    return 'id';
  }
  return simple[1];
};

const extractInlineApiPaths = (line) => {
  const paths = [];

  for (let index = 0; index < line.length; index += 1) {
    const quote = line[index];
    if (!['"', "'", '`'].includes(quote)) {
      continue;
    }

    if (!line.startsWith('/api/hub', index + 1) && !line.startsWith('/api/health', index + 1)) {
      continue;
    }

    if (quote === '"' || quote === "'") {
      const closingIndex = line.indexOf(quote, index + 1);
      if (closingIndex > index + 1) {
        paths.push(line.slice(index + 1, closingIndex));
        index = closingIndex;
      }
      continue;
    }

    let cursor = index + 1;
    while (cursor < line.length) {
      const character = line[cursor];
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (character === '`') {
        paths.push(line.slice(index + 1, cursor));
        index = cursor;
        break;
      }
      if (character === '$' && line[cursor + 1] === '{') {
        cursor += 2;
        let depth = 1;
        while (cursor < line.length && depth > 0) {
          const nestedCharacter = line[cursor];
          if (nestedCharacter === '\\') {
            cursor += 2;
            continue;
          }
          if (nestedCharacter === '{') {
            depth += 1;
          } else if (nestedCharacter === '}') {
            depth -= 1;
          }
          cursor += 1;
        }
        continue;
      }
      cursor += 1;
    }
  }

  return paths;
};

const normalizeInventoryPath = (rawPath) => {
  let normalized = String(rawPath || '').trim();
  normalized = normalized.replace(/[`'"]/g, '');

  let changed = true;
  while (changed) {
    changed = false;
    const replaced = normalized.replace(/\$\{encodeURIComponent\(([^{}()]+)\)\}/g, (_, expression) => `:${inferParamName(expression)}`);
    if (replaced !== normalized) {
      normalized = replaced;
      changed = true;
      continue;
    }

    const nested = normalized.replace(/\$\{([^{}]*)\}/g, (_, expression) => {
      const simpleParam = String(expression).trim().match(/^[A-Za-z_][A-Za-z0-9_]*$/);
      if (simpleParam) {
        return `:${simpleParam[0]}`;
      }
      return '';
    });
    if (nested !== normalized) {
      normalized = nested;
      changed = true;
    }
  }

  normalized = normalized.replace(/\?.*$/, '');
  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(/\/api\/hub\/spaces\/:projectId(\/|$)/g, '/api/hub/spaces/:spaceId$1');
  normalized = normalized.replace(/\/api\/hub\/spaces\/:space_id(\/|$)/g, '/api/hub/spaces/:spaceId$1');
  normalized = normalized.replace(/\/api\/hub\/projects\/:project_id(\/|$)/g, '/api/hub/projects/:projectId$1');
  normalized = normalized.replace(/\/api\/hub\/docs\/:doc_id(\/|$)/g, '/api/hub/docs/:docId$1');
  normalized = normalized.replace(/\/api\/hub\/collections\/:collection_id(\/|$)/g, '/api/hub/collections/:collectionId$1');
  normalized = normalized.replace(/\/api\/hub\/records\/:record_id(\/|$)/g, '/api/hub/records/:recordId$1');
  normalized = normalized.replace(/\/api\/hub\/relations\/:relation_id(\/|$)/g, '/api/hub/relations/:relationId$1');
  normalized = normalized.replace(/\/api\/hub\/attachments\/:attachment_id(\/|$)/g, '/api/hub/attachments/:attachmentId$1');
  normalized = normalized.replace(/\/api\/hub\/automation-rules\/:rule_id(\/|$)/g, '/api/hub/automation-rules/:ruleId$1');
  normalized = normalized.replace(/\/api\/hub\/comments\/:comment_id(\/|$)/g, '/api/hub/comments/:commentId$1');
  normalized = normalized.replace(/\/api\/hub\/notifications\/:notification_id(\/|$)/g, '/api/hub/notifications/:notificationId$1');
  normalized = normalized.replace(/\/api\/hub\/reminders\/:reminder_id(\/|$)/g, '/api/hub/reminders/:reminderId$1');
  normalized = normalized.replace(/\/api\/hub\/views\/:view_id(\/|$)/g, '/api/hub/views/:viewId$1');
  normalized = normalized.replace(/\/api\/hub\/files\/:file_id(\/|$)/g, '/api/hub/files/:fileId$1');
  normalized = normalized.replace(/\/+/g, '/');
  return normalized;
};

const routeSignature = (method, path) => {
  return `${method} ${path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':id')}`;
};

const inventoryClientApiCalls = async () => {
  const endpointMap = new Map();

  for (const relativePath of TARGET_FILES) {
    const absolutePath = resolveRepoPath(relativePath);
    const lines = (await readFile(absolutePath, 'utf8')).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const pathMatches = extractInlineApiPaths(line);
      if (pathMatches.length === 0) {
        continue;
      }

      for (const pathMatch of pathMatches) {
        const method = inferMethod(lines, index);
        const normalizedPath = normalizeInventoryPath(pathMatch);
        const key = `${method} ${normalizedPath}`;
        const sourceLocation = `${relativePath}:${index + 1}`;
        const existing = endpointMap.get(key);
        if (existing) {
          existing.sources.push(sourceLocation);
          continue;
        }

        endpointMap.set(key, {
          key,
          method,
          path: normalizedPath,
          signature: routeSignature(method, normalizedPath),
          sources: [sourceLocation],
        });
      }
    }
  }

  return [...endpointMap.values()].sort((left, right) => {
    const leftPriority = INVENTORY_PRIORITY.get(left.key) ?? 500;
    const rightPriority = INVENTORY_PRIORITY.get(right.key) ?? 500;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.key.localeCompare(right.key);
  });
};

const loadServerRouteSignatures = async () => {
  const snapshotPath = resolveRepoPath('apps/hub-api/api-snapshot.json');
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const signatures = new Set();
  for (const route of asArray(snapshot?.routes)) {
    if (!route?.method || !route?.path_pattern) {
      continue;
    }
    const normalized = String(route.path_pattern)
      .replace(/\(\[\^\/\]\+\)/g, ':id')
      .replace(/\/+/g, '/')
      .replace(/\/api\/hub\/spaces\/:id(\/|$)/g, '/api/hub/spaces/:id$1');
    signatures.add(`${route.method} ${normalized}`);
  }
  return signatures;
};

const requestHub = async ({ baseUrl, path, method = 'GET', token, body }) => {
  const startedAt = performance.now();
  const headers = new globalThis.Headers({
    Accept: 'application/json',
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    return {
      ok: false,
      networkError: error instanceof Error ? error.message : 'Network request failed.',
      status: null,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      payload: null,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    payload: await safeJson(response),
    networkError: null,
  };
};

const expectOkEnvelope = (result, allowedStatuses = [200]) => {
  if (!result || result.networkError) {
    throw new Error(result?.networkError || 'Expected HTTP response.');
  }
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`Expected ${allowedStatuses.join('/')} but received ${result.status}.`);
  }
  if (result.payload?.ok !== true || result.payload?.data == null) {
    throw new Error(`Expected success envelope but received ${JSON.stringify(result.payload)}.`);
  }
  return result.payload.data;
};

const pollForNotificationId = async ({ baseUrl, memberToken, sourceCommentId }) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await requestHub({
      baseUrl,
      method: 'GET',
      path: '/api/hub/notifications?unread=1',
      token: memberToken,
    });
    const data = result.payload?.data;
    const found = asArray(data?.notifications).find((notification) => notification.entity_id === sourceCommentId);
    if (found?.notification_id) {
      return found.notification_id;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  return '';
};

const buildFixtureContext = async ({ baseUrl, tokens, runTag }) => {
  const ownerMeData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'GET',
    path: '/api/hub/me',
    token: tokens.owner,
  }));
  const memberMeData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'GET',
    path: '/api/hub/me',
    token: tokens.member,
  }));
  const collabMeData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'GET',
    path: '/api/hub/me',
    token: tokens.collab,
  }));
  const outsiderMeData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'GET',
    path: '/api/hub/me',
    token: tokens.outsider,
  }));

  const spacesData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'GET',
    path: '/api/hub/spaces',
    token: tokens.owner,
  }));
  const availableSpaces = asArray(spacesData.spaces);
  const primarySpace = availableSpaces.find((space) => space.is_personal !== true) || availableSpaces[0];
  const primarySpaceId = getSpaceId(primarySpace);
  if (!primarySpaceId) {
    throw new Error('No space available for inventory fixture.');
  }

  const primaryProjectsData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'GET',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/projects`,
    token: tokens.owner,
  }));
  let primaryWorkProject = asArray(primaryProjectsData.projects)[0] || null;
  if (!getWorkProjectId(primaryWorkProject)) {
    const createdPrimaryProject = expectOkEnvelope(await requestHub({
      baseUrl,
      method: 'POST',
      path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/projects`,
      token: tokens.owner,
      body: {
        name: `Inventory Primary ${runTag}`,
      },
    }), [201]);
    primaryWorkProject = createdPrimaryProject.project;
  }
  const primaryWorkProjectId = getWorkProjectId(primaryWorkProject);
  if (!primaryWorkProjectId) {
    throw new Error('No work project available for inventory fixture.');
  }

  const tempSpaceData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: '/api/hub/spaces',
    token: tokens.owner,
    body: {
      name: `Inventory Temp ${runTag}`,
    },
  }), [201]);
  const tempSpaceId = getSpaceId(tempSpaceData.space) || String(tempSpaceData.space_id || '').trim();
  if (!tempSpaceId) {
    throw new Error('Failed to create temp space.');
  }

  const tempSpaceProjectData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(tempSpaceId)}/projects`,
    token: tokens.owner,
    body: {
      name: `Inventory Temp Project ${runTag}`,
    },
  }), [201]);
  const tempWorkProjectId = getWorkProjectId(tempSpaceProjectData.project) || String(tempSpaceProjectData.project_id || '').trim();
  if (!tempWorkProjectId) {
    throw new Error('Failed to create temp work project.');
  }

  const deleteProjectData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(tempSpaceId)}/projects`,
    token: tokens.owner,
    body: {
      name: `Inventory Delete Project ${runTag}`,
    },
  }), [201]);
  const deleteWorkProjectId = getWorkProjectId(deleteProjectData.project) || String(deleteProjectData.project_id || '').trim();
  if (!deleteWorkProjectId) {
    throw new Error('Failed to create deletable work project.');
  }

  expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(tempSpaceId)}/members`,
    token: tokens.owner,
    body: {
      user_id: outsiderMeData.user.user_id,
      role: 'member',
    },
  }), [200, 201]);

  expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(tempWorkProjectId)}/members`,
    token: tokens.owner,
    body: {
      user_id: outsiderMeData.user.user_id,
    },
  }), [200]);

  const mainDocData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(primaryWorkProjectId)}/docs`,
    token: tokens.owner,
    body: {
      title: `Inventory Main Doc ${runTag}`,
    },
  }), [201]);
  const mainDocId = String(mainDocData.doc?.doc_id || '');
  if (!mainDocId) {
    throw new Error('Failed to create main doc.');
  }

  const deleteDocData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(tempWorkProjectId)}/docs`,
    token: tokens.owner,
    body: {
      title: `Inventory Delete Doc ${runTag}`,
    },
  }), [201]);
  const deleteDocId = String(deleteDocData.doc?.doc_id || '');
  if (!deleteDocId) {
    throw new Error('Failed to create deletable doc.');
  }

  const collectionData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/collections`,
    token: tokens.owner,
    body: {
      name: `Inventory ${runTag}`,
    },
  }), [201]);
  const collectionId = String(collectionData.collection_id || '');
  if (!collectionId) {
    throw new Error('Failed to create collection.');
  }

  const statusFieldData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`,
    token: tokens.owner,
    body: {
      name: `Status ${runTag}`,
      type: 'select',
      config: {
        options: ['todo', 'done'],
      },
      sort_order: 1,
    },
  }), [201]);
  const statusFieldId = String(statusFieldData.field_id || '');

  const relationFieldData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`,
    token: tokens.owner,
    body: {
      name: `Related ${runTag}`,
      type: 'relation',
      config: {
        target_collection_id: collectionId,
      },
      sort_order: 2,
    },
  }), [201]);
  const relationFieldId = String(relationFieldData.field_id || '');
  if (!relationFieldId) {
    throw new Error('Failed to create relation field.');
  }

  const viewData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/views`,
    token: tokens.owner,
    body: {
      collection_id: collectionId,
      type: 'table',
      name: `Inventory View ${runTag}`,
      config: {},
      mutation_context_project_id: primaryWorkProjectId,
    },
  }), [201]);
  const viewId = String(viewData.view_id || '');
  if (!viewId) {
    throw new Error('Failed to create view.');
  }

  const recordAData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/records`,
    token: tokens.owner,
    body: {
      collection_id: collectionId,
      title: `Inventory Record A ${runTag}`,
      source_project_id: primaryWorkProjectId,
      capability_types: ['task'],
      task_state: {
        status: 'todo',
      },
    },
  }), [201]);
  const recordAId = String(recordAData.record_id || '');

  const recordBData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/records`,
    token: tokens.owner,
    body: {
      collection_id: collectionId,
      title: `Inventory Record B ${runTag}`,
      source_project_id: primaryWorkProjectId,
    },
  }), [201]);
  const recordBId = String(recordBData.record_id || '');
  if (!recordAId || !recordBId) {
    throw new Error('Failed to create records.');
  }

  const convertRecordData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/records`,
    token: tokens.owner,
    body: {
      collection_id: collectionId,
      title: `Inventory Convert ${runTag}`,
    },
  }), [201]);
  const convertRecordId = String(convertRecordData.record_id || '');
  if (!convertRecordId) {
    throw new Error('Failed to create convertible record.');
  }

  const relationData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/records/${encodeURIComponent(recordAId)}/relations`,
    token: tokens.owner,
    body: {
      space_id: primarySpaceId,
      from_record_id: recordAId,
      to_record_id: recordBId,
      via_field_id: relationFieldId,
      mutation_context_project_id: primaryWorkProjectId,
    },
  }), [201]);
  const relationId = String(relationData.relation?.relation_id || '');
  if (!relationId) {
    throw new Error('Failed to create relation.');
  }

  const reminderData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: '/api/hub/reminders',
    token: tokens.owner,
    body: {
      title: `Inventory Reminder ${runTag}`,
      remind_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  }), [201]);
  const reminderId = String(reminderData.reminder?.reminder_id || '');
  if (!reminderId) {
    throw new Error('Failed to create reminder.');
  }

  expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: '/api/hub/tasks',
    token: tokens.owner,
    body: {
      space_id: primarySpaceId,
      title: `Inventory Task ${runTag}`,
      status: 'todo',
    },
  }), [201]);

  const docCommentData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: '/api/hub/comments/doc-anchor',
    token: tokens.owner,
    body: {
      project_id: primarySpaceId,
      doc_id: mainDocId,
      anchor_payload: {
        kind: 'node',
        nodeKey: `inventory-node-${slug(runTag)}`,
      },
      body_json: {
        text: `Inventory doc comment ${runTag}`,
      },
    },
  }), [201]);
  const docCommentId = String(docCommentData.comment_id || '');
  if (!docCommentId) {
    throw new Error('Failed to create doc comment.');
  }
  const commentId = docCommentId;

  const mentionCommentData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: '/api/hub/comments/doc-anchor',
    token: tokens.owner,
    body: {
      project_id: primarySpaceId,
      doc_id: mainDocId,
      anchor_payload: {
        kind: 'node',
        nodeKey: `inventory-mention-node-${slug(runTag)}`,
      },
      body_json: {
        text: `Inventory mention ${runTag}`,
      },
      mentions: [
        {
          target_entity_type: 'user',
          target_entity_id: memberMeData.user.user_id,
          context: {
            source: 'inventory-runner',
          },
        },
      ],
    },
  }), [201]);
  const mentionCommentId = String(mentionCommentData.comment_id || '');

  const notificationId = await pollForNotificationId({
    baseUrl,
    memberToken: tokens.member,
    sourceCommentId: mentionCommentId,
  });

  const automationRuleData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/automation-rules`,
    token: tokens.owner,
    body: {
      name: `Inventory Rule ${runTag}`,
      enabled: true,
      trigger_json: {
        type: 'manual',
      },
      actions_json: [],
    },
  }), [201]);
  const automationRuleId = String(automationRuleData.automation_rule_id || '');
  if (!automationRuleId) {
    throw new Error('Failed to create automation rule.');
  }

  const assetRootData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: `/api/hub/spaces/${encodeURIComponent(primarySpaceId)}/asset-roots`,
    token: tokens.owner,
    body: {
      root_path: `/Inventory/${slug(runTag)}`,
    },
  }), [201]);
  const assetRootId = String(assetRootData.asset_root_id || '');
  if (!assetRootId) {
    throw new Error('Failed to create asset root.');
  }

  const attachmentData = expectOkEnvelope(await requestHub({
    baseUrl,
    method: 'POST',
    path: '/api/hub/attachments',
    token: tokens.owner,
    body: {
      space_id: primarySpaceId,
      entity_type: 'record',
      entity_id: recordAId,
      provider: 'nextcloud',
      asset_root_id: assetRootId,
      asset_path: `Uploads/${slug(runTag)}.txt`,
      name: `${slug(runTag)}.txt`,
      mime_type: 'text/plain',
      size_bytes: 5,
      mutation_context_project_id: primaryWorkProjectId,
      metadata: {},
    },
  }), [201]);
  const attachmentId = String(attachmentData.attachment_id || attachmentData.attachment?.attachment_id || '');
  if (!attachmentId) {
    throw new Error('Failed to create attachment.');
  }

  return {
    ownerUserId: String(ownerMeData.user.user_id),
    memberUserId: String(memberMeData.user.user_id),
    collabUserId: String(collabMeData.user.user_id),
    outsiderUserId: String(outsiderMeData.user.user_id),
    memberNotificationId: notificationId,
    primarySpaceId,
    primaryWorkProjectId,
    tempSpaceId,
    tempWorkProjectId,
    deleteWorkProjectId,
    mainDocId,
    deleteDocId,
    collectionId,
    statusFieldId,
    relationFieldId,
    viewId,
    recordAId,
    recordBId,
    convertRecordId,
    relationId,
    reminderId,
    commentId,
    docCommentId,
    automationRuleId,
    assetRootId,
    attachmentId,
  };
};

const buildProbe = (endpoint, context) => {
  const owner = context.tokens.owner;
  const member = context.tokens.member;
  const noToken = '';
  const q = encodeURIComponent(context.runTag);

  switch (endpoint.key) {
    case 'GET /api/hub/dev/bootstrap-auth':
      return { method: 'GET', path: '/api/hub/dev/bootstrap-auth', token: noToken };
    case 'GET /api/hub/me':
      return { method: 'GET', path: '/api/hub/me', token: owner };
    case 'GET /api/hub/widget-picker/seed-data':
      return { method: 'GET', path: '/api/hub/widget-picker/seed-data', token: owner };
    case 'GET /api/hub/spaces':
      return { method: 'GET', path: '/api/hub/spaces', token: owner };
    case 'POST /api/hub/spaces':
      return { method: 'POST', path: '/api/hub/spaces', token: owner, body: { name: `Inventory Probe Space ${context.runTag}` } };
    case 'GET /api/hub/spaces/:spaceId':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}`, token: owner };
    case 'PATCH /api/hub/spaces/:spaceId':
      return {
        method: 'PATCH',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}`,
        token: owner,
        body: { name: `Inventory Temp Patched ${context.runTag}` },
      };
    case 'GET /api/hub/spaces/:spaceId/members':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/members`, token: owner };
    case 'POST /api/hub/spaces/:spaceId/members':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/members`,
        token: owner,
        body: { user_id: context.fixture.collabUserId, role: 'viewer' },
      };
    case 'PATCH /api/hub/spaces/:spaceId/members/:userId':
      return {
        method: 'PATCH',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/members/${encodeURIComponent(context.fixture.outsiderUserId)}`,
        token: owner,
        body: { role: 'viewer' },
      };
    case 'DELETE /api/hub/spaces/:spaceId/members/:userId':
      return {
        method: 'DELETE',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/members/${encodeURIComponent(context.fixture.outsiderUserId)}`,
        token: owner,
      };
    case 'POST /api/hub/spaces/:spaceId/invites':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/invites`,
        token: owner,
        body: {
          email: `inventory-${slug(context.runTag)}@example.com`,
          role: 'viewer',
          project_ids: [context.fixture.tempWorkProjectId],
        },
      };
    case 'POST /api/hub/spaces/:spaceId/members/:userId/project-access':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/members/${encodeURIComponent(context.fixture.outsiderUserId)}/project-access`,
        token: owner,
        body: { project_id: context.fixture.tempWorkProjectId },
      };
    case 'GET /api/hub/spaces/:spaceId/projects':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/projects`, token: owner };
    case 'POST /api/hub/spaces/:spaceId/projects':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.tempSpaceId)}/projects`,
        token: owner,
        body: { name: `Inventory Probe Project ${context.runTag}` },
      };
    case 'PATCH /api/hub/projects/:projectId':
      return {
        method: 'PATCH',
        path: `/api/hub/projects/${encodeURIComponent(context.fixture.tempWorkProjectId)}`,
        token: owner,
        body: { name: `Inventory Temp Project Patched ${context.runTag}` },
      };
    case 'DELETE /api/hub/projects/:projectId':
      return { method: 'DELETE', path: `/api/hub/projects/${encodeURIComponent(context.fixture.deleteWorkProjectId)}`, token: owner };
    case 'POST /api/hub/projects/:projectId/members':
      return {
        method: 'POST',
        path: `/api/hub/projects/${encodeURIComponent(context.fixture.tempWorkProjectId)}/members`,
        token: owner,
        body: { user_id: context.fixture.collabUserId },
      };
    case 'DELETE /api/hub/projects/:projectId/members/:userId':
      return {
        method: 'DELETE',
        path: `/api/hub/projects/${encodeURIComponent(context.fixture.tempWorkProjectId)}/members/${encodeURIComponent(context.fixture.outsiderUserId)}`,
        token: owner,
      };
    case 'POST /api/hub/projects/:projectId/docs':
      return {
        method: 'POST',
        path: `/api/hub/projects/${encodeURIComponent(context.fixture.primaryWorkProjectId)}/docs`,
        token: owner,
        body: { title: `Inventory Probe Doc ${context.runTag}` },
      };
    case 'GET /api/hub/docs/:docId':
      return { method: 'GET', path: `/api/hub/docs/${encodeURIComponent(context.fixture.mainDocId)}`, token: owner };
    case 'PATCH /api/hub/docs/:docId':
      return {
        method: 'PATCH',
        path: `/api/hub/docs/${encodeURIComponent(context.fixture.mainDocId)}`,
        token: owner,
        body: { title: `Inventory Doc Patched ${context.runTag}` },
      };
    case 'PUT /api/hub/docs/:docId':
      return {
        method: 'PUT',
        path: `/api/hub/docs/${encodeURIComponent(context.fixture.mainDocId)}`,
        token: owner,
        body: {
          snapshot_payload: {
            lexical_state: {
              root: {
                type: 'root',
                key: 'root',
                children: [],
              },
            },
            node_keys: [],
          },
        },
      };
    case 'POST /api/hub/docs/:docId/presence':
      return {
        method: 'POST',
        path: `/api/hub/docs/${encodeURIComponent(context.fixture.mainDocId)}/presence`,
        token: owner,
        body: { cursor_payload: { x: 1, y: 1, source: 'inventory' } },
      };
    case 'DELETE /api/hub/docs/:docId':
      return { method: 'DELETE', path: `/api/hub/docs/${encodeURIComponent(context.fixture.deleteDocId)}`, token: owner };
    case 'GET /api/hub/spaces/:spaceId/collections':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/collections`, token: owner };
    case 'POST /api/hub/spaces/:spaceId/collections':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/collections`,
        token: owner,
        body: { name: `Inventory Extra Collection ${context.runTag}` },
      };
    case 'GET /api/hub/collections/:collectionId/fields':
      return { method: 'GET', path: `/api/hub/collections/${encodeURIComponent(context.fixture.collectionId)}/fields`, token: owner };
    case 'POST /api/hub/collections/:collectionId/fields':
      return {
        method: 'POST',
        path: `/api/hub/collections/${encodeURIComponent(context.fixture.collectionId)}/fields`,
        token: owner,
        body: {
          name: `Flag ${context.runTag}`,
          type: 'checkbox',
          config: {},
          sort_order: 99,
        },
      };
    case 'GET /api/hub/spaces/:spaceId/views':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/views`, token: owner };
    case 'POST /api/hub/spaces/:spaceId/views':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/views`,
        token: owner,
        body: {
          collection_id: context.fixture.collectionId,
          type: 'table',
          name: `Inventory Extra View ${context.runTag}`,
          config: {},
          mutation_context_project_id: context.fixture.primaryWorkProjectId,
        },
      };
    case 'PATCH /api/hub/views/:viewId':
      return {
        method: 'PATCH',
        path: `/api/hub/views/${encodeURIComponent(context.fixture.viewId)}`,
        token: owner,
        body: { name: `Inventory View Patched ${context.runTag}` },
      };
    case 'POST /api/hub/views/query':
      return {
        method: 'POST',
        path: '/api/hub/views/query',
        token: owner,
        body: {
          view_id: context.fixture.viewId,
          pagination: { limit: 10 },
        },
      };
    case 'POST /api/hub/spaces/:spaceId/records':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/records`,
        token: owner,
        body: {
          collection_id: context.fixture.collectionId,
          title: `Inventory Extra Record ${context.runTag}`,
          source_project_id: context.fixture.primaryWorkProjectId,
        },
      };
    case 'GET /api/hub/spaces/:spaceId/records/search':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/records/search?query=${q}&limit=10`,
        token: owner,
      };
    case 'GET /api/hub/records/:recordId':
      return { method: 'GET', path: `/api/hub/records/${encodeURIComponent(context.fixture.recordAId)}`, token: owner };
    case 'PATCH /api/hub/records/:recordId':
      return {
        method: 'PATCH',
        path: `/api/hub/records/${encodeURIComponent(context.fixture.recordAId)}`,
        token: owner,
        body: {
          title: `Inventory Record A Patched ${context.runTag}`,
        },
      };
    case 'POST /api/hub/records/:recordId/convert':
      return {
        method: 'POST',
        path: `/api/hub/records/${encodeURIComponent(context.fixture.convertRecordId)}/convert`,
        token: owner,
        body: {
          mode: 'task',
          target_project_id: context.fixture.primaryWorkProjectId,
          title: `Converted ${context.runTag}`,
        },
      };
    case 'POST /api/hub/records/:recordId/values':
      return {
        method: 'POST',
        path: `/api/hub/records/${encodeURIComponent(context.fixture.recordAId)}/values`,
        token: owner,
        body: {
          values: {
            [context.fixture.statusFieldId]: 'done',
          },
          mutation_context_project_id: context.fixture.primaryWorkProjectId,
        },
      };
    case 'POST /api/hub/records/:recordId/relations':
      return {
        method: 'POST',
        path: `/api/hub/records/${encodeURIComponent(context.fixture.recordAId)}/relations`,
        token: owner,
        body: {
          space_id: context.fixture.primarySpaceId,
          from_record_id: context.fixture.recordAId,
          to_record_id: context.fixture.recordBId,
          via_field_id: context.fixture.relationFieldId,
          mutation_context_project_id: context.fixture.primaryWorkProjectId,
        },
      };
    case 'DELETE /api/hub/relations/:relationId':
      return {
        method: 'DELETE',
        path: `/api/hub/relations/${encodeURIComponent(context.fixture.relationId)}?mutation_context_project_id=${encodeURIComponent(context.fixture.primaryWorkProjectId)}`,
        token: owner,
      };
    case 'GET /api/hub/spaces/:spaceId/mentions/search':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/mentions/search?q=${q}&limit=10`,
        token: owner,
      };
    case 'GET /api/hub/spaces/:spaceId/backlinks':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/backlinks?target_entity_type=record&target_entity_id=${encodeURIComponent(context.fixture.recordAId)}`,
        token: owner,
      };
    case 'POST /api/hub/spaces/:spaceId/events/from-nlp':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/events/from-nlp`,
        token: owner,
        body: {
          title: `Inventory Event ${context.runTag}`,
          start_dt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_dt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          timezone: 'America/New_York',
        },
      };
    case 'GET /api/hub/spaces/:spaceId/calendar':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/calendar?mode=relevant`,
        token: owner,
      };
    case 'GET /api/hub/calendar':
      return { method: 'GET', path: '/api/hub/calendar?mode=relevant', token: owner };
    case 'POST /api/hub/comments':
      return {
        method: 'POST',
        path: '/api/hub/comments',
        token: owner,
        body: {
          space_id: context.fixture.primarySpaceId,
          target_entity_type: 'record',
          target_entity_id: context.fixture.recordAId,
          body_json: {
            text: `Inventory extra comment ${context.runTag}`,
          },
        },
      };
    case 'POST /api/hub/comments/doc-anchor':
      return {
        method: 'POST',
        path: '/api/hub/comments/doc-anchor',
        token: owner,
        body: {
          project_id: context.fixture.primarySpaceId,
          doc_id: context.fixture.mainDocId,
          anchor_payload: {
            kind: 'node',
            nodeKey: `inventory-probe-node-${slug(context.runTag)}`,
          },
          body_json: {
            text: `Inventory extra doc comment ${context.runTag}`,
          },
        },
      };
    case 'GET /api/hub/comments':
      return {
        method: 'GET',
        path: `/api/hub/comments?project_id=${encodeURIComponent(context.fixture.primarySpaceId)}&doc_id=${encodeURIComponent(context.fixture.mainDocId)}`,
        token: owner,
      };
    case 'POST /api/hub/comments/:commentId/status':
      return {
        method: 'POST',
        path: `/api/hub/comments/${encodeURIComponent(context.fixture.commentId)}/status`,
        token: owner,
        body: {
          status: 'resolved',
        },
      };
    case 'POST /api/hub/mentions/materialize':
      return {
        method: 'POST',
        path: '/api/hub/mentions/materialize',
        token: owner,
        body: {
          project_id: context.fixture.primarySpaceId,
          source_entity_type: 'comment',
          source_entity_id: context.fixture.commentId,
          mentions: [
            {
              target_entity_type: 'record',
              target_entity_id: context.fixture.recordBId,
              context: {
                source: 'inventory',
              },
            },
          ],
        },
      };
    case 'GET /api/hub/spaces/:spaceId/timeline':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/timeline`, token: owner };
    case 'GET /api/hub/spaces/:spaceId/tasks':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/tasks?limit=10&source_project_id=${encodeURIComponent(context.fixture.primaryWorkProjectId)}`,
        token: owner,
      };
    case 'GET /api/hub/tasks':
      return { method: 'GET', path: '/api/hub/tasks?lens=assigned&limit=10', token: owner };
    case 'POST /api/hub/tasks':
      return {
        method: 'POST',
        path: '/api/hub/tasks',
        token: owner,
        body: {
          space_id: context.fixture.primarySpaceId,
          title: `Inventory extra task ${context.runTag}`,
          status: 'todo',
        },
      };
    case 'GET /api/hub/home':
      return { method: 'GET', path: '/api/hub/home?tasks_limit=6&events_limit=4&captures_limit=4&notifications_limit=4', token: owner };
    case 'POST /api/hub/attachments':
      return {
        method: 'POST',
        path: '/api/hub/attachments',
        token: owner,
        body: {
          space_id: context.fixture.primarySpaceId,
          entity_type: 'record',
          entity_id: context.fixture.recordAId,
          provider: 'nextcloud',
          asset_root_id: context.fixture.assetRootId,
          asset_path: `Uploads/${slug(context.runTag)}-extra.txt`,
          name: `${slug(context.runTag)}-extra.txt`,
          mime_type: 'text/plain',
          size_bytes: 5,
          mutation_context_project_id: context.fixture.primaryWorkProjectId,
          metadata: {},
        },
      };
    case 'DELETE /api/hub/attachments/:attachmentId':
      return {
        method: 'DELETE',
        path: `/api/hub/attachments/${encodeURIComponent(context.fixture.attachmentId)}?mutation_context_project_id=${encodeURIComponent(context.fixture.primaryWorkProjectId)}`,
        token: owner,
      };
    case 'GET /api/hub/spaces/:spaceId/automation-rules':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/automation-rules`, token: owner };
    case 'POST /api/hub/spaces/:spaceId/automation-rules':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/automation-rules`,
        token: owner,
        body: {
          name: `Inventory extra rule ${context.runTag}`,
          enabled: true,
          trigger_json: { type: 'manual' },
          actions_json: [],
        },
      };
    case 'PATCH /api/hub/automation-rules/:ruleId':
      return {
        method: 'PATCH',
        path: `/api/hub/automation-rules/${encodeURIComponent(context.fixture.automationRuleId)}`,
        token: owner,
        body: {
          name: `Inventory rule patched ${context.runTag}`,
          enabled: false,
        },
      };
    case 'DELETE /api/hub/automation-rules/:ruleId':
      return { method: 'DELETE', path: `/api/hub/automation-rules/${encodeURIComponent(context.fixture.automationRuleId)}`, token: owner };
    case 'GET /api/hub/spaces/:spaceId/automation-runs':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/automation-runs`, token: owner };
    case 'GET /api/hub/search':
      return { method: 'GET', path: `/api/hub/search?q=${q}&limit=10`, token: owner };
    case 'GET /api/hub/live/authorize':
      return { method: 'GET', path: '/api/hub/live/authorize', token: owner };
    case 'GET /api/hub/reminders':
      return {
        method: 'GET',
        path: `/api/hub/reminders?scope=project&space_id=${encodeURIComponent(context.fixture.primarySpaceId)}&project_id=${encodeURIComponent(context.fixture.primaryWorkProjectId)}`,
        token: owner,
      };
    case 'POST /api/hub/reminders':
      return {
        method: 'POST',
        path: '/api/hub/reminders',
        token: owner,
        body: {
          title: `Inventory extra reminder ${context.runTag}`,
          remind_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
      };
    case 'POST /api/hub/reminders/:reminderId/dismiss':
      return {
        method: 'POST',
        path: `/api/hub/reminders/${encodeURIComponent(context.fixture.reminderId)}/dismiss`,
        token: owner,
        body: {},
      };
    case 'PATCH /api/hub/reminders/:reminderId':
      return {
        method: 'PATCH',
        path: `/api/hub/reminders/${encodeURIComponent(context.fixture.reminderId)}`,
        token: owner,
        body: {
          remind_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        },
      };
    case 'GET /api/hub/spaces/:spaceId/asset-roots':
      return { method: 'GET', path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/asset-roots`, token: owner };
    case 'POST /api/hub/spaces/:spaceId/asset-roots':
      return {
        method: 'POST',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/asset-roots`,
        token: owner,
        body: {
          root_path: `/Inventory/${slug(context.runTag)}-extra`,
        },
      };
    case 'GET /api/hub/spaces/:spaceId/assets/list':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/assets/list?asset_root_id=${encodeURIComponent(context.fixture.assetRootId)}&path=${encodeURIComponent('Uploads')}`,
        token: owner,
      };
    case 'GET /api/hub/spaces/:spaceId/files':
      return {
        method: 'GET',
        path: `/api/hub/spaces/${encodeURIComponent(context.fixture.primarySpaceId)}/files?scope=project&project_id=${encodeURIComponent(context.fixture.primaryWorkProjectId)}`,
        token: owner,
      };
    case 'POST /api/hub/files/upload':
      return {
        method: 'POST',
        path: '/api/hub/files/upload',
        token: owner,
        body: {
          space_id: context.fixture.primarySpaceId,
          asset_root_id: context.fixture.assetRootId,
          name: `${slug(context.runTag)}.txt`,
          mime_type: 'text/plain',
          content_base64: Buffer.from(`inventory-${context.runTag}`).toString('base64'),
          path: 'Uploads',
          mutation_context_project_id: context.fixture.primaryWorkProjectId,
        },
      };
    case 'GET /api/hub/notifications':
      return { method: 'GET', path: '/api/hub/notifications?unread=1', token: member };
    case 'POST /api/hub/notifications/:notificationId/read':
      return {
        method: 'POST',
        path: `/api/hub/notifications/${encodeURIComponent(context.fixture.memberNotificationId || 'missing-notification')}/read`,
        token: member,
        body: {},
      };
    default:
      return null;
  }
};

const classifyProbeResult = ({ endpoint, result, serverRouteSignatures, probe }) => {
  const serverRoutePresent = serverRouteSignatures.has(endpoint.signature);
  if (result.networkError) {
    return {
      status: 'network_error',
      severity: 'fail',
      message: result.networkError,
      serverRoutePresent,
    };
  }

  const envelopeError = result.payload?.error || null;
  const errorCode = typeof envelopeError?.code === 'string' ? envelopeError.code : '';
  if (result.status >= 200 && result.status < 300) {
    return {
      status: 'ok',
      severity: 'pass',
      message: 'Successful response.',
      serverRoutePresent,
    };
  }
  if (result.status === 404 && !serverRoutePresent) {
    return {
      status: 'missing_server_route',
      severity: 'fail',
      message: 'Current client inventory references an API route that is not in the server snapshot.',
      serverRoutePresent,
    };
  }
  if (result.status === 404) {
    return {
      status: 'resource_missing',
      severity: 'warn',
      message: 'Route exists, but the resource was not found.',
      serverRoutePresent,
    };
  }
  if (result.status === 403) {
    return {
      status: 'permission_denied',
      severity: 'warn',
      message: 'Route exists, but the local fixture lacks the required permission path.',
      serverRoutePresent,
    };
  }
  if (result.status === 400) {
    return {
      status: 'invalid_input',
      severity: 'warn',
      message: 'Route exists, but the probe payload was rejected.',
      serverRoutePresent,
    };
  }
  if (result.status === 503 && errorCode === 'nextcloud_unavailable') {
    return {
      status: 'environment_unconfigured',
      severity: 'warn',
      message: 'Route depends on Nextcloud, which is not configured in the local secure stack.',
      serverRoutePresent,
    };
  }
  if (result.status >= 500) {
    return {
      status: 'server_error',
      severity: 'fail',
      message: `Server error ${result.status}.`,
      serverRoutePresent,
    };
  }
  if (!probe) {
    return {
      status: 'unresolved_probe',
      severity: 'fail',
      message: 'No probe builder is defined for this inventoried endpoint.',
      serverRoutePresent,
    };
  }
  return {
    status: 'unexpected_status',
    severity: 'warn',
    message: `Unexpected status ${result.status}.`,
    serverRoutePresent,
  };
};

const writeMarkdownSummary = async (summaryPath, report) => {
  const lines = [];
  lines.push('# Current Client API Inventory Report');
  lines.push('');
  lines.push(`- Run tag: \`${report.runTag}\``);
  lines.push(`- Base URL: \`${report.baseUrl}\``);
  lines.push(`- Generated: \`${report.generatedAt}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Inventoried endpoints: ${report.summary.total}`);
  lines.push(`- Passed: ${report.summary.pass}`);
  lines.push(`- Warned: ${report.summary.warn}`);
  lines.push(`- Failed: ${report.summary.fail}`);
  lines.push(`- Average latency: ${formatMs(report.summary.averageLatencyMs)}`);
  lines.push(`- Max latency: ${formatMs(report.summary.maxLatencyMs)}`);
  lines.push('');
  lines.push('## Endpoints');
  lines.push('');
  lines.push('| Endpoint | Status | HTTP | Latency | Sources | Note |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const result of report.results) {
    const httpCode = result.httpStatus === null ? 'network' : String(result.httpStatus);
    const note = `${result.classification}${result.serverRoutePresent ? '' : ' (missing from server snapshot)'}`;
    lines.push(`| ${result.key} | ${result.severity} | ${httpCode} | ${formatMs(result.durationMs)} | ${result.sources.join('<br>')} | ${note} |`);
  }
  lines.push('');
  await writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
};

const main = async () => {
  await loadEnvFilesIntoProcess(['.env.local', '.env'], { override: false });
  await loadEnvFilesIntoProcess(['.env.local.tokens.local'], { override: true });

  const baseUrl = String(process.env.HUB_API_BASE_URL || process.env.HUB_BASE_URL || 'http://127.0.0.1:3001').trim().replace(/\/+$/, '');
  const tokens = {
    owner: String(process.env[TOKEN_NAMES.owner] || '').trim(),
    member: String(process.env[TOKEN_NAMES.member] || '').trim(),
    collab: String(process.env[TOKEN_NAMES.collab] || '').trim(),
    outsider: String(process.env[TOKEN_NAMES.outsider] || '').trim(),
  };

  for (const [name, value] of Object.entries(tokens)) {
    if (!value) {
      throw new Error(`Missing ${TOKEN_NAMES[name]}. Run npm run dev:secure:tokens first.`);
    }
    assertFreshToken(TOKEN_NAMES[name], value);
  }

  const health = await requestHub({ baseUrl, method: 'GET', path: '/api/hub/health' });
  expectOkEnvelope(health, [200]);

  const inventory = await inventoryClientApiCalls();
  const serverRouteSignatures = await loadServerRouteSignatures();
  const runTag = `inventory-${Date.now().toString(36)}`;
  const fixture = await buildFixtureContext({ baseUrl, tokens, runTag });
  const context = { baseUrl, tokens, fixture, runTag };

  const results = [];
  for (const endpoint of inventory) {
    const probe = buildProbe(endpoint, context);
    const result = probe
      ? await requestHub({
          baseUrl,
          method: probe.method,
          path: probe.path,
          token: probe.token,
          body: probe.body,
        })
      : {
          ok: false,
          status: null,
          durationMs: 0,
          payload: null,
          networkError: 'No probe builder defined.',
        };

    const classification = classifyProbeResult({ endpoint, result, serverRouteSignatures, probe });
    results.push({
      key: endpoint.key,
      method: endpoint.method,
      path: endpoint.path,
      signature: endpoint.signature,
      sources: endpoint.sources,
      httpStatus: result.status,
      durationMs: result.durationMs,
      severity: classification.severity,
      classification: classification.status,
      message: classification.message,
      serverRoutePresent: classification.serverRoutePresent,
      errorCode: result.payload?.error?.code || null,
      errorMessage: result.payload?.error?.message || result.networkError || null,
    });
  }

  const totalLatency = results.reduce((sum, entry) => sum + entry.durationMs, 0);
  const summary = {
    total: results.length,
    pass: results.filter((entry) => entry.severity === 'pass').length,
    warn: results.filter((entry) => entry.severity === 'warn').length,
    fail: results.filter((entry) => entry.severity === 'fail').length,
    averageLatencyMs: results.length > 0 ? Number((totalLatency / results.length).toFixed(2)) : 0,
    maxLatencyMs: results.reduce((max, entry) => Math.max(max, entry.durationMs), 0),
  };

  ensureRepoDir('artifacts/perf');
  const outputBase = resolveRepoPath(`artifacts/perf/current-client-api-inventory-${runTag}`);
  const report = {
    runTag,
    baseUrl,
    generatedAt: new Date().toISOString(),
    summary,
    results,
  };

  await writeFile(`${outputBase}.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeMarkdownSummary(`${outputBase}.md`, report);

  console.log('Current client API inventory run complete');
  console.log(`Inventoried endpoints: ${summary.total}`);
  console.log(`Pass=${summary.pass} Warn=${summary.warn} Fail=${summary.fail}`);
  console.log(`Average latency=${formatMs(summary.averageLatencyMs)} Max latency=${formatMs(summary.maxLatencyMs)}`);
  console.log(`JSON: ${relative(repoRoot, `${outputBase}.json`)}`);
  console.log(`Markdown: ${relative(repoRoot, `${outputBase}.md`)}`);

  if (summary.fail > 0) {
    process.exitCode = 1;
  }
};

await main();
