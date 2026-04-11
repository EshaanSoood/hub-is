import { useEffect, useMemo, useState } from 'react';
import { parseReminderInput } from '../lib/nlp/reminder-parser';
import type { ReminderParseResult } from '../lib/nlp/reminder-parser';
import { emptyReminderPreview, hasMeaningfulReminderPreview } from '../lib/reminderPreview';
import type { CreateReminderPayload } from '../services/hub/reminders';

export { emptyReminderPreview, hasMeaningfulReminderPreview };

export type ReminderNLDraftFailureReason = 'missing-required' | 'invalid-remind-at';

interface BuildReminderCreatePayloadResult {
  payload: CreateReminderPayload | null;
  failureReason: ReminderNLDraftFailureReason | null;
}

interface BuildReminderCreatePayloadArgs {
  preview: ReminderParseResult;
  draft: string;
  fallbackTitleFromDraft?: boolean;
}

export const mapReminderFailureReasonToMessage = (failureReason: ReminderNLDraftFailureReason | null): string =>
  failureReason === 'invalid-remind-at' ? 'Reminder time is invalid.' : 'Add a title and time to create a reminder.';

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

export interface ReminderNLFormPreview {
  title: string | null;
  remindAt: string | null;
}

const toDateTimeLocalInput = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const useReminderNLDraft = ({
  initialDraft = '',
  parseDelayMs = 250,
  enabled = true,
}: UseReminderNLDraftArgs = {}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [preview, setPreview] = useState<ReminderParseResult>(() => emptyReminderPreview());
  const [lastParsedDraft, setLastParsedDraft] = useState('');

  useEffect(() => {
    if (!enabled) {
      const timer = window.setTimeout(() => {
        setPreview(emptyReminderPreview());
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
        setPreview(emptyReminderPreview());
        setLastParsedDraft('');
        return;
      }
      setPreview(parseReminderInput(draft, { timezone }));
      setLastParsedDraft(draft);
    }, parseDelayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, enabled, parseDelayMs]);

  const parseNow = (): ReminderParseResult => {
    if (!enabled) {
      const empty = emptyReminderPreview();
      setPreview(empty);
      setLastParsedDraft('');
      return empty;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const trimmedDraft = draft.trim();
    const nextPreview = trimmedDraft ? parseReminderInput(draft, { timezone }) : emptyReminderPreview();
    setPreview(nextPreview);
    setLastParsedDraft(trimmedDraft ? draft : '');
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
    setLastParsedDraft('');
  };

  const formPreview = useMemo<ReminderNLFormPreview>(() => ({
    title: preview.fields.title.trim() || null,
    remindAt: toDateTimeLocalInput(preview.fields.remind_at),
  }), [preview.fields.remind_at, preview.fields.title]);

  return {
    draft,
    setDraft,
    preview,
    setPreview,
    parseNow,
    clear,
    createPayload,
    lastParsedDraft,
    formPreview,
    hasMeaningfulPreview: useMemo(() => hasMeaningfulReminderPreview(preview), [preview]),
  };
};
