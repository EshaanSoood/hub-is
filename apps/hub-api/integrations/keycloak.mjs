export const createKeycloakIntegration = ({
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_REDIRECT_URI,
  KEYCLOAK_ADMIN_USERNAME,
  KEYCLOAK_ADMIN_PASSWORD,
  KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS,
  KEYCLOAK_REQUIRED_INVITE_ACTIONS,
  HUB_PUBLIC_APP_URL,
  EXTERNAL_API_TIMEOUT_MS,
  asText,
  fetchWithTimeout,
  isFetchTimeoutError,
  parseUpstreamJson,
}) => {
  const safeKeycloakInviteConfig = () =>
    Boolean(
      KEYCLOAK_URL
      && KEYCLOAK_REALM
      && KEYCLOAK_CLIENT_ID
      && KEYCLOAK_ADMIN_USERNAME
      && KEYCLOAK_ADMIN_PASSWORD,
    );

  const getKeycloakInviteRedirectUri = () => asText(KEYCLOAK_REDIRECT_URI) || `${HUB_PUBLIC_APP_URL}/`;

  const acquireKeycloakAdminToken = async (requestLog = null) => {
    if (!safeKeycloakInviteConfig()) {
      return {
        error: {
          status: 503,
          code: 'keycloak_unavailable',
          message: 'Keycloak invite provisioning is not configured.',
        },
      };
    }

    const form = new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KEYCLOAK_ADMIN_USERNAME,
      password: KEYCLOAK_ADMIN_PASSWORD,
    });

    let upstream;
    try {
      upstream = await fetchWithTimeout(
        new URL('/realms/master/protocol/openid-connect/token', `${KEYCLOAK_URL}/`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form,
        },
        { timeoutMs: EXTERNAL_API_TIMEOUT_MS },
      );
    } catch (error) {
      requestLog?.error?.('Keycloak admin token request failed.', { error });
      if (isFetchTimeoutError(error)) {
        return {
          error: {
            status: 504,
            code: 'upstream_timeout',
            message: 'Keycloak admin token request timed out.',
          },
        };
      }
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: 'Keycloak admin token request failed.',
        },
      };
    }

    const body = await parseUpstreamJson(upstream, requestLog, 'Failed to parse Keycloak admin token response.');
    if (!upstream.ok || !asText(body?.access_token)) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: 'Unable to acquire Keycloak admin access token.',
        },
      };
    }

    return { data: { accessToken: asText(body.access_token) } };
  };

  const keycloakAdminRequest = async ({
    path,
    method = 'GET',
    accessToken,
    requestLog = null,
    headers = {},
    body = undefined,
  }) => {
    let upstream;
    try {
      upstream = await fetchWithTimeout(
        new URL(path, `${KEYCLOAK_URL}/`),
        {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...headers,
          },
          ...(body === undefined ? {} : { body }),
        },
        { timeoutMs: EXTERNAL_API_TIMEOUT_MS },
      );
    } catch (error) {
      requestLog?.error?.('Keycloak admin request failed.', { path, method, error });
      if (isFetchTimeoutError(error)) {
        return {
          error: {
            status: 504,
            code: 'upstream_timeout',
            message: 'Keycloak admin request timed out.',
          },
        };
      }
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: 'Keycloak admin request failed.',
        },
      };
    }

    const parsedBody = upstream.status === 204
      ? null
      : await parseUpstreamJson(upstream, requestLog, 'Failed to parse Keycloak admin response.');
    return { upstream, body: parsedBody };
  };

  const findKeycloakUserByEmail = async ({ accessToken, email, requestLog = null }) => {
    const normalizedEmail = asText(email).toLowerCase();
    if (!normalizedEmail) {
      return { data: null };
    }

    const response = await keycloakAdminRequest({
      path: `/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users?email=${encodeURIComponent(normalizedEmail)}&exact=true`,
      accessToken,
      requestLog,
    });
    if (response.error) {
      return response;
    }
    if (!response.upstream.ok) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: `Keycloak user lookup failed (${response.upstream.status}).`,
        },
      };
    }

    const users = Array.isArray(response.body) ? response.body : [];
    const match = users.find((user) => asText(user?.email).toLowerCase() === normalizedEmail) || null;
    return { data: match };
  };

  const createKeycloakInviteUser = async ({ accessToken, email, requestLog = null }) => {
    const normalizedEmail = asText(email).toLowerCase();
    const localpart = normalizedEmail.split('@')[0] || 'hub-user';
    const response = await keycloakAdminRequest({
      path: `/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users`,
      method: 'POST',
      accessToken,
      requestLog,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: normalizedEmail,
        email: normalizedEmail,
        firstName: localpart,
        enabled: true,
        emailVerified: false,
        requiredActions: [...KEYCLOAK_REQUIRED_INVITE_ACTIONS],
      }),
    });
    if (response.error) {
      return response;
    }
    if (![201, 204, 409].includes(response.upstream.status)) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: `Keycloak user create failed (${response.upstream.status}).`,
        },
      };
    }

    return findKeycloakUserByEmail({ accessToken, email: normalizedEmail, requestLog });
  };

  const sendKeycloakInviteActionsEmail = async ({ accessToken, userId, requestLog = null }) => {
    const query = new URLSearchParams({
      client_id: KEYCLOAK_CLIENT_ID,
      redirect_uri: getKeycloakInviteRedirectUri(),
      lifespan: String(KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS),
    });
    const response = await keycloakAdminRequest({
      path: `/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users/${encodeURIComponent(userId)}/execute-actions-email?${query.toString()}`,
      method: 'PUT',
      accessToken,
      requestLog,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([...KEYCLOAK_REQUIRED_INVITE_ACTIONS]),
    });
    if (response.error) {
      return response;
    }
    if (!response.upstream.ok) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: `Keycloak invite email failed (${response.upstream.status}).`,
        },
      };
    }

    return { data: { sent: true } };
  };

  const deleteKeycloakUser = async ({ accessToken, userId, requestLog = null }) => {
    const response = await keycloakAdminRequest({
      path: `/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users/${encodeURIComponent(userId)}`,
      method: 'DELETE',
      accessToken,
      requestLog,
    });
    if (response.error) {
      return response;
    }
    if (![204, 404].includes(response.upstream.status)) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: `Keycloak user delete failed (${response.upstream.status}).`,
        },
      };
    }

    return { data: { deleted: response.upstream.status === 204 } };
  };

  const ensureKeycloakInviteOnboarding = async ({ email, requestLog = null }) => {
    const normalizedEmail = asText(email).toLowerCase();
    if (!normalizedEmail) {
      return {
        error: {
          status: 400,
          code: 'invalid_input',
          message: 'Invite email is required.',
        },
      };
    }

    const tokenResult = await acquireKeycloakAdminToken(requestLog);
    if (tokenResult.error) {
      return tokenResult;
    }

    const accessToken = tokenResult.data.accessToken;
    const existingLookup = await findKeycloakUserByEmail({ accessToken, email: normalizedEmail, requestLog });
    if (existingLookup.error) {
      return existingLookup;
    }

    let user = existingLookup.data;
    const createdUser = !existingLookup.data;
    if (!user) {
      const created = await createKeycloakInviteUser({ accessToken, email: normalizedEmail, requestLog });
      if (created.error) {
        return created;
      }
      user = created.data;
    }
    if (!user?.id) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: 'Unable to resolve Keycloak user for invite.',
        },
      };
    }

    if (createdUser) {
      const actionEmail = await sendKeycloakInviteActionsEmail({
        accessToken,
        userId: asText(user.id),
        requestLog,
      });
      if (actionEmail.error) {
        return actionEmail;
      }
    }

    return {
      data: {
        userId: asText(user.id),
        email: normalizedEmail,
        created: createdUser,
      },
    };
  };

  const cleanupKeycloakInviteOnboarding = async ({ userId, requestLog = null }) => {
    const normalizedUserId = asText(userId);
    if (!normalizedUserId) {
      return { data: { deleted: false } };
    }

    const tokenResult = await acquireKeycloakAdminToken(requestLog);
    if (tokenResult.error) {
      return tokenResult;
    }

    return deleteKeycloakUser({
      accessToken: tokenResult.data.accessToken,
      userId: normalizedUserId,
      requestLog,
    });
  };

  return {
    safeKeycloakInviteConfig,
    ensureKeycloakInviteOnboarding,
    cleanupKeycloakInviteOnboarding,
  };
};
