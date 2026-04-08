import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface CalendarParseDebugStep {
  pass: string;
  ruleId: string;
  note: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface CalendarParseResult {
  fields: {
    title: string | null;
    date: string | null;
    time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    location: string | null;
    recurrence: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
      interval: number | null;
      days: string[] | null;
      exceptions: string[] | null;
      end_date: string | null;
    };
    alerts: Array<{ offset_minutes: number }> | null;
    attendees: string[] | null;
  };
  meta: {
    debugSteps: CalendarParseDebugStep[];
  };
  warnings: Array<{
    code: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
  }> | null;
}

export interface CalendarNLFormPreview {
  title: string | null;
  startAt: string | null;
  endAt: string | null;
}

interface UseCalendarNLDraftArgs {
  initialDraft?: string;
  parseDelayMs?: number;
  enabled?: boolean;
}

interface WorkerParseRequest {
  requestId: number;
  draft: string;
  timezone: string;
}

interface WorkerParseResponse {
  requestId: number;
  parsedDraft: string;
  preview: CalendarParseResult;
  error: string | null;
}

const resolveTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const toDateTimeLocalInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const normalizeIsoTime = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const emptyPreview = (): CalendarParseResult => ({
  fields: {
    title: null,
    date: null,
    time: null,
    end_time: null,
    duration_minutes: null,
    location: null,
    recurrence: {
      frequency: null,
      interval: null,
      days: null,
      exceptions: null,
      end_date: null,
    },
    alerts: null,
    attendees: null,
  },
  meta: {
    debugSteps: [],
  },
  warnings: null,
});

export const hasMeaningfulCalendarPreview = (preview: CalendarNLFormPreview): boolean =>
  Boolean(
    preview.title
    || preview.startAt
    || preview.endAt,
  );

export const calendarPreviewToFormPreview = (preview: CalendarParseResult): CalendarNLFormPreview => {
  const title = preview.fields.title?.trim() || null;
  const date = preview.fields.date;
  const startTime = normalizeIsoTime(preview.fields.time);

  if (!date || !startTime) {
    return {
      title,
      startAt: null,
      endAt: null,
    };
  }

  const startDate = new Date(`${date}T${startTime}:00`);
  if (Number.isNaN(startDate.getTime())) {
    return {
      title,
      startAt: null,
      endAt: null,
    };
  }

  let endDate: Date | null = null;
  const endTime = normalizeIsoTime(preview.fields.end_time);
  if (endTime) {
    const candidateEnd = new Date(`${date}T${endTime}:00`);
    if (!Number.isNaN(candidateEnd.getTime())) {
      if (candidateEnd.getTime() <= startDate.getTime()) {
        candidateEnd.setDate(candidateEnd.getDate() + 1);
      }
      endDate = candidateEnd;
    }
  } else if (typeof preview.fields.duration_minutes === 'number' && preview.fields.duration_minutes > 0) {
    endDate = new Date(startDate.getTime() + preview.fields.duration_minutes * 60_000);
  }

  return {
    title,
    startAt: toDateTimeLocalInput(startDate),
    endAt: endDate ? toDateTimeLocalInput(endDate) : null,
  };
};

export const useCalendarNLDraft = ({
  initialDraft = '',
  parseDelayMs = 250,
  enabled = true,
}: UseCalendarNLDraftArgs = {}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [preview, setPreview] = useState<CalendarParseResult>(() => emptyPreview());
  const [error, setError] = useState<string | null>(null);
  const [lastParsedDraft, setLastParsedDraft] = useState('');

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef(0);

  const queueParse = useCallback((nextDraft: string) => {
    if (!enabled) {
      return;
    }
    const worker = workerRef.current;
    if (!worker) {
      return;
    }
    requestIdRef.current += 1;
    const payload: WorkerParseRequest = {
      requestId: requestIdRef.current,
      draft: nextDraft,
      timezone: resolveTimezone(),
    };
    worker.postMessage(payload);
  }, [enabled]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/calendarNlpWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerParseResponse>) => {
      if (!event.data || event.data.requestId !== requestIdRef.current) {
        return;
      }
      setPreview(event.data.preview || emptyPreview());
      setError(event.data.error);
      setLastParsedDraft(event.data.parsedDraft);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !draft.trim()) {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }
        setPreview(emptyPreview());
        setError(null);
        setLastParsedDraft('');
      });
      return () => {
        cancelled = true;
      };
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = 0;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = 0;
      queueParse(draft);
    }, parseDelayMs);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = 0;
      }
    };
  }, [draft, enabled, parseDelayMs, queueParse]);

  const parseNow = (): void => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = 0;
    }

    if (!draft.trim()) {
      requestIdRef.current += 1;
      setPreview(emptyPreview());
      setError(null);
      setLastParsedDraft('');
      return;
    }

    if (!enabled) {
      requestIdRef.current += 1;
      setPreview(emptyPreview());
      setError(null);
      setLastParsedDraft('');
      return;
    }
    requestIdRef.current += 1;
    setPreview(emptyPreview());
    setError(null);
    setLastParsedDraft('');
    queueParse(draft);
  };

  const clear = () => {
    requestIdRef.current += 1;
    setDraft('');
    setPreview(emptyPreview());
    setError(null);
    setLastParsedDraft('');
  };

  const formPreview = useMemo(() => calendarPreviewToFormPreview(preview), [preview]);
  const hasMeaningfulPreview = useMemo(() => hasMeaningfulCalendarPreview(formPreview), [formPreview]);

  return {
    draft,
    setDraft,
    preview,
    setPreview,
    error,
    setError,
    parseNow,
    clear,
    lastParsedDraft,
    formPreview,
    hasMeaningfulPreview,
  };
};
