import { useEffect, useMemo, useState } from 'react';
import { WidgetLoadingState } from '../WidgetFeedback';
import { cn } from '../../../lib/cn';
import { CalendarCreatePanel } from './CalendarCreatePanel';
import { CalendarLargeView } from './CalendarLargeView';
import { CalendarMediumWeekStrip } from './CalendarMediumWeekStrip';
import { CalendarSmallView } from './CalendarSmallView';
import { useCalendarCreatePanel } from './hooks/useCalendarCreatePanel';
import { useCalendarTierSelection } from './hooks/useCalendarTierSelection';
import type { CalendarWidgetSkinProps, CalendarScope, CalendarView, MediumWeekDay } from './types';
import { addDays, buildCalendarEventsByDate, formatWeekRangeLabel, fromLocalDateKey, toLocalDateKey } from './utils';

export type { CalendarScope } from './types';

export const CalendarWidgetSkin = ({
  events,
  loading,
  sizeTier,
  previewMode = false,
  scope,
  onScopeChange,
  onCreateEvent,
  onRescheduleEvent,
  onOpenRecord,
}: CalendarWidgetSkinProps) => {
  const tier = useCalendarTierSelection(sizeTier);
  const [view, setView] = useState<CalendarView>(() => (sizeTier === 'M' ? 'week' : 'month'));
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [todayDate, setTodayDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [mediumWeekAnchorDate, setMediumWeekAnchorDate] = useState(() => new Date());
  const todayKey = toLocalDateKey(todayDate);
  const selectedDateKey = toLocalDateKey(selectedDate);

  const {
    draftDay,
    draftTitle,
    draftStartTime,
    draftEndTime,
    draftPreview,
    isCreatingEvent,
    createError,
    setDraftTitle,
    setDraftStartTime,
    setDraftEndTime,
    openCreatePanel,
    resetCreateDraft,
    submitCreateEvent,
  } = useCalendarCreatePanel({ onCreateEvent });

  const eventsByDate = useMemo(() => buildCalendarEventsByDate(events), [events]);

  useEffect(() => {
    let timerId = 0;

    const scheduleNextMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime() + 1_000);
      timerId = window.setTimeout(() => {
        setTodayDate(new Date());
        scheduleNextMidnightRefresh();
      }, delay);
    };

    scheduleNextMidnightRefresh();
    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  const selectedIsVisibleInAnchor = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(mediumWeekAnchorDate, index - 3))).some(
        (dayKey) => dayKey === selectedDateKey,
      ),
    [mediumWeekAnchorDate, selectedDateKey],
  );

  const effectiveMediumWeekAnchorDate =
    tier === 'medium' && !selectedIsVisibleInAnchor ? selectedDate : mediumWeekAnchorDate;

  useEffect(() => {
    if (tier === 'medium' && !selectedIsVisibleInAnchor) {
      const timerId = window.setTimeout(() => {
        setMediumWeekAnchorDate(selectedDate);
      }, 0);
      return () => {
        window.clearTimeout(timerId);
      };
    }
    return undefined;
  }, [tier, selectedDate, selectedIsVisibleInAnchor]);

  const weekRangeLabel = formatWeekRangeLabel(effectiveMediumWeekAnchorDate);
  const mediumWeekDays = useMemo<MediumWeekDay[]>(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(effectiveMediumWeekAnchorDate, index - 3);
        const key = toLocalDateKey(date);
        return {
          key,
          date,
          dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
          dateLabel: date.toLocaleDateString(undefined, { day: 'numeric' }),
          isToday: key === todayKey,
          events: eventsByDate.get(key) ?? [],
        };
      }),
    [effectiveMediumWeekAnchorDate, eventsByDate, todayKey],
  );

  const createPanel = (
    <CalendarCreatePanel
      draftDay={draftDay}
      hasCreateHandler={Boolean(onCreateEvent)}
      draftTitle={draftTitle}
      draftStartTime={draftStartTime}
      draftEndTime={draftEndTime}
      draftPreview={draftPreview}
      isCreatingEvent={isCreatingEvent}
      createError={createError}
      onDraftTitleChange={setDraftTitle}
      onDraftStartTimeChange={setDraftStartTime}
      onDraftEndTimeChange={setDraftEndTime}
      onCancel={resetCreateDraft}
      onSubmit={submitCreateEvent}
    />
  );

  if (loading) {
    return <WidgetLoadingState label="Loading calendar" rows={5} />;
  }

  if (tier === 'small') {
    return (
      <CalendarSmallView
        sizeTier={sizeTier}
        selectedDate={selectedDate}
        onShiftSelectedDate={(days) => setSelectedDate((current) => addDays(current, days))}
        eventsByDate={eventsByDate}
        onOpenRecord={onOpenRecord}
        onCreateEvent={onCreateEvent}
        openCreatePanel={(day) => openCreatePanel(day)}
        createPanel={createPanel}
        previewMode={previewMode}
      />
    );
  }

  if (tier === 'large') {
    return (
      <CalendarLargeView
        events={events}
        sizeTier={sizeTier}
        previewMode={previewMode}
        scope={scope}
        onScopeChange={onScopeChange}
        view={view}
        setView={setView}
        monthCursor={monthCursor}
        setMonthCursor={setMonthCursor}
        onCreateEvent={onCreateEvent}
        onRescheduleEvent={onRescheduleEvent}
        onOpenRecord={onOpenRecord}
        eventsByDate={eventsByDate}
        selectedDate={selectedDate}
        todayDate={todayDate}
        todayKey={todayKey}
        openCreatePanel={openCreatePanel}
        createPanel={createPanel}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!previewMode ? <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <div role="group" aria-label="Calendar scope" className="flex items-center gap-0.5">
          {(['relevant', 'all'] as CalendarScope[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={scope === item}
              onClick={() => onScopeChange(item)}
              className={cn(
                'rounded-control border px-2.5 py-1.5 text-xs font-medium leading-[1.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                scope === item ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted',
              )}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div> : null}

      {!previewMode ? <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => {
            setMediumWeekAnchorDate(addDays(effectiveMediumWeekAnchorDate, -7));
            setSelectedDate((current) => addDays(current, -7));
          }}
          aria-label="Previous week"
        >
          ←
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold text-text">{weekRangeLabel}</p>
        <button
          type="button"
          className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => {
            setMediumWeekAnchorDate(addDays(effectiveMediumWeekAnchorDate, 7));
            setSelectedDate((current) => addDays(current, 7));
          }}
          aria-label="Next week"
        >
          →
        </button>
      </div> : null}

      <CalendarMediumWeekStrip
        weekDays={mediumWeekDays}
        selectedDayKey={selectedDateKey}
        onSelectDay={(dayKey) => setSelectedDate(fromLocalDateKey(dayKey))}
        onOpenRecord={onOpenRecord}
        onCreateEvent={!previewMode && onCreateEvent ? (dayKey) => openCreatePanel(dayKey) : undefined}
        previewMode={previewMode}
      />

      {!previewMode ? createPanel : null}
    </div>
  );
};
