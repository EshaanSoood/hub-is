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

export const fetchWithTimeout = async (url, options = {}, { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS } = {}) => {
  const normalizedTimeout = Number.isFinite(Number(timeoutMs))
    ? Math.max(1, Math.floor(Number(timeoutMs)))
    : DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  let didTimeout = false;

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

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, normalizedTimeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
      throw new FetchTimeoutError(normalizedTimeout, error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener('abort', onUpstreamAbort);
    }
  }
};
