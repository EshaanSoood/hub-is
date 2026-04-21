import { useCallback, useMemo, useState } from 'react';
import { useCalendarNLDraft } from '../../../../hooks/useCalendarNLDraft';
import type { CalendarCreatePanelPrefill, CreateCalendarEventPayload } from '../types';

interface UseCalendarCreatePanelOptions {
  onCreateEvent?: (payload: CreateCalendarEventPayload) => Promise<void>;
}

const parseLocalDateTime = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const combineDateAndTime = (date: Date, timeValue: string): Date | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

export const useCalendarCreatePanel = ({ onCreateEvent }: UseCalendarCreatePanelOptions) => {
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [draftStartTime, setDraftStartTime] = useState('09:00');
  const [draftEndTime, setDraftEndTime] = useState('10:00');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { draft, setDraft, clear, formPreview } = useCalendarNLDraft({ parseDelayMs: 150, enabled: Boolean(onCreateEvent) });

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const openCreatePanel = useCallback((day: string, prefill?: CalendarCreatePanelPrefill) => {
    setDraftDay(day);
    setDraft(prefill?.title ?? '');
    setDraftStartTime(prefill?.startTime ?? '09:00');
    setDraftEndTime(prefill?.endTime ?? '10:00');
    setCreateError(null);
  }, [setDraft]);

  const resetCreateDraft = useCallback(() => {
    setDraftDay(null);
    clear();
    setDraftStartTime('09:00');
    setDraftEndTime('10:00');
    setCreateError(null);
  }, [clear]);

  const submitCreateEvent = useCallback(async () => {
    const trimmedDraft = draft.trim();
    const resolvedTitle = formPreview.title?.trim() || trimmedDraft;
    if (!onCreateEvent || !draftDay || resolvedTitle.length === 0) {
      return;
    }

    const parsedStartDate = parseLocalDateTime(formPreview.startAt);
    const parsedEndDate = parseLocalDateTime(formPreview.endAt);
    const startDate = parsedStartDate ?? new Date(`${draftDay}T${draftStartTime}:00`);
    let endDate = parsedEndDate;

    if (!endDate && parsedStartDate) {
      endDate = combineDateAndTime(parsedStartDate, draftEndTime);
      if (endDate && endDate.getTime() <= parsedStartDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }
      if (!endDate) {
        endDate = new Date(parsedStartDate.getTime() + 60 * 60_000);
      }
    }

    if (!endDate) {
      endDate = new Date(`${draftDay}T${draftEndTime}:00`);
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      setCreateError('End time must be after start time.');
      return;
    }

    setCreateError(null);
    setIsCreatingEvent(true);
    try {
      await onCreateEvent({
        title: resolvedTitle,
        start_dt: startDate.toISOString(),
        end_dt: endDate.toISOString(),
        timezone,
      });
      resetCreateDraft();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create event.');
    } finally {
      setIsCreatingEvent(false);
    }
  }, [draft, draftDay, draftEndTime, draftStartTime, formPreview.endAt, formPreview.startAt, formPreview.title, onCreateEvent, resetCreateDraft, timezone]);

  return {
    draftDay,
    draftTitle: draft,
    draftStartTime,
    draftEndTime,
    draftPreview: formPreview,
    isCreatingEvent,
    createError,
    setDraftTitle: setDraft,
    setDraftStartTime,
    setDraftEndTime,
    openCreatePanel,
    resetCreateDraft,
    submitCreateEvent,
  };
};
