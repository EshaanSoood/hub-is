import { readFileSync } from 'node:fs';
import path from 'node:path';

export const createUserRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    buildCalendarFeedUrl,
    getOrCreateCalendarFeedToken,
    membershipRoleLabel,
    projectMembershipsByUserStmt,
  } = deps;

  const loopbackHosts = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);
  let localDevBootstrapConfig = null;

  const isLoopbackRequest = (request) => {
    const remoteAddress = String(request.socket?.remoteAddress || '').trim().toLowerCase();
    return loopbackHosts.has(remoteAddress);
  };

  const parseEnvFile = (filePath) => {
    const content = readFileSync(filePath, 'utf8');
    const result = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    }
    return result;
  };

  const readLocalDevBootstrapConfig = () => {
    if (localDevBootstrapConfig) {
      return localDevBootstrapConfig;
    }

    const repoRoot = process.cwd();
    const usersEnv = parseEnvFile(path.join(repoRoot, '.env.local.users.local'));
    const keycloakEnv = parseEnvFile(path.join(repoRoot, '.env.keycloak.local'));
    const keycloakPort = String(keycloakEnv.KEYCLOAK_PORT || process.env.KEYCLOAK_PORT || '8081').trim();
    const keycloakUrl = String(process.env.KEYCLOAK_URL || `http://127.0.0.1:${keycloakPort}`).trim().replace(/\/+$/, '');
    const keycloakRealm = String(process.env.KEYCLOAK_REALM || keycloakEnv.KEYCLOAK_REALM || 'hub-os-local').trim();
    const smokeClientId = String(keycloakEnv.KEYCLOAK_SMOKE_CLIENT_ID || 'hub-os-local-smoke').trim();
    const username = String(usersEnv.LOCAL_OWNER_USERNAME || '').trim();
    const password = String(usersEnv.LOCAL_OWNER_PASSWORD || '').trim();

    if (!username || !password) {
      throw new Error('Missing local owner credentials.');
    }

    localDevBootstrapConfig = {
      keycloakUrl,
      keycloakRealm,
      smokeClientId,
      username,
      password,
    };
    return localDevBootstrapConfig;
  };

  const getSession = withPolicyGate('hub.view', async ({ request, response, auth, sessionSummary }) => {
    const memberships = projectMembershipsByUserStmt.all(auth.user.user_id).map((row) => ({
      project_id: row.project_id,
      role: membershipRoleLabel(row.role),
      joined_at: row.joined_at,
    }));
    let calendarFeedUrl = '';
    try {
      const calendarFeedToken = getOrCreateCalendarFeedToken(auth.user.user_id);
      calendarFeedUrl = buildCalendarFeedUrl(calendarFeedToken.token);
    } catch (error) {
      request.log?.error?.('Failed to resolve calendar feed URL for session bootstrap.', {
        userId: auth.user.user_id,
        error,
      });
    }

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          user: {
            user_id: auth.user.user_id,
            kc_sub: auth.user.kc_sub,
            display_name: auth.user.display_name,
            email: auth.user.email,
          },
          memberships,
          calendar_feed_url: calendarFeedUrl,
          sessionSummary,
        }),
      ),
    );
  });

  const getLocalDevBootstrapAuth = async ({ request, response }) => {
    if (process.env.NODE_ENV !== 'development' || !isLoopbackRequest(request)) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Not found.')));
      return;
    }

    let config;
    try {
      config = readLocalDevBootstrapConfig();
    } catch (error) {
      request.log?.warn?.('Local dev auth bootstrap config unavailable.', { error });
      send(response, jsonResponse(500, errorEnvelope('local_dev_bootstrap_unavailable', 'Local dev auth bootstrap is unavailable.')));
      return;
    }

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: config.smokeClientId,
      username: config.username,
      password: config.password,
      scope: 'openid profile email',
    });

    let upstream;
    try {
      upstream = await fetch(
        `${config.keycloakUrl}/realms/${encodeURIComponent(config.keycloakRealm)}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );
    } catch (error) {
      request.log?.warn?.('Local dev auth bootstrap token request failed.', { error });
      send(response, jsonResponse(502, errorEnvelope('local_dev_bootstrap_failed', 'Failed to reach local auth provider.')));
      return;
    }

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok || typeof payload?.access_token !== 'string' || !payload.access_token.trim()) {
      request.log?.warn?.('Local dev auth bootstrap token response invalid.', {
        status: upstream.status,
        payload,
      });
      send(response, jsonResponse(502, errorEnvelope('local_dev_bootstrap_failed', 'Failed to mint local dev auth token.')));
      return;
    }

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          access_token: payload.access_token,
          expires_in: typeof payload.expires_in === 'number' ? payload.expires_in : null,
        }),
      ),
    );
  };

  return {
    getSession,
    getLocalDevBootstrapAuth,
  };
};
