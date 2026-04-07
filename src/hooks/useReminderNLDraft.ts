import { useEffect, useMemo, useState } from 'react';
import { parseReminderInput } from '../lib/nlp/reminder-parser';
import type { ReminderParseResult } from '../lib/nlp/reminder-parser';
import type { CreateReminderPayload } from '../services/hub/reminders';

export const emptyReminderPreview = (): ReminderParseResult => ({
  fields: {
    title: '',
    remind_at: null,
    recurrence: null,
    context_hint: null,
  },
  meta: {
    confidence: {
      title: 0,
      remind_at: 0,
      recurrence: 0,
      context_hint: 0,
    },
    spans: {
      title: [],
      remind_at: [],
      recurrence: [],
      context_hint: [],
    },
    debugSteps: [],
    maskedInput: '',
  },
  warnings: null,
});

export const hasMeaningfulReminderPreview = (preview: ReminderParseResult): boolean =>
  Boolean(preview.fields.title.trim() || preview.fields.remind_at || preview.fields.recurrence || preview.fields.context_hint);

type BuildReminderCreatePayloadFailure = 'missing-required' | 'invalid-remind-at';

interface BuildReminderCreatePayloadResult {
  payload: CreateReminderPayload | null;
  failureReason: BuildReminderCreatePayloadFailure | null;
}

interface BuildReminderCreatePayloadArgs {
  preview: ReminderParseResult;
  draft: string;
  fallbackTitleFromDraft?: boolean;
}

export const buildReminderCreatePayload = ({
  preview,
  draft,
  fallbackTitleFromDraft = false,
}: BuildReminderCreatePayloadArgs): BuildReminderCreatePayloadResult => {
  const parsedTitle = preview.fields.title.trim();
  const title = parsedTitle || (fallbackTitleFromDraft ? draft.trim() : '');
  if (!title || !preview.fields.remind_at) {
    return { payload: null, failureReason: 'missing-required' };
  }

  const remindAtDate = new Date(preview.fields.remind_at);
  if (Number.isNaN(remindAtDate.getTime())) {
    return { payload: null, failureReason: 'invalid-remind-at' };
  }

  return {
    payload: {
      title,
      remind_at: remindAtDate.toISOString(),
      recurrence_json: preview.fields.recurrence ? { ...preview.fields.recurrence } : null,
    },
    failureReason: null,
  };
};

interface UseReminderNLDraftArgs {
  initialDraft?: string;
  parseDelayMs?: number;
  enabled?: boolean;
}

export const useReminderNLDraft = ({
  initialDraft = '',
  parseDelayMs = 250,
  enabled = true,
}: UseReminderNLDraftArgs = {}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [preview, setPreview] = useState<ReminderParseResult>(() => emptyReminderPreview());

  useEffect(() => {
    if (!enabled) {
      setPreview(emptyReminderPreview());
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timer = window.setTimeout(() => {
      setPreview(draft.trim() ? parseReminderInput(draft, { timezone }) : emptyReminderPreview());
    }, parseDelayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, enabled, parseDelayMs]);

  const parseNow = (): ReminderParseResult => {
    if (!enabled) {
      const empty = emptyReminderPreview();
      setPreview(empty);
      return empty;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nextPreview = draft.trim() ? parseReminderInput(draft, { timezone }) : emptyReminderPreview();
    setPreview(nextPreview);
    return nextPreview;
  };

  const createPayload = (
    options: {
      fallbackTitleFromDraft?: boolean;
      forceReparse?: boolean;
    } = {},
  ): BuildReminderCreatePayloadResult => {
    const resolvedPreview = options.forceReparse ? parseNow() : preview;
    return buildReminderCreatePayload({
      preview: resolvedPreview,
      draft,
      fallbackTitleFromDraft: options.fallbackTitleFromDraft,
    });
  };

  const clear = () => {
    setDraft('');
    setPreview(emptyReminderPreview());
  };

  return {
    draft,
    setDraft,
    preview,
    setPreview,
    parseNow,
    clear,
    createPayload,
    hasMeaningfulPreview: useMemo(() => hasMeaningfulReminderPreview(preview), [preview]),
  };
};
