import { useCallback, useMemo, useState } from 'react';
import type { CalendarCreatePanelPrefill, CreateCalendarEventPayload } from '../types';

interface UseCalendarCreatePanelOptions {
  onCreateEvent?: (payload: CreateCalendarEventPayload) => Promise<void>;
}

export const useCalendarCreatePanel = ({ onCreateEvent }: UseCalendarCreatePanelOptions) => {
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStartTime, setDraftStartTime] = useState('09:00');
  const [draftEndTime, setDraftEndTime] = useState('10:00');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const openCreatePanel = useCallback((day: string, prefill?: CalendarCreatePanelPrefill) => {
    setDraftDay(day);
    setDraftTitle(prefill?.title ?? '');
    setDraftStartTime(prefill?.startTime ?? '09:00');
    setDraftEndTime(prefill?.endTime ?? '10:00');
    setCreateError(null);
  }, []);

  const resetCreateDraft = useCallback(() => {
    setDraftDay(null);
    setDraftTitle('');
    setDraftStartTime('09:00');
    setDraftEndTime('10:00');
    setCreateError(null);
  }, []);

  const submitCreateEvent = useCallback(async () => {
    if (!onCreateEvent || !draftDay || draftTitle.trim().length === 0) {
      return;
    }

    const startDate = new Date(`${draftDay}T${draftStartTime}:00`);
    const endDate = new Date(`${draftDay}T${draftEndTime}:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      setCreateError('End time must be after start time.');
      return;
    }

    setCreateError(null);
    setIsCreatingEvent(true);
    try {
      await onCreateEvent({
        title: draftTitle.trim(),
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
  }, [draftDay, draftEndTime, draftStartTime, draftTitle, onCreateEvent, resetCreateDraft, timezone]);

  return {
    draftDay,
    draftTitle,
    draftStartTime,
    draftEndTime,
    isCreatingEvent,
    createError,
    setDraftTitle,
    setDraftStartTime,
    setDraftEndTime,
    openCreatePanel,
    resetCreateDraft,
    submitCreateEvent,
  };
};
