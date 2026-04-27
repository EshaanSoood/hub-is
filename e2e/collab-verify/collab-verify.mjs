/* global fetch, process, console, URL, URLSearchParams, Headers, Buffer, setTimeout, clearTimeout */

import { createHash, randomBytes } from 'node:crypto';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import * as Y from 'yjs';

const REQUIRED_ENV_VARS = [
  'COLLAB_VERIFY_BASE_URL',
  'COLLAB_VERIFY_WS_URL',
  'COLLAB_VERIFY_KEYCLOAK_URL',
  'COLLAB_VERIFY_REALM',
  'COLLAB_VERIFY_CLIENT_ID',
  'COLLAB_VERIFY_USER_A_USERNAME',
  'COLLAB_VERIFY_USER_A_PASSWORD',
  'COLLAB_VERIFY_USER_B_USERNAME',
  'COLLAB_VERIFY_USER_B_PASSWORD',
  'COLLAB_VERIFY_PROJECT_ID',
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => {
  const value = process.env[name];
  return typeof value !== 'string' || value.trim().length === 0;
});

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables:\n- ${missingEnvVars.join('\n- ')}`);
  process.exit(1);
}

const config = {
  baseUrl: process.env.COLLAB_VERIFY_BASE_URL.trim().replace(/\/$/, ''),
  wsUrl: process.env.COLLAB_VERIFY_WS_URL.trim().replace(/\/$/, ''),
  keycloakUrl: process.env.COLLAB_VERIFY_KEYCLOAK_URL.trim().replace(/\/$/, ''),
  realm: process.env.COLLAB_VERIFY_REALM.trim(),
  clientId: process.env.COLLAB_VERIFY_CLIENT_ID.trim(),
  fallbackClientId: 'eshaan-os-hub',
  redirectUri: String(process.env.COLLAB_VERIFY_REDIRECT_URI || 'https://eshaansood.org').trim(),
  userA: {
    username: process.env.COLLAB_VERIFY_USER_A_USERNAME.trim(),
    password: process.env.COLLAB_VERIFY_USER_A_PASSWORD,
  },
  userB: {
    username: process.env.COLLAB_VERIFY_USER_B_USERNAME.trim(),
    password: process.env.COLLAB_VERIFY_USER_B_PASSWORD,
  },
  projectId: process.env.COLLAB_VERIFY_PROJECT_ID.trim(),
  docId: process.env.COLLAB_VERIFY_DOC_ID?.trim() || '',
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const stringifyPayload = (payload) => {
  if (payload === null || payload === undefined) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const readResponseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return { text: '', json: null };
  }

  try {
    return {
      text,
      json: JSON.parse(text),
    };
  } catch {
    return {
      text,
      json: null,
    };
  }
};

const describeHttpError = (label, response, body) => {
  const json = body?.json;
  const message =
    json?.error?.message ||
    json?.error_description ||
    json?.message ||
    json?.error ||
    body?.text ||
    response.statusText ||
    'Unknown error';

  return `${label} failed (${response.status}): ${message}`;
};

const getEnvelopeData = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  if (payload.ok === true && 'data' in payload) {
    return payload.data;
  }

  return payload;
};

const parseAuthorizationPayload = (payload) => {
  const data = getEnvelopeData(payload);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  return data.authorization && typeof data.authorization === 'object' ? data.authorization : null;
};

const fetchJson = async (url, init = {}) => {
  let response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request failed for ${url}: ${message}`);
  }

  const body = await readResponseBody(response);
  return { response, body };
};

const htmlDecode = (value) => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const toBase64Url = (input) => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const parseSetCookie = (header) => {
  const first = String(header || '').split(';', 1)[0];
  const separator = first.indexOf('=');
  if (separator <= 0) {
    return null;
  }
  return {
    name: first.slice(0, separator),
    value: first.slice(separator + 1),
  };
};

const requestWithCookieJar = async (url, { method = 'GET', headers = {}, body, cookieJar }) => {
  const requestHeaders = new Headers(headers);

  if (cookieJar.size > 0) {
    const cookieHeader = Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
    requestHeaders.set('cookie', cookieHeader);
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    redirect: 'manual',
  });

  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];

  for (const header of setCookies) {
    const parsed = parseSetCookie(header);
    if (parsed) {
      cookieJar.set(parsed.name, parsed.value);
    }
  }

  return response;
};

const extractFormAction = (html) => {
  const match = html.match(/<form[^>]*id=["']kc-form-login["'][^>]*action=["']([^"']+)["']/i)
    || html.match(/<form[^>]*action=["']([^"']+)["'][^>]*id=["']kc-form-login["'][^>]*>/i)
    || html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);

  if (!match) {
    throw new Error('Unable to locate Keycloak login form action.');
  }

  return htmlDecode(match[1]);
};

const extractHiddenInputs = (html) => {
  const result = new Map();
  for (const match of html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi)) {
    const inputTag = match[0];
    const nameMatch = inputTag.match(/name=["']([^"']+)["']/i);
    if (!nameMatch) {
      continue;
    }

    const valueMatch = inputTag.match(/value=["']([^"']*)["']/i);
    result.set(nameMatch[1], htmlDecode(valueMatch ? valueMatch[1] : ''));
  }

  return result;
};

const mintAccessTokenWithPkce = async ({ username, password, label, clientId }) => {
  const cookieJar = new Map();
  const state = toBase64Url(randomBytes(16));
  const nonce = toBase64Url(randomBytes(16));
  const codeVerifier = toBase64Url(randomBytes(48));
  const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest());

  const authorizeUrl = new URL(`${config.keycloakUrl}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/auth`);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('nonce', nonce);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  let currentUrl = authorizeUrl.toString();
  let loginPageHtml = '';
  let loginPageUrl = '';

  for (let index = 0; index < 8; index += 1) {
    const response = await requestWithCookieJar(currentUrl, { cookieJar });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`${label} auth redirect missing location header.`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (response.status !== 200) {
      throw new Error(`${label} auth page returned ${response.status}.`);
    }

    loginPageHtml = await response.text();
    loginPageUrl = currentUrl;
    break;
  }

  if (!loginPageHtml) {
    throw new Error(`${label} failed to load Keycloak login page.`);
  }

  const loginAction = new URL(extractFormAction(loginPageHtml), loginPageUrl).toString();
  const hiddenInputs = extractHiddenInputs(loginPageHtml);
  const formBody = new URLSearchParams();
  for (const [name, value] of hiddenInputs.entries()) {
    formBody.set(name, value);
  }
  formBody.set('username', username);
  formBody.set('password', password);
  if (!formBody.has('credentialId')) {
    formBody.set('credentialId', '');
  }

  let response = await requestWithCookieJar(loginAction, {
    method: 'POST',
    cookieJar,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: loginPageUrl,
    },
    body: formBody.toString(),
  });

  let authorizationCode = '';
  for (let index = 0; index < 10; index += 1) {
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`${label} login redirect missing location header.`);
      }

      const redirect = new URL(location, loginAction).toString();
      if (redirect.startsWith(config.redirectUri)) {
        const callbackUrl = new URL(redirect);
        authorizationCode = String(callbackUrl.searchParams.get('code') || '');
        const returnedState = String(callbackUrl.searchParams.get('state') || '');
        if (!authorizationCode) {
          throw new Error(`${label} callback did not include code.`);
        }
        if (returnedState !== state) {
          throw new Error(`${label} callback state mismatch.`);
        }
        break;
      }

      response = await requestWithCookieJar(redirect, { cookieJar });
      continue;
    }

    const bodyPreview = await response.text();
    throw new Error(`${label} PKCE login flow ended early (${response.status}): ${bodyPreview.slice(0, 400)}`);
  }

  if (!authorizationCode) {
    throw new Error(`${label} PKCE flow failed to capture authorization code.`);
  }

  const tokenUrl = `${config.keycloakUrl}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/token`;
  const { response: tokenResponse, body: tokenBody } = await fetchJson(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: authorizationCode,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenResponse.ok || typeof tokenBody.json?.access_token !== 'string' || tokenBody.json.access_token.length === 0) {
    throw new Error(describeHttpError(`${label} PKCE token request`, tokenResponse, tokenBody));
  }

  return tokenBody.json.access_token;
};

const mintAccessToken = async ({ username, password, label }) => {
  const tokenUrl = `${config.keycloakUrl}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/token`;
  const form = new URLSearchParams();
  form.set('grant_type', 'password');
  form.set('client_id', config.clientId);
  form.set('username', username);
  form.set('password', password);

  const { response, body } = await fetchJson(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (response.ok && typeof body.json?.access_token === 'string' && body.json.access_token.length > 0) {
    return body.json.access_token;
  }

  const directGrantError = describeHttpError(`Keycloak token request for ${label}`, response, body);

  try {
    return await mintAccessTokenWithPkce({ username, password, label, clientId: config.clientId });
  } catch (primaryPkceError) {
    if (config.clientId === config.fallbackClientId) {
      throw new Error(`${directGrantError}; PKCE fallback failed: ${primaryPkceError instanceof Error ? primaryPkceError.message : String(primaryPkceError)}`);
    }

    try {
      return await mintAccessTokenWithPkce({
        username,
        password,
        label,
        clientId: config.fallbackClientId,
      });
    } catch (fallbackPkceError) {
      const primaryMessage = primaryPkceError instanceof Error ? primaryPkceError.message : String(primaryPkceError);
      const fallbackMessage = fallbackPkceError instanceof Error ? fallbackPkceError.message : String(fallbackPkceError);
      throw new Error(`${directGrantError}; PKCE fallback failed for ${config.clientId}: ${primaryMessage}; PKCE fallback failed for ${config.fallbackClientId}: ${fallbackMessage}`);
    }
  }
};

const requestHubJson = async (path, token, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const result = await fetchJson(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });
  if (!result.response.ok) {
    return result;
  }

  const payload = result.body.json;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.ok !== true || !('data' in payload) || payload.data === null) {
    throw new Error(describeHttpError(`Hub request for ${path}`, result.response, result.body));
  }

  return result;
};

const resolveDocId = async (accessToken) => {
  if (config.docId.length > 0) {
    return config.docId;
  }

  const projectsResult = await requestHubJson(
    `/api/hub/spaces/${encodeURIComponent(config.projectId)}/projects`,
    accessToken,
    { method: 'GET' },
  );

  if (!projectsResult.response.ok) {
    throw new Error(describeHttpError('Project lookup', projectsResult.response, projectsResult.body));
  }

  const projectsPayload = getEnvelopeData(projectsResult.body.json);
  const projects = Array.isArray(projectsPayload?.projects) ? projectsPayload.projects : [];

  if (projects.length === 0) {
    throw new Error(`No projects available for space ${config.projectId}.`);
  }

  for (const project of projects) {
    if (!project || typeof project.project_id !== 'string' || project.project_id.length === 0) {
      continue;
    }
    if (typeof project.doc_id === 'string' && project.doc_id.length > 0) {
      return project.doc_id;
    }
  }

  throw new Error(`No project-backed doc was available for space ${config.projectId}.`);
};

const authorizeCollabTicket = async ({ accessToken, docId, label }) => {
  const postResult = await requestHubJson('/api/hub/collab/authorize', accessToken, {
    method: 'POST',
    body: JSON.stringify({ doc_id: docId }),
  });

  if (postResult.response.ok) {
    const authorization = parseAuthorizationPayload(postResult.body.json);
    if (typeof authorization?.ws_ticket === 'string' && authorization.ws_ticket.length > 0) {
      return authorization.ws_ticket;
    }
    throw new Error(`${label} collab authorization succeeded but did not return a ws_ticket.`);
  }

  if (postResult.response.status !== 404 && postResult.response.status !== 405) {
    throw new Error(describeHttpError(`${label} collab authorization`, postResult.response, postResult.body));
  }

  const getResult = await requestHubJson(
    `/api/hub/collab/authorize?doc_id=${encodeURIComponent(docId)}`,
    accessToken,
    { method: 'GET' },
  );

  if (!getResult.response.ok) {
    throw new Error(describeHttpError(`${label} collab authorization`, getResult.response, getResult.body));
  }

  const authorization = parseAuthorizationPayload(getResult.body.json);
  if (typeof authorization?.ws_ticket !== 'string' || authorization.ws_ticket.length === 0) {
    throw new Error(`${label} collab authorization succeeded but did not return a ws_ticket.`);
  }

  return authorization.ws_ticket;
};

const waitForProviderSync = async (provider, label, timeoutMs) =>
  new Promise((resolve, reject) => {
    if (provider.synced) {
      resolve(undefined);
      return;
    }

    const timeoutId = setTimeout(() => {
      provider.off('sync', handleSync);
      reject(new Error(`${label} sync timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);

    const handleSync = (isSynced) => {
      if (!isSynced) {
        return;
      }

      clearTimeout(timeoutId);
      provider.off('sync', handleSync);
      resolve(undefined);
    };

    provider.on('sync', handleSync);
  });

const waitForRemoteValue = async ({ map, key, expectedValue, timeoutMs, intervalMs }) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (map.get(key) === expectedValue) {
      return true;
    }
    await sleep(intervalMs);
  }

  return map.get(key) === expectedValue;
};

let providerA = null;
let providerB = null;
let docA = null;
let docB = null;
let cleanedUp = false;

const cleanup = async () => {
  if (cleanedUp) {
    return;
  }
  cleanedUp = true;

  for (const provider of [providerA, providerB]) {
    if (!provider) {
      continue;
    }
    try {
      provider.destroy();
    } catch {
      // ignore cleanup errors
    }
  }

  for (const doc of [docA, docB]) {
    if (!doc) {
      continue;
    }
    try {
      doc.destroy();
    } catch {
      // ignore cleanup errors
    }
  }
};

const exitWithCleanup = async (code, message = '') => {
  if (message) {
    console.error(message);
  }
  await cleanup();
  process.exit(code);
};

process.once('SIGINT', () => {
  void exitWithCleanup(1, 'Interrupted by SIGINT.');
});

process.once('SIGTERM', () => {
  void exitWithCleanup(1, 'Interrupted by SIGTERM.');
});

const main = async () => {
  try {
    const [accessTokenA, accessTokenB] = await Promise.all([
      mintAccessToken({ username: config.userA.username, password: config.userA.password, label: 'User A' }),
      mintAccessToken({ username: config.userB.username, password: config.userB.password, label: 'User B' }),
    ]);

    const docId = await resolveDocId(accessTokenA);

    const [wsTicketA, wsTicketB] = await Promise.all([
      authorizeCollabTicket({ accessToken: accessTokenA, docId, label: 'User A' }),
      authorizeCollabTicket({ accessToken: accessTokenB, docId, label: 'User B' }),
    ]);

    docA = new Y.Doc();
    docB = new Y.Doc();

    providerA = new WebsocketProvider(config.wsUrl, docId, docA, {
      params: {
        ws_ticket: wsTicketA,
        doc_id: docId,
      },
      WebSocketPolyfill: WebSocket,
      disableBc: true,
    });

    providerB = new WebsocketProvider(config.wsUrl, docId, docB, {
      params: {
        ws_ticket: wsTicketB,
        doc_id: docId,
      },
      WebSocketPolyfill: WebSocket,
      disableBc: true,
    });

    await Promise.all([
      waitForProviderSync(providerA, 'User A provider', 15_000),
      waitForProviderSync(providerB, 'User B provider', 15_000),
    ]);

    const key = `collab-verify-${Date.now()}`;
    const value = `value-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const mapA = docA.getMap('collab-verify');
    const mapB = docB.getMap('collab-verify');

    mapA.set(key, value);

    const replicated = await waitForRemoteValue({
      map: mapB,
      key,
      expectedValue: value,
      timeoutMs: 10_000,
      intervalMs: 200,
    });

    if (!replicated) {
      console.error("FAIL: User B did not receive User A's write within 10 seconds");
      return 1;
    }

    console.log('PASS: collab sync verified — User A write visible to User B');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : stringifyPayload(error);
    console.error(message);
    return 1;
  } finally {
    await cleanup();
  }
};

const exitCode = await main();
process.exit(exitCode);
