/* global fetch */
import WebSocket from 'ws';

const apiBaseUrl = (process.env.HUB_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const collabWsUrl = (process.env.HUB_COLLAB_WS_URL || 'ws://127.0.0.1:1234').replace(/\/+$/, '');
const tokenA = (process.env.TOKEN_A || '').trim();
const tokenB = (process.env.TOKEN_B || '').trim();

const missing = [];
if (!tokenA) {
  missing.push('TOKEN_A');
}
if (!tokenB) {
  missing.push('TOKEN_B');
}

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const results = [];

const recordResult = (name, pass, detail) => {
  results.push({ name, pass, detail });
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${name} - ${detail}`);
};

const isErrorEnvelope = (payload) =>
  Boolean(
    payload
      && payload.ok === false
      && payload.data === null
      && payload.error
      && typeof payload.error.code === 'string'
      && typeof payload.error.message === 'string',
  );

const requestJson = async ({ method, path, token, body }) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    payload,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requireSuccess = (name, response, expectedStatus = 200) => {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expected.includes(response.status)) {
    recordResult(name, false, `expected status ${expected.join('|')}, got ${response.status}`);
    return null;
  }

  if (!response.payload || response.payload.ok !== true || response.payload.error !== null || response.payload.data === null) {
    recordResult(name, false, 'response is not a success envelope');
    return null;
  }

  recordResult(name, true, `status ${response.status}`);
  return response.payload.data;
};

const requireErrorEnvelope = (name, response, expectedStatus) => {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const statusOk = expected.includes(response.status);
  const envelopeOk = isErrorEnvelope(response.payload);
  const pass = statusOk && envelopeOk;
  recordResult(
    name,
    pass,
    `status=${response.status}; envelope=${envelopeOk ? 'ok' : 'invalid'}`,
  );
  return pass;
};

const isSuccessEnvelope = (response, expectedStatus = 200) => {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  return Boolean(
    expected.includes(response.status)
      && response.payload
      && response.payload.ok === true
      && response.payload.error === null
      && response.payload.data !== null,
  );
};

const waitForWsDenied = async ({ docId, wsTicket }) => {
  const target = `${collabWsUrl}/?doc_id=${encodeURIComponent(docId)}&ws_ticket=${encodeURIComponent(wsTicket)}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const ws = new WebSocket(target);

    const timer = setTimeout(() => {
      ws.terminate();
      finish(false);
    }, 4_000);

    ws.once('open', () => {
      clearTimeout(timer);
      ws.close();
      finish(false);
    });

    ws.once('unexpected-response', (_request, response) => {
      clearTimeout(timer);
      finish(response.statusCode === 401 || response.statusCode === 403);
    });

    ws.once('close', () => {
      clearTimeout(timer);
      finish(false);
    });

    ws.once('error', () => {
      clearTimeout(timer);
      finish(false);
    });
  });
};

const requestCollabAuthorization = async ({ docId, token }) =>
  requestJson({
    method: 'GET',
    path: `/api/hub/collab/authorize?doc_id=${encodeURIComponent(docId)}`,
    token,
  });

const tamperToken = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[2].length === 0) {
    return `${token}x`;
  }
  const signature = parts[2];
  const first = signature[0];
  const replacement = first === 'a' ? 'b' : 'a';
  parts[2] = `${replacement}${signature.slice(1)}`;
  return parts.join('.');
};

let failed = false;

const run = async () => {
  const tampered = tamperToken(tokenA);
  const tamperedMe = await requestJson({ method: 'GET', path: '/api/hub/me', token: tampered });
  const tamperedPass = requireErrorEnvelope('1. JWT verification rejects tampered token', tamperedMe, 401);
  if (!tamperedPass) {
    failed = true;
  }

  const meAResponse = await requestJson({ method: 'GET', path: '/api/hub/me', token: tokenA });
  const meA = requireSuccess('Bootstrap A identity', meAResponse, 200);
  if (!meA) {
    failed = true;
    return;
  }

  const meBResponse = await requestJson({ method: 'GET', path: '/api/hub/me', token: tokenB });
  const meB = requireSuccess('Bootstrap B identity', meBResponse, 200);
  if (!meB) {
    failed = true;
    return;
  }

  const createProjectResponse = await requestJson({
    method: 'POST',
    path: '/api/hub/projects',
    token: tokenA,
    body: {
      name: `Contract Smoke ${Date.now()}`,
    },
  });
  const createdProject = requireSuccess('2. Project member can create project', createProjectResponse, 201);
  if (!createdProject?.project?.project_id) {
    failed = true;
    return;
  }
  const projectId = createdProject.project.project_id;

  const addMemberResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/members`,
    token: tokenA,
    body: {
      user_id: meB.user.user_id,
      role: 'member',
    },
  });
  if (!requireSuccess('Bootstrap B project membership', addMemberResponse, 200)) {
    failed = true;
    return;
  }

  const createPaneByBResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    token: tokenB,
    body: {
      name: 'B Project Pane',
      member_user_ids: [meB.user.user_id],
    },
  });
  if (!requireSuccess('3. Project member can create pane', createPaneByBResponse, 201)) {
    failed = true;
    return;
  }

  const listPanesAResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    token: tokenA,
  });
  const panesA = requireSuccess('Bootstrap pane list (A)', listPanesAResponse, 200);
  if (!panesA?.panes || !Array.isArray(panesA.panes) || panesA.panes.length === 0) {
    failed = true;
    return;
  }

  let targetPane = panesA.panes.find((pane) => !pane.members.some((member) => member.user_id === meB.user.user_id));

  if (!targetPane) {
    const createAOnlyPaneResponse = await requestJson({
      method: 'POST',
      path: `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
      token: tokenA,
      body: {
        name: 'A Only Pane',
        member_user_ids: [meA.user.user_id],
      },
    });
    const created = requireSuccess('Bootstrap A-only pane', createAOnlyPaneResponse, 201);
    if (!created?.pane) {
      failed = true;
      return;
    }
    targetPane = created.pane;
  }

  const deniedDocResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/docs/${encodeURIComponent(targetPane.doc_id)}`,
    token: tokenB,
  });
  const deniedDocPass = requireErrorEnvelope('4. Non-pane-member cannot access doc snapshot', deniedDocResponse, 403);
  if (!deniedDocPass) {
    failed = true;
  }

  const deniedCollabAuth = await requestCollabAuthorization({ docId: targetPane.doc_id, token: tokenB });
  const deniedCollabAuthPass = requireErrorEnvelope(
    '5a. Non-pane-member cannot obtain collab ticket',
    deniedCollabAuth,
    403,
  );
  const forgedTicket = `wst_forged_${Date.now()}`;
  const wsDenied = await waitForWsDenied({ docId: targetPane.doc_id, wsTicket: forgedTicket });
  recordResult('5b. Non-pane-member cannot join collab room', wsDenied, wsDenied ? 'join denied' : 'unexpected room join');
  if (!deniedCollabAuthPass || !wsDenied) {
    failed = true;
  }

  const createCollectionResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/collections`,
    token: tokenA,
    body: {
      name: 'Tasks',
    },
  });
  const createdCollection = requireSuccess('Bootstrap tasks collection', createCollectionResponse, 201);
  if (!createdCollection?.collection_id) {
    failed = true;
    return;
  }

  const createStatusFieldResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/collections/${encodeURIComponent(createdCollection.collection_id)}/fields`,
    token: tokenA,
    body: {
      name: 'Status',
      type: 'select',
      config: { options: ['todo', 'done'] },
      sort_order: 1,
    },
  });
  if (!requireSuccess('Bootstrap status field', createStatusFieldResponse, 201)) {
    failed = true;
    return;
  }

  const createRelationFieldResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/collections/${encodeURIComponent(createdCollection.collection_id)}/fields`,
    token: tokenA,
    body: {
      name: 'Related Tasks',
      type: 'relation',
      config: { target_collection_id: createdCollection.collection_id },
      sort_order: 2,
    },
  });
  const createdRelationField = requireSuccess('Bootstrap relation field', createRelationFieldResponse, 201);
  if (!createdRelationField?.field_id) {
    failed = true;
    return;
  }

  const createViewResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/views`,
    token: tokenA,
    body: {
      collection_id: createdCollection.collection_id,
      type: 'table',
      name: 'Tasks Table',
      config: {},
    },
  });
  const createdView = requireSuccess('Bootstrap table view', createViewResponse, 201);
  if (!createdView?.view_id) {
    failed = true;
    return;
  }

  const createRecordResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/records`,
    token: tokenA,
    body: {
      collection_id: createdCollection.collection_id,
      title: 'Project scoped record',
      capability_types: ['task'],
      task_state: { status: 'todo' },
    },
  });
  const createdRecord = requireSuccess('Bootstrap project-scoped record', createRecordResponse, 201);
  if (!createdRecord?.record_id) {
    failed = true;
    return;
  }
  const recordId = createdRecord.record_id;

  const createRelatedRecordResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/records`,
    token: tokenA,
    body: {
      collection_id: createdCollection.collection_id,
      title: 'Related project record',
    },
  });
  const relatedRecord = requireSuccess('6a. Create relation target record', createRelatedRecordResponse, 201);
  if (!relatedRecord?.record_id) {
    failed = true;
    return;
  }
  const relatedRecordId = relatedRecord.record_id;

  const relationSearchResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/records/search?query=Related&collection_id=${encodeURIComponent(createdCollection.collection_id)}&exclude_record_id=${encodeURIComponent(recordId)}`,
    token: tokenA,
  });
  const relationSearchData = requireSuccess('6b. Relation candidate search returns records', relationSearchResponse, 200);
  const relationSearchHasTarget = Boolean(relationSearchData?.items?.some((item) => item.record_id === relatedRecordId));
  recordResult('6c. Relation search includes target record', relationSearchHasTarget, `record_id=${relatedRecordId}`);
  if (!relationSearchHasTarget) {
    failed = true;
  }

  const addRelationResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/records/${encodeURIComponent(recordId)}/relations`,
    token: tokenA,
    body: {
      project_id: projectId,
      from_record_id: recordId,
      to_record_id: relatedRecordId,
      via_field_id: createdRelationField.field_id,
    },
  });
  const createdRelation = requireSuccess('6d. Add record relation', addRelationResponse, 201);
  const relationId = createdRelation?.relation?.relation_id || null;
  if (!relationId) {
    failed = true;
    return;
  }

  const recordDetailAResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/records/${encodeURIComponent(recordId)}`,
    token: tokenA,
  });
  const recordDetailA = requireSuccess('6e. Fetch source record detail with relations', recordDetailAResponse, 200);
  const outgoingHasRelation = Boolean(
    recordDetailA?.record?.relations?.outgoing?.some(
      (relation) =>
        relation.relation_id === relationId
        && relation.to_record_id === relatedRecordId
        && relation.via_field_id === createdRelationField.field_id,
    ),
  );
  recordResult('6f. Source record includes outgoing relation edge', outgoingHasRelation, `relation_id=${relationId}`);
  if (!outgoingHasRelation) {
    failed = true;
  }

  const recordDetailBResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/records/${encodeURIComponent(relatedRecordId)}`,
    token: tokenA,
  });
  const recordDetailB = requireSuccess('6g. Fetch target record detail with relations', recordDetailBResponse, 200);
  const incomingHasRelation = Boolean(
    recordDetailB?.record?.relations?.incoming?.some(
      (relation) =>
        relation.relation_id === relationId
        && relation.from_record_id === recordId
        && relation.via_field_id === createdRelationField.field_id,
    ),
  );
  recordResult('6h. Target record includes incoming relation edge', incomingHasRelation, `relation_id=${relationId}`);
  if (!incomingHasRelation) {
    failed = true;
  }

  const removeRelationResponse = await requestJson({
    method: 'DELETE',
    path: `/api/hub/relations/${encodeURIComponent(relationId)}?project_id=${encodeURIComponent(projectId)}`,
    token: tokenA,
  });
  if (!requireSuccess('6i. Remove relation', removeRelationResponse, 200)) {
    failed = true;
    return;
  }

  const recordDetailAfterRemoveAResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/records/${encodeURIComponent(recordId)}`,
    token: tokenA,
  });
  const recordDetailAfterRemoveA = requireSuccess('6j. Source record detail updates after relation removal', recordDetailAfterRemoveAResponse, 200);
  const outgoingStillHasRelation = Boolean(
    recordDetailAfterRemoveA?.record?.relations?.outgoing?.some((relation) => relation.relation_id === relationId),
  );
  recordResult('6k. Source record no longer includes removed outgoing relation', !outgoingStillHasRelation, `relation_id=${relationId}`);
  if (outgoingStillHasRelation) {
    failed = true;
  }

  const recordDetailAfterRemoveBResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/records/${encodeURIComponent(relatedRecordId)}`,
    token: tokenA,
  });
  const recordDetailAfterRemoveB = requireSuccess('6l. Target record detail updates after relation removal', recordDetailAfterRemoveBResponse, 200);
  const incomingStillHasRelation = Boolean(
    recordDetailAfterRemoveB?.record?.relations?.incoming?.some((relation) => relation.relation_id === relationId),
  );
  recordResult('6m. Target record no longer includes removed incoming relation', !incomingStillHasRelation, `relation_id=${relationId}`);
  if (incomingStillHasRelation) {
    failed = true;
  }

  const bViewQueryResponse = await requestJson({
    method: 'POST',
    path: '/api/hub/views/query',
    token: tokenB,
    body: {
      view_id: createdView.view_id,
      pagination: { limit: 25 },
    },
  });
  const bViewQuery = requireSuccess('6. Non-pane-member CAN access project records', bViewQueryResponse, 200);
  if (!bViewQuery?.records || !Array.isArray(bViewQuery.records) || bViewQuery.records.length === 0) {
    recordResult('6. Non-pane-member CAN access project records', false, 'query succeeded but no records returned');
    failed = true;
  }

  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 90 * 60 * 1000).toISOString();
  const createEventResponse = await requestJson({
    method: 'POST',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/events/from-nlp`,
    token: tokenA,
    body: {
      nlp_fields_json: {
        title: 'A-only event',
        start_dt: start,
        end_dt: end,
      },
      participants_user_ids: [meA.user.user_id],
    },
  });
  const createdEvent = requireSuccess('Bootstrap A-only event', createEventResponse, 201);
  if (!createdEvent?.record?.record_id) {
    failed = true;
    return;
  }

  const calendarARelevant = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/calendar?mode=relevant`,
    token: tokenA,
  });
  const calendarAAll = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/calendar?mode=all`,
    token: tokenA,
  });
  const calendarBRelevant = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/calendar?mode=relevant`,
    token: tokenB,
  });
  const calendarBAll = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/calendar?mode=all`,
    token: tokenB,
  });

  const aRelevantData = requireSuccess('7a. A sees event in relevant', calendarARelevant, 200);
  const aAllData = requireSuccess('7b. A sees event in all', calendarAAll, 200);
  const bRelevantData = requireSuccess('7c. B relevant query allowed', calendarBRelevant, 200);
  const bAllData = requireSuccess('7d. B all query allowed', calendarBAll, 200);

  const eventRecordId = createdEvent.record.record_id;

  const aRelevantHas = Boolean(aRelevantData?.events?.some((event) => event.record_id === eventRecordId));
  const aAllHas = Boolean(aAllData?.events?.some((event) => event.record_id === eventRecordId));
  const bRelevantHas = Boolean(bRelevantData?.events?.some((event) => event.record_id === eventRecordId));
  const bAllHas = Boolean(bAllData?.events?.some((event) => event.record_id === eventRecordId));

  recordResult('7e. A relevant includes A-only participant event', aRelevantHas, `event_id=${eventRecordId}`);
  recordResult('7f. A all includes A-only participant event', aAllHas, `event_id=${eventRecordId}`);
  recordResult('7g. B relevant excludes A-only participant event', !bRelevantHas, `event_id=${eventRecordId}`);
  recordResult('7h. B all includes A-only participant event', bAllHas, `event_id=${eventRecordId}`);

  if (!aRelevantHas || !aAllHas || bRelevantHas || !bAllHas) {
    failed = true;
  }

  const envelopeCasePass = isErrorEnvelope(tamperedMe.payload) && isErrorEnvelope(deniedDocResponse.payload);
  recordResult('8. Envelope correctness on failures', envelopeCasePass, 'checked tampered-token and denied-doc responses');
  if (!envelopeCasePass) {
    failed = true;
  }

  const nodeA = `node-a-${Date.now()}`;
  const nodeB = `node-b-${Date.now()}`;
  const docId = targetPane.doc_id;
  const putInitialDoc = await requestJson({
    method: 'PUT',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenA,
    body: {
      snapshot_payload: {
        lexical_state: {
          root: {
            type: 'root',
            key: 'root',
            children: [
              { type: 'paragraph', key: nodeA, children: [] },
              { type: 'paragraph', key: nodeB, children: [] },
            ],
          },
        },
        node_keys: [nodeA, nodeB],
      },
    },
  });
  if (!requireSuccess('9a. Seed doc node keys for node-anchor test', putInitialDoc, 200)) {
    failed = true;
    return;
  }

  const createNodeCommentResponse = await requestJson({
    method: 'POST',
    path: '/api/hub/comments/doc-anchor',
    token: tokenA,
    body: {
      project_id: projectId,
      doc_id: docId,
      anchor_payload: {
        kind: 'node',
        nodeKey: nodeA,
      },
      body_json: {
        text: 'Node anchored comment',
      },
    },
  });
  const createdNodeComment = requireSuccess('9b. Create node-anchored doc comment', createNodeCommentResponse, 201);
  if (!createdNodeComment?.comment_id) {
    failed = true;
    return;
  }
  const nodeCommentId = createdNodeComment.comment_id;

  const listAfterCreate = await requestJson({
    method: 'GET',
    path: `/api/hub/comments?project_id=${encodeURIComponent(projectId)}&doc_id=${encodeURIComponent(docId)}`,
    token: tokenA,
  });
  const createdListData = requireSuccess('9c. List doc comments includes anchor payload', listAfterCreate, 200);
  const createdAnchorComment = createdListData?.comments?.find((comment) => comment.comment_id === nodeCommentId);
  const anchoredShapePass = Boolean(
    createdAnchorComment
      && createdAnchorComment.anchor_payload?.kind === 'node'
      && createdAnchorComment.anchor_payload?.nodeKey === nodeA,
  );
  recordResult('9d. Node comment anchor payload is node-key anchored', anchoredShapePass, `comment_id=${nodeCommentId}`);
  if (!anchoredShapePass) {
    failed = true;
  }

  const putMovedDoc = await requestJson({
    method: 'PUT',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenA,
    body: {
      snapshot_payload: {
        lexical_state: {
          root: {
            type: 'root',
            key: 'root',
            children: [
              { type: 'paragraph', key: nodeB, children: [] },
              { type: 'paragraph', key: nodeA, children: [] },
            ],
          },
        },
        node_keys: [nodeB, nodeA],
      },
    },
  });
  if (!requireSuccess('9e. Move node order while preserving node keys', putMovedDoc, 200)) {
    failed = true;
    return;
  }

  const listAfterMove = await requestJson({
    method: 'GET',
    path: `/api/hub/comments?project_id=${encodeURIComponent(projectId)}&doc_id=${encodeURIComponent(docId)}`,
    token: tokenA,
  });
  const moveData = requireSuccess('9f. List doc comments after node move', listAfterMove, 200);
  const movedComment = moveData?.comments?.find((comment) => comment.comment_id === nodeCommentId);
  const survivesMove = Boolean(movedComment && movedComment.anchor_payload?.nodeKey === nodeA && movedComment.is_orphaned === false);
  recordResult('9g. Node-anchored comment survives move', survivesMove, `comment_id=${nodeCommentId}`);
  if (!survivesMove) {
    failed = true;
  }

  const putDeletedNodeDoc = await requestJson({
    method: 'PUT',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenA,
    body: {
      snapshot_payload: {
        lexical_state: {
          root: {
            type: 'root',
            key: 'root',
            children: [{ type: 'paragraph', key: nodeB, children: [] }],
          },
        },
        node_keys: [nodeB],
      },
    },
  });
  if (!requireSuccess('10a. Delete anchored node from doc snapshot', putDeletedNodeDoc, 200)) {
    failed = true;
    return;
  }

  const listAfterDelete = await requestJson({
    method: 'GET',
    path: `/api/hub/comments?project_id=${encodeURIComponent(projectId)}&doc_id=${encodeURIComponent(docId)}`,
    token: tokenA,
  });
  const orphanData = requireSuccess('10b. List doc comments after node delete', listAfterDelete, 200);
  const orphanedFound = Boolean(orphanData?.orphaned_comments?.some((comment) => comment.comment_id === nodeCommentId && comment.is_orphaned === true));
  recordResult('10c. Deleted node comment is retrievable as orphaned', orphanedFound, `comment_id=${nodeCommentId}`);
  if (!orphanedFound) {
    failed = true;
  }

  const commentMentionResponse = await requestJson({
    method: 'POST',
    path: '/api/hub/comments',
    token: tokenA,
    body: {
      project_id: projectId,
      target_entity_type: 'record',
      target_entity_id: recordId,
      body_json: {
        text: `Mentioning @[${meB.user.display_name || 'User B'}](user:${meB.user.user_id})`,
      },
      mentions: [
        {
          target_entity_type: 'user',
          target_entity_id: meB.user.user_id,
          context: {
            source: 'smoke-test',
          },
        },
      ],
    },
  });
  const createdMentionComment = requireSuccess('11a. Create comment with user mention', commentMentionResponse, 201);
  if (!createdMentionComment?.comment_id) {
    failed = true;
    return;
  }

  const unauthorizedCommentMutation = await requestJson({
    method: 'POST',
    path: '/api/hub/mentions/materialize',
    token: tokenB,
    body: {
      project_id: projectId,
      source_entity_type: 'comment',
      source_entity_id: createdMentionComment.comment_id,
      replace_source: true,
      mentions: [
        {
          target_entity_type: 'user',
          target_entity_id: meA.user.user_id,
          context: { source: 'unauthorized-check' },
        },
      ],
    },
  });
  const unauthorizedCommentMutationPass = requireErrorEnvelope(
    '11a2. Non-author cannot materialize mentions for another user comment source',
    unauthorizedCommentMutation,
    403,
  );
  if (!unauthorizedCommentMutationPass) {
    failed = true;
  }

  let mentionNotificationFound = false;
  let latestNotificationListB;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    latestNotificationListB = await requestJson({
      method: 'GET',
      path: '/api/hub/notifications?unread=1',
      token: tokenB,
    });
    if (isSuccessEnvelope(latestNotificationListB, 200)) {
      mentionNotificationFound = Boolean(
        latestNotificationListB.payload.data.notifications?.some(
          (notification) =>
            notification.reason === 'mention'
            && notification.entity_type === 'comment'
            && notification.entity_id === createdMentionComment.comment_id,
        ),
      );
    }
    if (mentionNotificationFound) {
      break;
    }
    await sleep(250);
  }
  const notificationDataB = requireSuccess('11b. List notifications for mentioned user', latestNotificationListB, 200);
  if (!notificationDataB) {
    failed = true;
    return;
  }
  recordResult('11c. Mentioned user receives mention notification', mentionNotificationFound, `comment_id=${createdMentionComment.comment_id}`);
  if (!mentionNotificationFound) {
    failed = true;
  }

  const docMentionNode = `node-mention-${Date.now()}`;
  const putDocWithMention = await requestJson({
    method: 'PUT',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenA,
    body: {
      snapshot_payload: {
        lexical_state: {
          root: {
            type: 'root',
            key: 'root',
            children: [
              {
                type: 'paragraph',
                key: docMentionNode,
                children: [
                  {
                    type: 'text',
                    key: `text-${Date.now()}`,
                    text: `Link @[Record](record:${recordId})`,
                  },
                ],
              },
            ],
          },
        },
        node_keys: [docMentionNode],
      },
    },
  });
  if (!requireSuccess('12a. Save doc snapshot containing record mention', putDocWithMention, 200)) {
    failed = true;
    return;
  }

  const materializeDocMention = await requestJson({
    method: 'POST',
    path: '/api/hub/mentions/materialize',
    token: tokenA,
    body: {
      project_id: projectId,
      source_entity_type: 'doc',
      source_entity_id: docId,
      replace_source: true,
      mentions: [
        {
          target_entity_type: 'record',
          target_entity_id: recordId,
          context: {
            source: 'doc',
            nodeKey: docMentionNode,
            snippet: 'Link Record',
          },
        },
      ],
    },
  });
  if (!requireSuccess('12b. Materialize record mention from doc source', materializeDocMention, 200)) {
    failed = true;
    return;
  }

  let recordDocBacklinkFound = false;
  let latestBacklinksResponse;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    latestBacklinksResponse = await requestJson({
      method: 'GET',
      path: `/api/hub/projects/${encodeURIComponent(projectId)}/backlinks?target_entity_type=record&target_entity_id=${encodeURIComponent(recordId)}`,
      token: tokenA,
    });
    if (isSuccessEnvelope(latestBacklinksResponse, 200)) {
      recordDocBacklinkFound = Boolean(
        latestBacklinksResponse.payload.data.backlinks?.some(
          (entry) =>
            entry.source_entity_type === 'doc'
            && entry.source_entity_id === docId
            && entry.source?.node_key === docMentionNode,
        ),
      );
    }
    if (recordDocBacklinkFound) {
      break;
    }
    await sleep(250);
  }
  const backlinksData = requireSuccess('12c. Query backlinks for mentioned record', latestBacklinksResponse, 200);
  if (!backlinksData) {
    failed = true;
    return;
  }
  recordResult('12d. Backlinks include doc mention edge', recordDocBacklinkFound, `record_id=${recordId}`);
  if (!recordDocBacklinkFound) {
    failed = true;
  }

  const createDocSourceComment = await requestJson({
    method: 'POST',
    path: '/api/hub/comments',
    token: tokenA,
    body: {
      project_id: projectId,
      target_entity_type: 'doc',
      target_entity_id: docId,
      body_json: {
        text: 'Doc source comment for mention gate check',
      },
    },
  });
  const docSourceComment = requireSuccess('12e. Create doc-targeted comment source', createDocSourceComment, 201);
  if (!docSourceComment?.comment_id) {
    failed = true;
    return;
  }

  const materializeDocCommentByA = await requestJson({
    method: 'POST',
    path: '/api/hub/mentions/materialize',
    token: tokenA,
    body: {
      project_id: projectId,
      source_entity_type: 'comment',
      source_entity_id: docSourceComment.comment_id,
      replace_source: true,
      mentions: [
        {
          target_entity_type: 'record',
          target_entity_id: recordId,
          context: {
            source: 'comment',
            snippet: 'Doc comment mention',
          },
        },
      ],
    },
  });
  if (!requireSuccess('12f. Pane member can materialize mention from doc-targeted comment source', materializeDocCommentByA, 200)) {
    failed = true;
    return;
  }

  const backlinksByB = await requestJson({
    method: 'GET',
    path: `/api/hub/projects/${encodeURIComponent(projectId)}/backlinks?target_entity_type=record&target_entity_id=${encodeURIComponent(recordId)}`,
    token: tokenB,
  });
  const backlinksDataByB = requireSuccess('12g. Non-pane-member backlinks query remains project-visible', backlinksByB, 200);
  const backlinksLeakDocOrCommentDoc = Boolean(
    backlinksDataByB?.backlinks?.some(
      (entry) =>
        (entry.source_entity_type === 'doc' && entry.source_entity_id === docId)
        || (entry.source_entity_type === 'comment' && entry.source_entity_id === docSourceComment.comment_id),
    ),
  );
  recordResult(
    '12h. Non-pane-member backlinks exclude doc and doc-comment sources',
    !backlinksLeakDocOrCommentDoc,
    `doc_id=${docId}; comment_id=${docSourceComment.comment_id}`,
  );
  if (backlinksLeakDocOrCommentDoc) {
    failed = true;
  }

  const materializeDocCommentByB = await requestJson({
    method: 'POST',
    path: '/api/hub/mentions/materialize',
    token: tokenB,
    body: {
      project_id: projectId,
      source_entity_type: 'comment',
      source_entity_id: docSourceComment.comment_id,
      replace_source: true,
      mentions: [
        {
          target_entity_type: 'record',
          target_entity_id: recordId,
          context: {
            source: 'comment',
            snippet: 'Unauthorized mention write',
          },
        },
      ],
    },
  });
  const materializeDocCommentByBDenied = requireErrorEnvelope(
    '12i. Non-pane-member cannot materialize mentions from doc-targeted comment source',
    materializeDocCommentByB,
    403,
  );
  if (!materializeDocCommentByBDenied) {
    failed = true;
  }

  const viewRefNodeKey = `view-ref-${Date.now()}`;
  const putDocWithViewRef = await requestJson({
    method: 'PUT',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenA,
    body: {
      snapshot_payload: {
        lexical_state: {
          root: {
            type: 'root',
            key: 'root',
            children: [
              {
                type: 'view-ref',
                key: viewRefNodeKey,
                version: 1,
                view_id: createdView.view_id,
                sizing: 'compact',
              },
            ],
          },
        },
        node_keys: [viewRefNodeKey],
      },
    },
  });
  if (!requireSuccess('13a. Save doc snapshot with ViewRef node', putDocWithViewRef, 200)) {
    failed = true;
    return;
  }

  const docWithViewRefResponse = await requestJson({
    method: 'GET',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenA,
  });
  const docWithViewRef = requireSuccess('13b. Pane member can read doc snapshot with ViewRef', docWithViewRefResponse, 200);
  const hasViewRefNode = Boolean(
    docWithViewRef?.doc?.snapshot_payload?.lexical_state?.root?.children?.some((node) => node.type === 'view-ref'),
  );
  recordResult('13c. ViewRef node persists in doc snapshot', hasViewRefNode, `view_id=${createdView.view_id}`);
  if (!hasViewRefNode) {
    failed = true;
  }

  const queryViewForEmbed = await requestJson({
    method: 'POST',
    path: '/api/hub/views/query',
    token: tokenA,
    body: {
      view_id: createdView.view_id,
      pagination: { limit: 10 },
    },
  });
  const embedQueryData = requireSuccess('13d. Embedded view query succeeds for pane member', queryViewForEmbed, 200);
  const embedViewMatches = Boolean(embedQueryData?.view?.view_id === createdView.view_id);
  recordResult('13e. Embedded view response matches inserted ViewRef', embedViewMatches, `view_id=${createdView.view_id}`);
  if (!embedViewMatches) {
    failed = true;
  }

  const deniedDocViewRef = await requestJson({
    method: 'GET',
    path: `/api/hub/docs/${encodeURIComponent(docId)}`,
    token: tokenB,
  });
  const viewRefDocGatePass = requireErrorEnvelope('13f. Non-pane-member remains blocked from ViewRef doc snapshot', deniedDocViewRef, 403);
  if (!viewRefDocGatePass) {
    failed = true;
  }
};

await run();

const passCount = results.filter((entry) => entry.pass).length;
const failCount = results.length - passCount;
console.log(`Summary: pass=${passCount} fail=${failCount}`);

if (failed || failCount > 0) {
  process.exit(1);
}
