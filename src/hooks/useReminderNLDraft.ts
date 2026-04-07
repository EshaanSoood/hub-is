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

export const useReminderNLDraft = ({
  initialDraft = '',
  parseDelayMs = 250,
  enabled = true,
}: UseReminderNLDraftArgs = {}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [preview, setPreview] = useState<ReminderParseResult>(() => emptyReminderPreview());

  useEffect(() => {
    if (!enabled) {
      const timer = window.setTimeout(() => {
        setPreview(emptyReminderPreview());
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
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
