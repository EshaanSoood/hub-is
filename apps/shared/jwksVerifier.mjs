import { createPublicKey, createVerify } from 'node:crypto';

const nowUnixSeconds = () => Math.floor(Date.now() / 1000);

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeIssuer = (issuer) => asText(issuer).replace(/\/+$/, '');

const parseAudience = (audienceCsv) =>
  asText(audienceCsv)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const base64UrlToBuffer = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
};

const parseJwt = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlToBuffer(encodedHeader).toString('utf8'));
    payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString('utf8'));
  } catch {
    throw new Error('JWT header/payload must be valid JSON.');
  }

  return {
    encodedHeader,
    encodedPayload,
    encodedSignature,
    header,
    payload,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: base64UrlToBuffer(encodedSignature),
  };
};

const isAudienceAllowed = (tokenAud, expectedAudiences) => {
  if (expectedAudiences.length === 0) {
    return true;
  }

  if (typeof tokenAud === 'string') {
    return expectedAudiences.includes(tokenAud);
  }

  if (Array.isArray(tokenAud)) {
    return tokenAud.some((entry) => typeof entry === 'string' && expectedAudiences.includes(entry));
  }

  return false;
};

export const createJwksVerifier = ({
  issuer,
  audience = '',
  jwksCacheMaxAgeMs = 600_000,
  allowedAlgorithms = ['RS256'],
  fetchImpl = fetch,
}) => {
  const normalizedIssuer = normalizeIssuer(issuer);
  if (!normalizedIssuer) {
    throw new Error('KEYCLOAK_ISSUER must be configured.');
  }

  const expectedAudiences = parseAudience(audience);
  const jwksUrl = `${normalizedIssuer}/protocol/openid-connect/certs`;

  let cache = {
    expiresAt: 0,
    keysByKid: new Map(),
  };

  const readJwkForKid = async (kid) => {
    const now = Date.now();
    const fromCache = cache.keysByKid.get(kid);
    if (fromCache && now < cache.expiresAt) {
      return fromCache;
    }

    const fetchJwks = async () => {
      const response = await fetchImpl(jwksUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`JWKS fetch failed (${response.status}).`);
      }

      const payload = await response.json().catch(() => null);
      if (!payload || !Array.isArray(payload.keys)) {
        throw new Error('JWKS payload missing keys.');
      }

      const nextMap = new Map();
      for (const key of payload.keys) {
        const keyKid = asText(key?.kid);
        if (!keyKid) {
          continue;
        }
        nextMap.set(keyKid, key);
      }

      cache = {
        expiresAt: Date.now() + jwksCacheMaxAgeMs,
        keysByKid: nextMap,
      };

      return cache.keysByKid.get(kid) || null;
    };

    const initial = await fetchJwks();
    if (initial) {
      return initial;
    }

    // Refresh-on-miss path for unknown kid.
    return fetchJwks();
  };

  const verifyToken = async (token) => {
    const parsed = parseJwt(token);
    const alg = asText(parsed.header?.alg);
    const kid = asText(parsed.header?.kid);

    if (!alg || !allowedAlgorithms.includes(alg)) {
      throw new Error(`Unsupported JWT alg '${alg || 'unknown'}'.`);
    }

    if (!kid) {
      throw new Error('JWT kid is required.');
    }

    const jwk = await readJwkForKid(kid);
    if (!jwk) {
      throw new Error(`JWKS does not contain kid '${kid}'.`);
    }

    let verified = false;
    if (alg === 'RS256') {
      const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
      const verifier = createVerify('RSA-SHA256');
      verifier.update(parsed.signingInput);
      verifier.end();
      verified = verifier.verify(publicKey, parsed.signature);
    }

    if (!verified) {
      throw new Error('JWT signature verification failed.');
    }

    const claims = parsed.payload;
    const now = nowUnixSeconds();

    if (!Number.isInteger(claims.exp) || claims.exp <= now) {
      throw new Error('JWT exp is missing or expired.');
    }

    const tokenIssuer = normalizeIssuer(claims.iss);
    if (!tokenIssuer || tokenIssuer !== normalizedIssuer) {
      throw new Error('JWT issuer mismatch.');
    }

    if (!isAudienceAllowed(claims.aud, expectedAudiences)) {
      throw new Error('JWT audience mismatch.');
    }

    if (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 60)) {
      throw new Error('JWT nbf is invalid.');
    }

    const sub = asText(claims.sub);
    if (!sub) {
      throw new Error('JWT subject is required.');
    }

    return {
      claims,
      header: parsed.header,
      issuer: normalizedIssuer,
      expectedAudiences,
      jwksUrl,
    };
  };

  return {
    verifyToken,
    jwksUrl,
    issuer: normalizedIssuer,
    expectedAudiences,
  };
};
