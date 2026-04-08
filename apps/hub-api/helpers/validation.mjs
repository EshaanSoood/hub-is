export const createValidationHelpers = ({
  ALLOWED_ORIGIN,
  HUB_API_MAX_BODY_BYTES_RAW,
  HUB_API_LARGE_BODY_MAX_BYTES_RAW,
  systemLog,
}) => {
  const nowIso = () => new Date().toISOString();
  const asText = (value) => (typeof value === 'string' ? value.trim() : '');
  const asNullableText = (value) => {
    const normalized = asText(value);
    return normalized || null;
  };

  const asInteger = (value, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  };

  const asBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalized = asText(value).toLowerCase();
    if (!normalized) {
      return fallback;
    }
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
    return fallback;
  };

  const HUB_API_MAX_BODY_BYTES = asInteger(HUB_API_MAX_BODY_BYTES_RAW, 1_048_576, 1_024, 50 * 1024 * 1024);
  const HUB_API_LARGE_BODY_MAX_BYTES = asInteger(
    HUB_API_LARGE_BODY_MAX_BYTES_RAW,
    50 * 1024 * 1024,
    HUB_API_MAX_BODY_BYTES,
    100 * 1024 * 1024,
  );

  const parseJson = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    if (typeof value === 'object') {
      return value;
    }
    try {
      return JSON.parse(String(value));
    } catch (error) {
      systemLog.warn('Failed to parse JSON value; using fallback.', {
        error,
        valueType: typeof value,
      });
      return fallback;
    }
  };

  const parseJsonObject = (value, fallback = {}) => {
    const parsed = parseJson(value, fallback);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return fallback;
  };

  const parseUpstreamJson = async (response, requestLog = null, message = 'Failed to parse upstream JSON response.') => {
    try {
      return await response.json();
    } catch (error) {
      requestLog?.warn?.(message, { error });
      return null;
    }
  };

  const toJson = (value) => JSON.stringify(value ?? null);

  const okEnvelope = (data) => ({ ok: true, data, error: null });
  const errorEnvelope = (code, message) => ({
    ok: false,
    data: null,
    error: {
      code,
      message,
    },
  });

  const jsonResponse = (statusCode, payload) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Hub-Dev-Auth',
    },
    body: JSON.stringify(payload),
  });

  const send = (response, output) => {
    response.writeHead(output.statusCode, output.headers);
    response.end(output.body);
  };

  class BodyTooLargeError extends Error {
    constructor(limitBytes) {
      super(`Request body exceeds ${limitBytes} bytes.`);
      this.name = 'BodyTooLargeError';
      this.limit_bytes = limitBytes;
    }
  }

  const isBodyTooLargeError = (error) => error instanceof BodyTooLargeError;

  const readRequestBuffer = async (request, { maxBytes = HUB_API_MAX_BODY_BYTES } = {}) => {
    const normalizedMaxBytes = asInteger(maxBytes, HUB_API_MAX_BODY_BYTES, 1_024, HUB_API_LARGE_BODY_MAX_BYTES);
    const contentLength = Number.parseInt(String(request.headers['content-length'] || ''), 10);
    if (Number.isInteger(contentLength) && contentLength > normalizedMaxBytes) {
      request.resume();
      throw new BodyTooLargeError(normalizedMaxBytes);
    }

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += nextChunk.byteLength;
      if (totalBytes > normalizedMaxBytes) {
        request.resume();
        throw new BodyTooLargeError(normalizedMaxBytes);
      }
      chunks.push(nextChunk);
    }
    return Buffer.concat(chunks);
  };

  const bodyParseErrorResponse = (error, { invalidCode = 'invalid_json', invalidMessage = 'Body must be valid JSON.' } = {}) => {
    if (isBodyTooLargeError(error)) {
      return jsonResponse(413, errorEnvelope('payload_too_large', `Request body exceeds ${error.limit_bytes} bytes.`));
    }
    return jsonResponse(400, errorEnvelope(invalidCode, invalidMessage));
  };

  const parseBody = async (request, options = {}) => {
    const raw = (await readRequestBuffer(request, options)).toString('utf8').trim();
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  };
  parseBody.errorResponse = bodyParseErrorResponse;
  parseBody.defaultMaxBytes = HUB_API_MAX_BODY_BYTES;
  parseBody.largeMaxBytes = HUB_API_LARGE_BODY_MAX_BYTES;

  return {
    nowIso,
    asText,
    asNullableText,
    asInteger,
    asBoolean,
    parseJson,
    parseJsonObject,
    parseUpstreamJson,
    toJson,
    okEnvelope,
    errorEnvelope,
    jsonResponse,
    send,
    parseBody,
  };
};
