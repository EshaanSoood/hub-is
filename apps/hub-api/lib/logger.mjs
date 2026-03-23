const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value, fallback) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return fallback;
};

const shouldLogLevel = (level) => {
  const environment = (process.env.NODE_ENV || '').trim().toLowerCase();
  return !(environment === 'production' && level === 'debug');
};

const serializeError = (errorValue, stackHint) => {
  if (errorValue instanceof Error) {
    return {
      message: errorValue.message,
      stack: errorValue.stack,
    };
  }

  if (isPlainObject(errorValue)) {
    const message = normalizeText(errorValue.message, 'Unknown error');
    const stack = normalizeText(errorValue.stack, normalizeText(stackHint, ''));
    return stack ? { message, stack } : { message };
  }

  if (errorValue !== undefined && errorValue !== null) {
    const stack = normalizeText(stackHint, '');
    return stack
      ? { message: String(errorValue), stack }
      : { message: String(errorValue) };
  }

  if (stackHint) {
    return {
      message: 'Unknown error',
      stack: String(stackHint),
    };
  }

  return undefined;
};

const writeLogLine = (entry) => {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};

export const createRequestLogger = (requestId, method, route, userId = 'anonymous') => {
  const normalizedRequestId = normalizeText(requestId, 'unknown');
  const normalizedMethod = normalizeText(method, 'UNKNOWN').toUpperCase();
  const normalizedRoute = normalizeText(route, '/');
  let currentUserId = normalizeText(userId, 'anonymous');

  const emit = (level, message, data) => {
    if (!shouldLogLevel(level)) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: normalizedRequestId,
      method: normalizedMethod,
      route: normalizedRoute,
      userId: currentUserId,
      message: normalizeText(message, '(no message)'),
    };

    if (isPlainObject(data)) {
      const rest = { ...data };
      const serializedError = serializeError(rest.error, rest.stack);
      delete rest.error;
      delete rest.stack;

      if (rest.durationMs !== undefined) {
        const duration = Number(rest.durationMs);
        entry.durationMs = Number.isFinite(duration)
          ? Number(duration.toFixed(2))
          : rest.durationMs;
        delete rest.durationMs;
      }

      if (serializedError) {
        entry.error = serializedError;
      }

      if (Object.keys(rest).length > 0) {
        entry.data = rest;
      }
    } else if (data !== undefined) {
      entry.data = { value: data };
    }

    writeLogLine(entry);
  };

  return {
    setUserId(nextUserId) {
      currentUserId = normalizeText(nextUserId, 'anonymous');
    },
    debug(message, data) {
      emit('debug', message, data);
    },
    info(message, data) {
      emit('info', message, data);
    },
    warn(message, data) {
      emit('warn', message, data);
    },
    error(message, data) {
      emit('error', message, data);
    },
  };
};
