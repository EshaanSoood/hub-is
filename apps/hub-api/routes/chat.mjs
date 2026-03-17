import { randomBytes } from 'node:crypto';

const MATRIX_REQUEST_TIMEOUT_MS = 15_000;
const MATRIX_DEVICE_DISPLAY_NAME = 'eshaan-os hub';
const MATRIX_PASSWORD_RESET_REQUIRED = '__MATRIX_PASSWORD_RESET_REQUIRED__';

const sanitizeMatrixLocalpart = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._=/-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'user';
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isUniqueConstraintError = (error) => {
  const message = String(error instanceof Error ? error.message : error || '');
  return message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT');
};

export const createChatRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    asInteger,
    parseCursorOffset,
    encodeCursorOffset,
    newId,
    nowIso,
    normalizeProjectRole,
    projectMembershipRoleStmt,
    projectMembersByProjectStmt,
    createNotification,
    buildNotificationPayload,
    safeTuwunelConfig,
    encryptMatrixAccountSecret,
    decryptMatrixAccountSecret,
    TUWUNEL_INTERNAL_URL,
    TUWUNEL_REGISTRATION_SHARED_SECRET,
    MATRIX_HOMESERVER_URL,
    MATRIX_SERVER_NAME,
    matrixAccountByUserIdStmt,
    insertMatrixAccountStmt,
    updateMatrixAccountCredentialsStmt,
    updateMatrixAccountDeviceStmt,
    deleteMatrixAccountStmt,
    insertChatSnapshotStmt,
    chatSnapshotByIdStmt,
    chatSnapshotsPageStmt,
    deleteChatSnapshotStmt,
  } = deps;

  const requireProjectMembership = ({ projectId, userId }) => {
    const membership = projectMembershipRoleStmt.get(projectId, userId);
    if (!membership) {
      return {
        error: {
          status: 403,
          code: 'forbidden',
          message: 'Project membership required.',
        },
      };
    }

    return {
      role: normalizeProjectRole(membership.role),
    };
  };

  const matrixDeviceId = () => `HUB${randomBytes(10).toString('hex').toUpperCase()}`;

  const postMatrixJson = async (pathname, payload) => {
    const upstream = await fetch(new URL(pathname, TUWUNEL_INTERNAL_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(MATRIX_REQUEST_TIMEOUT_MS),
    });
    const body = await parseJsonSafe(upstream);
    return { upstream, body };
  };

  const provision = withPolicyGate('hub.chat.provision', async ({ response, auth }) => {
    if (!safeTuwunelConfig()) {
      send(response, jsonResponse(503, errorEnvelope('matrix_unavailable', 'Matrix runtime credentials are not configured.')));
      return;
    }

    let account = matrixAccountByUserIdStmt.get(auth.user.user_id);
    if (!account) {
      const matrixLocalpart = sanitizeMatrixLocalpart(auth.user.user_id);
      const matrixUserId = `@${matrixLocalpart}:${MATRIX_SERVER_NAME}`;
      const password = randomBytes(32).toString('hex');
      let reservedAccount = false;

      try {
        insertMatrixAccountStmt.run(
          auth.user.user_id,
          matrixUserId,
          null,
          MATRIX_PASSWORD_RESET_REQUIRED,
        );
        reservedAccount = true;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          console.error('chat.mjs provision failed to reserve Matrix account link', {
            userId: auth.user.user_id,
            matrixUserId,
            error,
          });
          send(response, jsonResponse(500, errorEnvelope('server_error', 'Matrix account link could not be reserved.')));
          return;
        }
        account = matrixAccountByUserIdStmt.get(auth.user.user_id);
      }

      if (reservedAccount) {
        let registration;
        try {
          registration = await postMatrixJson('/_matrix/client/v3/register', {
            username: matrixLocalpart,
            password,
            inhibit_login: true,
            auth: {
              type: 'm.login.registration_token',
              token: TUWUNEL_REGISTRATION_SHARED_SECRET,
            },
          });
        } catch {
          deleteMatrixAccountStmt.run(auth.user.user_id);
          send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Matrix registration request failed.')));
          return;
        }

        if (!registration.upstream.ok) {
          deleteMatrixAccountStmt.run(auth.user.user_id);
          const errcode = asText(registration.body?.errcode);
          const upstreamMessage = asText(registration.body?.error);
          if (errcode === 'M_USER_IN_USE') {
            send(response, jsonResponse(409, errorEnvelope('matrix_account_conflict', 'Matrix account already exists but is not linked in hub-api.')));
            return;
          }
          send(
            response,
            jsonResponse(
              502,
              errorEnvelope(
                'upstream_error',
                upstreamMessage || `Matrix registration failed (${registration.upstream.status}).`,
              ),
            ),
          );
          return;
        }

        const encryptedPassword = encryptMatrixAccountSecret(password);
        try {
          const updateResult = updateMatrixAccountCredentialsStmt.run(
            encryptedPassword,
            auth.user.user_id,
          );
          if (Number(updateResult?.changes) < 1) {
            insertMatrixAccountStmt.run(
              auth.user.user_id,
              matrixUserId,
              null,
              encryptedPassword,
            );
          }
          account = matrixAccountByUserIdStmt.get(auth.user.user_id);
        } catch (error) {
          const persistedAccount = matrixAccountByUserIdStmt.get(auth.user.user_id);
          const persistedEncryptedPassword = asText(persistedAccount?.matrix_password_encrypted);
          if (
            asText(persistedAccount?.matrix_user_id) === matrixUserId
            && persistedEncryptedPassword
            && persistedEncryptedPassword !== MATRIX_PASSWORD_RESET_REQUIRED
          ) {
            account = persistedAccount;
          } else {
            try {
              deleteMatrixAccountStmt.run(auth.user.user_id);
            } catch (cleanupError) {
              console.error('chat.mjs provision failed to clean up Matrix reservation after persistence failure', {
                userId: auth.user.user_id,
                matrixUserId,
                error: cleanupError,
              });
            }
            console.error('chat.mjs provision failed to persist Matrix credentials after registration', {
              userId: auth.user.user_id,
              matrixUserId,
              error,
            });
            send(response, jsonResponse(500, errorEnvelope('server_error', 'Matrix account credentials could not be persisted.')));
            return;
          }
        }
      }
    }

    const matrixUserId = asText(account?.matrix_user_id);
    const encryptedPassword = asText(account?.matrix_password_encrypted);
    if (!matrixUserId || !encryptedPassword) {
      send(response, jsonResponse(503, errorEnvelope('matrix_unavailable', 'Matrix account credentials are unavailable.')));
      return;
    }
    if (encryptedPassword === MATRIX_PASSWORD_RESET_REQUIRED) {
      send(response, jsonResponse(503, errorEnvelope('matrix_unavailable', 'Matrix account provisioning is still pending.')));
      return;
    }

    let password;
    try {
      password = decryptMatrixAccountSecret(encryptedPassword);
    } catch {
      send(response, jsonResponse(503, errorEnvelope('matrix_unavailable', 'Matrix account credentials could not be decrypted.')));
      return;
    }

    const requestedDeviceId = asText(account?.matrix_device_id) || matrixDeviceId();
    let login;
    try {
      login = await postMatrixJson('/_matrix/client/v3/login', {
        type: 'm.login.password',
        user: matrixUserId,
        password,
        device_id: requestedDeviceId,
        initial_device_display_name: MATRIX_DEVICE_DISPLAY_NAME,
      });
    } catch {
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Matrix login request failed.')));
      return;
    }

    if (!login.upstream.ok) {
      const upstreamMessage = asText(login.body?.error);
      send(
        response,
        jsonResponse(
          502,
          errorEnvelope(
            'upstream_error',
            upstreamMessage || `Matrix login failed (${login.upstream.status}).`,
          ),
        ),
      );
      return;
    }

    const matrixAccessToken = asText(login.body?.access_token);
    const matrixDeviceIdValue = asText(login.body?.device_id) || requestedDeviceId;
    if (!matrixAccessToken) {
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Matrix login response did not include an access token.')));
      return;
    }

    updateMatrixAccountDeviceStmt.run(matrixDeviceIdValue || null, auth.user.user_id);

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          matrix_user_id: matrixUserId,
          matrix_access_token: matrixAccessToken,
          matrix_device_id: matrixDeviceIdValue,
          homeserver_url: MATRIX_HOMESERVER_URL,
        }),
      ),
    );
  });

  const createSnapshot = withPolicyGate('hub.chat.write', async ({ response, request, auth }) => {
    let body;
    try {
      body = await parseBody(request);
    } catch {
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const projectId = asText(body.project_id);
    const conversationRoomId = asText(body.conversation_room_id);
    const messageSenderDisplayName = asText(body.message_sender_display_name);
    const messageText = asText(body.message_text);
    const messageTimestamp = asText(body.message_timestamp);

    if (!projectId || !conversationRoomId || !messageSenderDisplayName || !messageText || !messageTimestamp) {
      send(
        response,
        jsonResponse(
          400,
          errorEnvelope(
            'invalid_input',
            'project_id, conversation_room_id, message_sender_display_name, message_text, and message_timestamp are required.',
          ),
        ),
      );
      return;
    }

    const membershipGate = requireProjectMembership({ projectId, userId: auth.user.user_id });
    if (membershipGate.error) {
      send(response, jsonResponse(membershipGate.error.status, errorEnvelope(membershipGate.error.code, membershipGate.error.message)));
      return;
    }

    const snapshot = {
      snapshot_id: newId('snap'),
      project_id: projectId,
      conversation_room_id: conversationRoomId,
      message_sender_display_name: messageSenderDisplayName,
      message_text: messageText,
      message_timestamp: messageTimestamp,
      created_by: auth.user.user_id,
      created_at: nowIso(),
    };

    insertChatSnapshotStmt.run(
      snapshot.snapshot_id,
      snapshot.project_id,
      snapshot.conversation_room_id,
      snapshot.message_sender_display_name,
      snapshot.message_text,
      snapshot.message_timestamp,
      snapshot.created_by,
      snapshot.created_at,
    );

    try {
      const projectMembers = projectMembersByProjectStmt.all(projectId);
      for (const member of projectMembers) {
        if (member.user_id === auth.user.user_id) {
          continue;
        }
        createNotification({
          projectId,
          userId: member.user_id,
          reason: 'snapshot',
          entityType: 'snapshot',
          entityId: snapshot.snapshot_id,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: `New chat snapshot from ${messageSenderDisplayName}`,
            sourceProjectId: projectId,
            originKind: 'project',
            extras: {
              snapshot_id: snapshot.snapshot_id,
              conversation_room_id: conversationRoomId,
            },
          }),
        });
      }
    } catch (error) {
      console.error('chat.mjs createSnapshot notification fan-out failed', {
        file: 'apps/hub-api/routes/chat.mjs',
        handler: 'createSnapshot',
        userId: auth.user.user_id,
        projectId,
        snapshotId: snapshot.snapshot_id,
        error,
      });
    }

    send(response, jsonResponse(201, okEnvelope({ snapshot })));
  });

  const listSnapshots = withPolicyGate('hub.chat.view', async ({ response, requestUrl, auth }) => {
    const projectId = asText(requestUrl.searchParams.get('project_id'));
    if (!projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id is required.')));
      return;
    }

    const membershipGate = requireProjectMembership({ projectId, userId: auth.user.user_id });
    if (membershipGate.error) {
      send(response, jsonResponse(membershipGate.error.status, errorEnvelope(membershipGate.error.code, membershipGate.error.message)));
      return;
    }

    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
    const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));
    const rows = chatSnapshotsPageStmt.all(projectId, limit + 1, offset);
    const snapshots = rows.slice(0, limit).map((row) => ({
      snapshot_id: row.snapshot_id,
      project_id: row.project_id,
      conversation_room_id: row.conversation_room_id,
      message_sender_display_name: row.message_sender_display_name,
      message_text: row.message_text,
      message_timestamp: row.message_timestamp,
      created_by: row.created_by,
      created_at: row.created_at,
    }));
    const nextCursor = rows.length > limit ? encodeCursorOffset(offset + limit) : null;

    send(response, jsonResponse(200, okEnvelope({ snapshots, next_cursor: nextCursor })));
  });

  const deleteSnapshot = withPolicyGate('hub.chat.write', async ({ response, auth, params }) => {
    const snapshotId = asText(params.snapshotId);
    const snapshot = chatSnapshotByIdStmt.get(snapshotId);
    if (!snapshot) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Snapshot not found.')));
      return;
    }

    const membershipGate = requireProjectMembership({ projectId: snapshot.project_id, userId: auth.user.user_id });
    if (membershipGate.error) {
      send(response, jsonResponse(membershipGate.error.status, errorEnvelope(membershipGate.error.code, membershipGate.error.message)));
      return;
    }

    const isProjectOwner = membershipGate.role === 'owner';
    if (snapshot.created_by !== auth.user.user_id && !isProjectOwner) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only the creator or project owner may delete a snapshot.')));
      return;
    }

    deleteChatSnapshotStmt.run(snapshotId);
    send(response, jsonResponse(200, okEnvelope({ deleted: true })));
  });

  return {
    provision,
    createSnapshot,
    listSnapshots,
    deleteSnapshot,
  };
};
