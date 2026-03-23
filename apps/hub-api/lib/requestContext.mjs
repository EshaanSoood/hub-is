import { randomUUID } from 'node:crypto';
import { createRequestLogger } from './logger.mjs';

const parseRequestRoute = (request) => {
  const rawUrl = typeof request?.url === 'string' ? request.url : '';
  if (!rawUrl) {
    return '/';
  }

  const withoutHash = rawUrl.split('#')[0] || '';
  const withoutQuery = withoutHash.split('?')[0] || '';
  if (!withoutQuery) {
    return '/';
  }

  if (withoutQuery.startsWith('/')) {
    return withoutQuery;
  }

  const schemeIndex = withoutQuery.indexOf('://');
  if (schemeIndex >= 0) {
    const pathStart = withoutQuery.indexOf('/', schemeIndex + 3);
    return pathStart >= 0 ? withoutQuery.slice(pathStart) || '/' : '/';
  }

  return `/${withoutQuery}`;
};

export const applyRequestContext = (request, response) => {
  const requestId = randomUUID();
  const method = typeof request?.method === 'string' && request.method
    ? request.method.toUpperCase()
    : 'GET';
  const route = parseRequestRoute(request);

  request.requestId = requestId;
  request.log = createRequestLogger(requestId, method, route, 'anonymous');
  response.setHeader('X-Request-ID', requestId);

  const startedAt = performance.now();
  request.log.info(`→ ${method} ${route}`);

  response.once('finish', () => {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    request.log.info(`← ${response.statusCode} ${method} ${route} (${durationMs}ms)`, { durationMs });
  });

  return request.log;
};
