import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Busboy from 'busboy';
import rateLimiterFlexible from 'rate-limiter-flexible';

const { RateLimiterMemory } = rateLimiterFlexible;

const PUBLIC_BUG_ALLOWED_STATUSES = new Set(['new', 'open', 'in_progress', 'fixed', 'wont_fix']);
const PUBLIC_BUG_SCREENSHOT_ROUTE_PREFIX = '/public/bug-report-screenshots/';
const PUBLIC_BUG_DEFAULT_LIMIT = 25;
const PUBLIC_BUG_MAX_LIMIT = 100;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;
const PUBLIC_BUG_RATE_LIMIT = new RateLimiterMemory({
  points: 10,
  duration: 60 * 60,
});

const SCREENSHOT_EXTENSION_BY_MIME = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
});

const SCREENSHOT_MIME_BY_EXTENSION = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
});

const parseAllowedOrigins = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw === '*') {
    return { wildcard: true, values: [] };
  }
  return {
    wildcard: false,
    values: raw.split(',').map((item) => item.trim()).filter(Boolean),
  };
};

const forwardedHeaderValue = (value) => String(value || '').split(',')[0].trim();

const normalizeClientIp = (request, trustProxy) => {
  if (trustProxy) {
    const forwarded = forwardedHeaderValue(request.headers['x-forwarded-for']);
    if (forwarded) {
      return forwarded;
    }
  }
  return String(request.socket?.remoteAddress || 'unknown').trim() || 'unknown';
};

const stripTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const encodePublicBugCursor = ({ createdAt, id }) =>
  Buffer.from(JSON.stringify({ created_at: createdAt, id }), 'utf8').toString('base64url');

const decodePublicBugCursor = (value) => {
  const raw = stripTrailingSlash(value);
  if (!raw) {
    return { createdAt: '', id: '' };
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const createdAt = sanitizeTextField(parsed?.created_at);
    const id = sanitizeTextField(parsed?.id);
    if (!createdAt || !id) {
      return null;
    }
    return { createdAt, id };
  } catch (error) {
    return null;
  }
};

const publicScreenshotUrl = (baseUrl, fileName) =>
  `${stripTrailingSlash(baseUrl)}${PUBLIC_BUG_SCREENSHOT_ROUTE_PREFIX}${encodeURIComponent(fileName)}`;

const isRateLimitRejection = (value) =>
  value && typeof value === 'object' && Number.isFinite(Number(value.msBeforeNext));

const rateLimitErrorResponse = (request, publicJsonResponse, errorEnvelope, rateLimitResult) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(Number(rateLimitResult?.msBeforeNext || 0) / 1000));
  return publicJsonResponse(
    request,
    429,
    errorEnvelope('rate_limited', 'Too many bug report submissions. Please try again later.'),
    { headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
};

const publicScreenshotMimeType = (filePath) =>
  SCREENSHOT_MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

const publicCorsOrigin = (request, publicAllowedOrigins) => {
  const origin = String(request.headers.origin || '').trim();
  if (publicAllowedOrigins.wildcard) {
    return '*';
  }
  if (origin && publicAllowedOrigins.values.includes(origin)) {
    return origin;
  }
  return publicAllowedOrigins.values[0] || '*';
};

const publicCorsHeaders = (request, publicAllowedOrigins, methods, extraHeaders = {}) => {
  const origin = publicCorsOrigin(request, publicAllowedOrigins);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    ...(origin !== '*' ? { Vary: 'Origin' } : {}),
    ...extraHeaders,
  };
};

const sanitizeTextField = (value) => (typeof value === 'string' ? value.trim() : '');

const asOptionalField = (value) => {
  const normalized = sanitizeTextField(value);
  return normalized || null;
};

const parseMultipartBugReport = async (request) => new Promise((resolve, reject) => {
  let resolved = false;
  const fields = {};
  let screenshot = null;
  let parseError = null;

  const finish = (value, isError = false) => {
    if (resolved) {
      return;
    }
    resolved = true;
    if (isError) {
      reject(value);
      return;
    }
    resolve(value);
  };

  let busboy;
  try {
    busboy = Busboy({
      headers: request.headers,
      limits: {
        fieldSize: MAX_DESCRIPTION_LENGTH + 1_024,
        fields: 6,
        files: 1,
        fileSize: MAX_SCREENSHOT_BYTES,
        parts: 7,
      },
    });
  } catch (error) {
    finish(error, true);
    return;
  }

  busboy.on('field', (name, value, info = {}) => {
    if (parseError) {
      return;
    }
    if (info.valueTruncated) {
      parseError = { status: 400, code: 'invalid_input', message: `${name} is too long.` };
      return;
    }
    fields[name] = value;
  });

  busboy.on('file', (name, stream, info = {}) => {
    if (parseError) {
      stream.resume();
      return;
    }

    if (name !== 'screenshot') {
      parseError = { status: 400, code: 'invalid_input', message: 'Only the screenshot file field is supported.' };
      stream.resume();
      return;
    }

    const mimeType = sanitizeTextField(info.mimeType).toLowerCase();
    const extension = SCREENSHOT_EXTENSION_BY_MIME[mimeType];
    if (!extension) {
      parseError = { status: 400, code: 'invalid_input', message: 'screenshot must be a PNG, JPEG, GIF, WebP, or AVIF image.' };
      stream.resume();
      return;
    }

    const chunks = [];
    let sizeBytes = 0;
    stream.on('data', (chunk) => {
      const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += nextChunk.byteLength;
      chunks.push(nextChunk);
    });
    stream.on('limit', () => {
      parseError = { status: 413, code: 'payload_too_large', message: 'screenshot must be 5MB or smaller.' };
    });
    stream.on('end', () => {
      if (parseError) {
        return;
      }
      if (sizeBytes === 0) {
        parseError = { status: 400, code: 'invalid_input', message: 'screenshot must not be empty.' };
        return;
      }
      screenshot = {
        buffer: Buffer.concat(chunks),
        sizeBytes,
        mimeType,
        extension,
      };
    });
  });

  busboy.once('filesLimit', () => {
    parseError = { status: 400, code: 'invalid_input', message: 'Only one screenshot upload is allowed.' };
  });
  busboy.once('fieldsLimit', () => {
    parseError = { status: 400, code: 'invalid_input', message: 'Too many form fields were provided.' };
  });
  busboy.once('partsLimit', () => {
    parseError = { status: 400, code: 'invalid_input', message: 'Too many form parts were provided.' };
  });
  busboy.once('error', (error) => {
    finish(error, true);
  });
  busboy.once('finish', () => {
    if (parseError) {
      finish(parseError, true);
      return;
    }
    finish({ fields, screenshot });
  });

  request.once('aborted', () => {
    finish(new Error('Request aborted by client.'), true);
  });
  request.pipe(busboy);
});

export const createPublicRoutes = (deps) => {
  const {
    ALLOWED_ORIGIN,
    HUB_API_BASE_URL,
    HUB_API_TRUST_PROXY,
    publicBugScreenshotDir,
    send,
    errorEnvelope,
    okEnvelope,
    asInteger,
    nowIso,
    newId,
    sendPublicBugReportEmail,
    insertBugReportStmt,
    publicBugReportsStmt,
  } = deps;

  const publicAllowedOrigins = (() => {
    const parsed = parseAllowedOrigins(ALLOWED_ORIGIN);
    if (parsed.wildcard) {
      return parsed;
    }
    const values = [...new Set([...parsed.values, 'https://getfacets.app'])];
    return { wildcard: false, values };
  })();

  const publicJsonResponse = (request, statusCode, payload, { methods = 'GET,POST,OPTIONS', headers = {} } = {}) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...publicCorsHeaders(request, publicAllowedOrigins, methods, headers),
    },
    body: JSON.stringify(payload),
  });

  const publicFileResponse = (request, statusCode, body, contentType, cacheControl = 'public, max-age=31536000, immutable') => ({
    statusCode,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      ...publicCorsHeaders(request, publicAllowedOrigins, 'GET,OPTIONS'),
    },
    body,
  });

  const successEnvelope = () => okEnvelope({ submitted: true });

  const publicBugReportUrl = (fileName) => publicScreenshotUrl(HUB_API_BASE_URL, fileName);

  const optionsPublic = async ({ request, response }) => {
    send(response, publicJsonResponse(request, 204, okEnvelope(null)));
  };

  const submitBugReport = async ({ request, response }) => {
    const clientIp = normalizeClientIp(request, HUB_API_TRUST_PROXY);
    try {
      await PUBLIC_BUG_RATE_LIMIT.consume(clientIp);
    } catch (rateLimitResult) {
      if (isRateLimitRejection(rateLimitResult)) {
        send(response, rateLimitErrorResponse(request, publicJsonResponse, errorEnvelope, rateLimitResult));
        return;
      }
      request.log.error('Failed to enforce public bug report rate limit.', { error: rateLimitResult, clientIp });
      send(response, publicJsonResponse(request, 500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    const contentType = sanitizeTextField(request.headers['content-type']).toLowerCase();
    if (!contentType.startsWith('multipart/form-data')) {
      send(response, publicJsonResponse(
        request,
        400,
        errorEnvelope('invalid_input', 'Content-Type must be multipart/form-data.'),
      ));
      return;
    }

    let parsed;
    try {
      parsed = await parseMultipartBugReport(request);
    } catch (error) {
      if (error?.status) {
        send(response, publicJsonResponse(request, error.status, errorEnvelope(error.code, error.message)));
        return;
      }
      request.log.error('Failed to parse public bug report submission.', { error });
      send(response, publicJsonResponse(request, 400, errorEnvelope('invalid_input', 'Malformed multipart form submission.')));
      return;
    }

    if (sanitizeTextField(parsed.fields.website)) {
      send(response, publicJsonResponse(request, 200, successEnvelope()));
      return;
    }

    const description = sanitizeTextField(parsed.fields.description);
    if (!description) {
      send(response, publicJsonResponse(request, 400, errorEnvelope('invalid_input', 'description is required.')));
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      send(response, publicJsonResponse(
        request,
        400,
        errorEnvelope('invalid_input', `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`),
      ));
      return;
    }

    const reporterName = asOptionalField(parsed.fields.name);
    if (reporterName && reporterName.length > MAX_NAME_LENGTH) {
      send(response, publicJsonResponse(
        request,
        400,
        errorEnvelope('invalid_input', `name must be ${MAX_NAME_LENGTH} characters or fewer.`),
      ));
      return;
    }

    const reporterEmail = asOptionalField(parsed.fields.email);
    if (reporterEmail && reporterEmail.length > MAX_EMAIL_LENGTH) {
      send(response, publicJsonResponse(
        request,
        400,
        errorEnvelope('invalid_input', `email must be ${MAX_EMAIL_LENGTH} characters or fewer.`),
      ));
      return;
    }

    const bugReportId = newId('bug');
    const createdAt = nowIso();
    let screenshotPath = null;

    if (parsed.screenshot) {
      const fileName = `${bugReportId}${parsed.screenshot.extension}`;
      const diskPath = path.join(publicBugScreenshotDir, fileName);
      try {
        await mkdir(publicBugScreenshotDir, { recursive: true });
        await writeFile(diskPath, parsed.screenshot.buffer);
      } catch (error) {
        request.log.error('Failed to write public bug report screenshot.', { error, bugReportId });
        send(response, publicJsonResponse(request, 500, errorEnvelope('internal_error', 'Failed to save screenshot.')));
        return;
      }
      screenshotPath = publicBugReportUrl(fileName);
    }

    try {
      insertBugReportStmt.run(
        bugReportId,
        createdAt,
        reporterName,
        reporterEmail,
        description,
        screenshotPath,
      );
    } catch (error) {
      request.log.error('Failed to persist public bug report.', { error, bugReportId });
      send(response, publicJsonResponse(request, 500, errorEnvelope('internal_error', 'Failed to save bug report.')));
      return;
    }

    const emailResult = await sendPublicBugReportEmail({
      bugReportId,
      reporterName,
      reporterEmail,
      description,
      screenshotUrl: screenshotPath,
      requestLog: request.log,
    });
    if (emailResult?.error) {
      request.log.error('Failed to send public bug report notification email.', {
        bugReportId,
        error: emailResult.error,
      });
    }

    send(response, publicJsonResponse(request, 200, successEnvelope()));
  };

  const listPublicBugs = async ({ request, response, requestUrl }) => {
    const limit = asInteger(requestUrl.searchParams.get('limit'), PUBLIC_BUG_DEFAULT_LIMIT, 1, PUBLIC_BUG_MAX_LIMIT);
    const cursor = decodePublicBugCursor(requestUrl.searchParams.get('cursor'));
    if (!cursor) {
      send(response, publicJsonResponse(request, 400, errorEnvelope('invalid_input', 'cursor must be a valid paging token.'), { methods: 'GET,OPTIONS' }));
      return;
    }

    const rows = publicBugReportsStmt.all(
      cursor.createdAt,
      cursor.createdAt,
      cursor.createdAt,
      cursor.id,
      limit + 1,
    );
    const pageRows = rows.slice(0, limit);
    const bugs = pageRows
      .filter((row) => PUBLIC_BUG_ALLOWED_STATUSES.has(String(row.status || '')))
      .map((row) => ({
        id: row.id,
        created_at: row.created_at,
        description: row.description,
        status: row.status,
      }));
    const hasMore = rows.length > limit;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow
      ? encodePublicBugCursor({ createdAt: lastRow.created_at, id: lastRow.id })
      : null;

    send(response, publicJsonResponse(
      request,
      200,
      okEnvelope({
        bugs,
        page: {
          limit,
          has_more: hasMore,
          next_cursor: nextCursor,
        },
      }),
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' }, methods: 'GET,OPTIONS' },
    ));
  };

  const serveBugReportScreenshot = async ({ request, response, params }) => {
    const fileName = sanitizeTextField(params.fileName);
    if (!fileName) {
      send(response, publicJsonResponse(request, 404, errorEnvelope('not_found', 'Screenshot not found.'), { methods: 'GET,OPTIONS' }));
      return;
    }

    const filePath = path.join(publicBugScreenshotDir, path.basename(fileName));
    try {
      const payload = await readFile(filePath);
      send(response, publicFileResponse(request, 200, payload, publicScreenshotMimeType(filePath)));
    } catch (error) {
      request.log.warn('Failed to read public bug report screenshot.', {
        error,
        fileName,
      });
      send(response, publicJsonResponse(request, 404, errorEnvelope('not_found', 'Screenshot not found.'), { methods: 'GET,OPTIONS' }));
    }
  };

  return {
    listPublicBugs,
    optionsPublic,
    serveBugReportScreenshot,
    submitBugReport,
  };
};
