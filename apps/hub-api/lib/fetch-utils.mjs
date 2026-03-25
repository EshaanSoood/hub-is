const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export class FetchTimeoutError extends Error {
  constructor(timeoutMs, cause = null) {
    super(`Upstream request timed out after ${timeoutMs}ms.`);
    this.name = 'FetchTimeoutError';
    this.timeout_ms = timeoutMs;
    this.cause = cause || null;
  }
}

export const isFetchTimeoutError = (error) => error instanceof FetchTimeoutError;

const responseBodyMethodSet = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text']);

export const fetchWithTimeout = async (url, options = {}, { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS } = {}) => {
  const normalizedTimeout = Number.isFinite(Number(timeoutMs))
    ? Math.max(1, Math.floor(Number(timeoutMs)))
    : DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  let didTimeout = false;
  let cleanedUp = false;

  const upstreamSignal = options.signal;
  const onUpstreamAbort = () => {
    controller.abort(upstreamSignal.reason);
  };
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort(upstreamSignal.reason);
    } else {
      upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
    }
  }

  let timer = null;
  const clearTimer = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (upstreamSignal) {
      upstreamSignal.removeEventListener('abort', onUpstreamAbort);
    }
  };

  timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
    clearTimer();
  }, normalizedTimeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.body) {
      clearTimer();
      return response;
    }

    return new Proxy(response, {
      get(target, prop) {
        if (prop === 'clearTimeout') {
          return clearTimer;
        }
        if (prop === 'timeoutSignal') {
          return controller.signal;
        }
        if (prop === 'timeoutMs') {
          return normalizedTimeout;
        }

        const value = Reflect.get(target, prop, target);
        if (typeof value !== 'function') {
          return value;
        }

        const bound = value.bind(target);
        if (!responseBodyMethodSet.has(String(prop))) {
          return bound;
        }

        return async (...args) => {
          try {
            return await bound(...args);
          } catch (error) {
            if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
              throw new FetchTimeoutError(normalizedTimeout, error);
            }
            throw error;
          } finally {
            clearTimer();
          }
        };
      },
    });
  } catch (error) {
    clearTimer();
    if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
      throw new FetchTimeoutError(normalizedTimeout, error);
    }
    throw error;
  }
};
