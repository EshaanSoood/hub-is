import { useEffect, useMemo, useState } from 'react';
import { parseTaskInput, type TaskParseResult, type TaskPriority } from '../lib/nlp/task-parser';

export interface TaskNLFormPreview {
  title: string | null;
  dueAt: string | null;
  priority: TaskPriority;
}

interface UseTaskNLDraftArgs {
  initialDraft?: string;
  parseDelayMs?: number;
  enabled?: boolean;
}

const emptyTaskPreview = (): TaskParseResult => ({
  fields: {
    title: '',
    due_at: null,
    priority: null,
    assignee_hints: [],
  },
  meta: {
    confidence: {
      title: 0,
      due_at: 0,
      priority: 0,
      assignee_hints: 0,
    },
    spans: {
      title: [],
      due_at: [],
      priority: [],
      assignee_hints: [],
    },
    debugSteps: [],
    maskedInput: '',
  },
  warnings: null,
});

const toDateTimeLocalInput = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalizedValue = value.includes('T') ? value : `${value}T23:59`;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const useTaskNLDraft = ({
  initialDraft = '',
  parseDelayMs = 250,
  enabled = true,
}: UseTaskNLDraftArgs = {}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [preview, setPreview] = useState<TaskParseResult>(() => emptyTaskPreview());
  const [lastParsedDraft, setLastParsedDraft] = useState('');

  useEffect(() => {
    if (!enabled) {
      const timer = window.setTimeout(() => {
        setPreview(emptyTaskPreview());
        setLastParsedDraft('');
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timer = window.setTimeout(() => {
      const trimmedDraft = draft.trim();
      if (!trimmedDraft) {
        setPreview(emptyTaskPreview());
        setLastParsedDraft('');
        return;
      }
      setPreview(parseTaskInput(draft, { timezone }));
      setLastParsedDraft(draft);
    }, parseDelayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, enabled, parseDelayMs]);

  const parseNow = (): TaskParseResult => {
    if (!enabled) {
      const empty = emptyTaskPreview();
      setPreview(empty);
      setLastParsedDraft('');
      return empty;
    }
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      const empty = emptyTaskPreview();
      setPreview(empty);
      setLastParsedDraft('');
      return empty;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nextPreview = parseTaskInput(draft, { timezone });
    setPreview(nextPreview);
    setLastParsedDraft(draft);
    return nextPreview;
  };

  const clear = () => {
    setDraft('');
    setPreview(emptyTaskPreview());
    setLastParsedDraft('');
  };

  const formPreview = useMemo<TaskNLFormPreview>(() => ({
    title: preview.fields.title.trim() || null,
    dueAt: toDateTimeLocalInput(preview.fields.due_at),
    priority: preview.fields.priority,
  }), [preview.fields.due_at, preview.fields.priority, preview.fields.title]);

  return {
    draft,
    setDraft,
    preview,
    setPreview,
    parseNow,
    clear,
    lastParsedDraft,
    formPreview,
    hasMeaningfulPreview: useMemo(
      () => Boolean(formPreview.title || formPreview.dueAt || formPreview.priority),
      [formPreview.dueAt, formPreview.priority, formPreview.title],
    ),
  };
};
