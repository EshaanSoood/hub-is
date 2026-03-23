/* global fetch, Buffer, Headers, URLSearchParams */

import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const e2eRoot = resolve(__dirname, '..');

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const loadEnvFile = async (path) => {
  if (!existsSync(path)) {
    return;
  }

  const raw = await readFile(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
};

await loadEnvFile(resolve(e2eRoot, '.env.users.local'));

const required = [
  'HUB_SMOKE_USER_A_USERNAME',
  'HUB_SMOKE_USER_A_PASSWORD',
  'HUB_SMOKE_USER_B_USERNAME',
  'HUB_SMOKE_USER_B_PASSWORD',
];

const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Expected in environment or .env.users.local');
  process.exit(1);
}

const keycloakUrl = String(process.env.KEYCLOAK_URL || 'https://auth.eshaansood.org').trim().replace(/\/+$/, '');
const keycloakRealm = String(process.env.KEYCLOAK_REALM || 'eshaan-os').trim();
const keycloakClientId = String(process.env.KEYCLOAK_CLIENT_ID || 'eshaan-os-hub').trim();
const keycloakRedirectUri = String(process.env.KEYCLOAK_REDIRECT_URI || 'https://eshaansood.org/').trim();
const outputFile = resolve(e2eRoot, String(process.env.HUB_SMOKE_TOKENS_FILE || '.env.tokens.local').trim());

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

const requestTokenWithPkce = async ({ username, password }) => {
  const cookieJar = new Map();
  const state = toBase64Url(randomBytes(16));
  const nonce = toBase64Url(randomBytes(16));
  const codeVerifier = toBase64Url(randomBytes(48));
  const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest());

  const authorizeUrl = new URL(`${keycloakUrl}/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/auth`);
  authorizeUrl.searchParams.set('client_id', keycloakClientId);
  authorizeUrl.searchParams.set('redirect_uri', keycloakRedirectUri);
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
        throw new Error('Auth redirect missing location header.');
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (response.status !== 200) {
      throw new Error(`Unexpected auth page status: ${response.status}`);
    }

    loginPageHtml = await response.text();
    loginPageUrl = currentUrl;
    break;
  }

  if (!loginPageHtml) {
    throw new Error('Failed to load login page from Keycloak.');
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
        throw new Error('Login redirect missing location header.');
      }

      const redirect = new URL(location, loginAction).toString();
      if (redirect.startsWith(keycloakRedirectUri)) {
        const callbackUrl = new URL(redirect);
        authorizationCode = String(callbackUrl.searchParams.get('code') || '');
        const returnedState = String(callbackUrl.searchParams.get('state') || '');

        if (!authorizationCode) {
          throw new Error('Authorization callback did not include code.');
        }
        if (returnedState !== state) {
          throw new Error('Authorization callback state mismatch.');
        }
        break;
      }

      response = await requestWithCookieJar(redirect, { cookieJar });
      continue;
    }

    const bodyPreview = await response.text();
    throw new Error(`Login flow ended early with status ${response.status}: ${bodyPreview.slice(0, 400)}`);
  }

  if (!authorizationCode) {
    throw new Error('Failed to capture authorization code from callback redirect.');
  }

  const tokenResponse = await fetch(
    `${keycloakUrl}/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: keycloakClientId,
        code: authorizationCode,
        redirect_uri: keycloakRedirectUri,
        code_verifier: codeVerifier,
      }),
    },
  );

  const tokenPayload = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(`Token endpoint failed (${tokenResponse.status}).`);
  }

  return tokenPayload.access_token;
};

const tokenA = await requestTokenWithPkce({
  username: process.env.HUB_SMOKE_USER_A_USERNAME,
  password: process.env.HUB_SMOKE_USER_A_PASSWORD,
});

const tokenB = await requestTokenWithPkce({
  username: process.env.HUB_SMOKE_USER_B_USERNAME,
  password: process.env.HUB_SMOKE_USER_B_PASSWORD,
});

const now = new Date().toISOString();
const payload = [
  '# Generated by scripts/mint-contract-smoke-tokens.mjs',
  `# ${now}`,
  `TOKEN_A=${tokenA}`,
  `TOKEN_B=${tokenB}`,
  '',
].join('\n');

await writeFile(outputFile, payload, { encoding: 'utf8', mode: 0o600 });

console.log(`Wrote fresh TOKEN_A/TOKEN_B to ${outputFile}`);
console.log(`Load them into shell with: set -a; source ${outputFile}; set +a`);
