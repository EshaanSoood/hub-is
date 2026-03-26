import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { ModuleEmptyState } from './ModuleFeedback';
import { cn } from '../../lib/cn';

const SLOT_MINUTES = 5;
const SLOT_COUNT_PER_DAY = (24 * 60) / SLOT_MINUTES;
const SLOT_CLASS_NAME = 'h-[calc(var(--day-hour-height)/12)]';

type DayBandId = 'night' | 'dawn' | 'midday' | 'afternoon' | 'evening';

type CalendarDayBand = {
  id: DayBandId;
  label: string;
  startMinute: number;
  endMinute: number;
  bandClassName: string;
  overlayPullClassName: string;
};

const DAY_BANDS: CalendarDayBand[] = [
  {
    id: 'night',
    label: 'Night',
    startMinute: 0,
    endMinute: 6 * 60,
    bandClassName: 'time-band-night',
    overlayPullClassName: '-mb-[calc(var(--day-hour-height)*6)]',
  },
  {
    id: 'dawn',
    label: 'Morning',
    startMinute: 6 * 60,
    endMinute: 12 * 60,
    bandClassName: 'time-band-dawn',
    overlayPullClassName: '-mb-[calc(var(--day-hour-height)*6)]',
  },
  {
    id: 'midday',
    label: 'Midday',
    startMinute: 12 * 60,
    endMinute: 16 * 60,
    bandClassName: 'time-band-midday',
    overlayPullClassName: '-mb-[calc(var(--day-hour-height)*4)]',
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    startMinute: 16 * 60,
    endMinute: 20 * 60,
    bandClassName: 'time-band-afternoon',
    overlayPullClassName: '-mb-[calc(var(--day-hour-height)*4)]',
  },
  {
    id: 'evening',
    label: 'Evening',
    startMinute: 20 * 60,
    endMinute: 24 * 60,
    bandClassName: 'time-band-evening',
    overlayPullClassName: '-mb-[calc(var(--day-hour-height)*4)]',
  },
];

type EventTypeKind = 'event' | 'task' | 'reminder';

export interface CalendarDayEvent {
  record_id: string;
  title: string;
  project_id?: string | null;
  project_name?: string | null;
  source_pane?: { pane_id: string | null; pane_name: string | null; doc_id: string | null } | null;
  item_kind?: EventTypeKind;
  event_state: {
    start_dt: string;
    end_dt: string;
    timezone: string;
    location: string | null;
    updated_at: string;
  };
}

interface CreateEventPrefillPayload {
  title: string;
  start_dt: string;
  end_dt: string;
  timezone: string;
  location?: string;
}

interface RescheduleEventPayload {
  record_id: string;
  start_dt: string;
  end_dt: string;
  timezone: string;
}

interface CalendarDayViewProps {
  events: CalendarDayEvent[];
  date?: Date;
  onOpenRecord: (recordId: string) => void;
  onCreateEvent?: (payload: CreateEventPrefillPayload) => void | Promise<void>;
  onRescheduleEvent?: (payload: RescheduleEventPayload) => void | Promise<void>;
}

type BandPreview = {
  bandId: DayBandId;
  startMinute: number;
};

type DayEventLayout = {
  event: CalendarDayEvent;
  startMinute: number;
  endMinute: number;
  durationSlots: number;
  gapSlots: number;
  kind: EventTypeKind;
  projectLabel: string;
  projectKey: string;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const startOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const isSameLocalDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

const toMinuteOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

const toIsoAtMinute = (dayStart: Date, minuteOfDay: number): string => {
  const next = new Date(dayStart);
  next.setMinutes(minuteOfDay, 0, 0);
  return next.toISOString();
};

const roundToNearestHalfHour = (minuteOfDay: number): number => {
  const rounded = Math.round(minuteOfDay / 30) * 30;
  return clamp(rounded, 0, (24 * 60) - 30);
};

const roundToNearestSlot = (minuteOfDay: number): number => {
  const rounded = Math.round(minuteOfDay / SLOT_MINUTES) * SLOT_MINUTES;
  return clamp(rounded, 0, (24 * 60) - SLOT_MINUTES);
};

const minutesToSlots = (minutes: number): number => Math.max(0, Math.round(minutes / SLOT_MINUTES));

const formatHourLabel = (hour: number): string => {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
};

const formatTimeLabel = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return '';
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatTimeLabelFromDate = (value: Date): string =>
  value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatDurationLabel = (minutes: number): string => {
  if (minutes <= 0) {
    return '(0m)';
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours > 0 && remainder > 0) {
    return `(${hours}h ${remainder}m)`;
  }
  if (hours > 0) {
    return `(${hours}h)`;
  }
  return `(${remainder}m)`;
};

const eventAccentClassName = (kind: EventTypeKind): string => {
  if (kind === 'task') {
    return 'border-l-[color:var(--color-primary-strong)]';
  }
  if (kind === 'reminder') {
    return 'border-l-[color:var(--color-capture-rail)]';
  }
  return 'border-l-[color:var(--color-primary)]';
};

const projectDotClassNames = [
  'bg-[color:var(--color-primary)]',
  'bg-[color:var(--color-primary-strong)]',
  'bg-[color:var(--color-capture-rail)]',
  'bg-[color:var(--color-text-secondary)]',
  'bg-[color:var(--color-muted)]',
];

const projectDotClassName = (projectKey: string): string => {
  if (!projectKey) {
    return projectDotClassNames[0] || 'bg-[color:var(--color-primary)]';
  }
  let hash = 0;
  for (let index = 0; index < projectKey.length; index += 1) {
    hash = (hash << 5) - hash + projectKey.charCodeAt(index);
    hash |= 0;
  }
  return projectDotClassNames[Math.abs(hash) % projectDotClassNames.length] || projectDotClassNames[0] || 'bg-[color:var(--color-primary)]';
};

const extractProjectLabel = (event: CalendarDayEvent): { projectLabel: string; projectKey: string } => {
  const projectLabel = event.project_name || event.source_pane?.pane_name || 'Calendar';
  const projectKey = event.project_id || event.source_pane?.pane_id || projectLabel;
  return { projectLabel, projectKey: projectKey ?? projectLabel };
};

const bandById = new Map<DayBandId, CalendarDayBand>(DAY_BANDS.map((band) => [band.id, band]));

const slotsFragment = (slotCount: number, keyPrefix: string): ReactElement | null => {
  if (slotCount <= 0) {
    return null;
  }
  return (
    <div aria-hidden="true" className="pointer-events-none">
      {Array.from({ length: slotCount }, (_, index) => (
        <div key={`${keyPrefix}-${index}`} className={SLOT_CLASS_NAME} />
      ))}
    </div>
  );
};

const pointerMinuteForBand = (
  clientY: number,
  bounds: DOMRect,
  band: CalendarDayBand,
): number => {
  const ratio = bounds.height > 0 ? clamp((clientY - bounds.top) / bounds.height, 0, 1) : 0;
  const rawMinute = band.startMinute + ratio * (band.endMinute - band.startMinute);
  return roundToNearestSlot(rawMinute);
};

const makeDroppableId = (bandId: DayBandId): string => `calendar-day-band:${bandId}`;

const readBandId = (id: UniqueIdentifier): DayBandId | null => {
  const raw = String(id);
  if (!raw.startsWith('calendar-day-band:')) {
    return null;
  }
  const bandId = raw.slice('calendar-day-band:'.length) as DayBandId;
  return bandById.has(bandId) ? bandId : null;
};

const makeDraggableId = (event: CalendarDayEvent): string =>
  `calendar-day-event:${event.record_id}:${event.event_state.start_dt}`;

const readRecordIdFromDraggable = (id: UniqueIdentifier): string | null => {
  const raw = String(id);
  if (!raw.startsWith('calendar-day-event:')) {
    return null;
  }
  const remainder = raw.slice('calendar-day-event:'.length);
  const splitIndex = remainder.indexOf(':');
  if (splitIndex <= 0) {
    return null;
  }
  return remainder.slice(0, splitIndex);
};

const DraggableEventCard = ({
  item,
  onOpenRecord,
}: {
  item: DayEventLayout;
  onOpenRecord: (recordId: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeDraggableId(item.event),
    data: {
      recordId: item.event.record_id,
      startMinute: item.startMinute,
      durationMinutes: item.endMinute - item.startMinute,
      timezone: item.event.event_state.timezone,
    },
  });

  const startLabel = formatTimeLabel(item.event.event_state.start_dt);
  const endLabel = formatTimeLabel(item.event.event_state.end_dt);
  const ariaLabel = `Event: ${item.event.title}, ${startLabel} to ${endLabel}`;
  const durationLabel = formatDurationLabel(item.endMinute - item.startMinute);

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-calendar-event-card="true"
      aria-label={ariaLabel}
      className={cn(
        'absolute inset-0 h-full w-full overflow-hidden rounded-panel border border-border-muted border-l-[3px] bg-surface px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        eventAccentClassName(item.kind),
        isDragging && 'opacity-70',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpenRecord(item.event.record_id);
      }}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-text">{item.event.title}</p>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-text">{startLabel} - {endLabel}</p>
          <p className="text-[11px] text-text-secondary">{durationLabel}</p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-text">
        <span className={cn('inline-block h-2.5 w-2.5 rounded-full', projectDotClassName(item.projectKey))} aria-hidden="true" />
        <span className="truncate">{item.projectLabel}</span>
      </p>
    </button>
  );
};

const BandSection = ({
  band,
  entries,
  onOpenRecord,
  onCreateFromMinute,
  hoverPreview,
  setHoverPreview,
  dragPreview,
}: {
  band: CalendarDayBand;
  entries: DayEventLayout[];
  onOpenRecord: (recordId: string) => void;
  onCreateFromMinute: (minute: number) => void;
  hoverPreview: BandPreview | null;
  setHoverPreview: (next: BandPreview | null) => void;
  dragPreview: BandPreview | null;
}) => {
  const headingId = `calendar-day-band-heading-${band.id}`;
  const { setNodeRef, isOver } = useDroppable({
    id: makeDroppableId(band.id),
    data: { bandId: band.id },
  });

  const bandSlots = minutesToSlots(band.endMinute - band.startMinute);

  let cursorMinute = band.startMinute;
  const eventRows: ReactElement[] = [];

  for (const entry of entries) {
    const startMinute = clamp(entry.startMinute, band.startMinute, band.endMinute);
    const endMinute = clamp(entry.endMinute, band.startMinute, band.endMinute);
    if (endMinute <= startMinute) {
      continue;
    }

    const gapSlots = minutesToSlots(startMinute - cursorMinute);
    if (gapSlots > 0) {
      eventRows.push(
        <div key={`gap-${entry.event.record_id}-${startMinute}`} aria-hidden="true" className="pointer-events-none">
          {slotsFragment(gapSlots, `gap-${band.id}-${entry.event.record_id}-${startMinute}`)}
        </div>,
      );
    }

    const durationSlots = minutesToSlots(endMinute - startMinute);

    eventRows.push(
      <div key={`${entry.event.record_id}-${entry.event.event_state.start_dt}`} className="relative">
        {slotsFragment(durationSlots, `duration-${band.id}-${entry.event.record_id}-${startMinute}`)}
        <DraggableEventCard
          item={{
            ...entry,
            startMinute,
            endMinute,
            durationSlots,
            gapSlots,
          }}
          onOpenRecord={onOpenRecord}
        />
      </div>,
    );

    cursorMinute = Math.max(cursorMinute, endMinute);
  }

  const trailingSlots = minutesToSlots(band.endMinute - cursorMinute);
  if (trailingSlots > 0) {
    eventRows.push(
      <div key={`trail-${band.id}`} aria-hidden="true" className="pointer-events-none">
        {slotsFragment(trailingSlots, `trail-${band.id}`)}
      </div>,
    );
  }

  const hoverPreviewForBand = hoverPreview?.bandId === band.id ? hoverPreview : null;
  const dragPreviewForBand = dragPreview?.bandId === band.id ? dragPreview : null;

  const previewStartMinute = (preview: BandPreview | null): number | null => {
    if (!preview) {
      return null;
    }
    return clamp(preview.startMinute, band.startMinute, Math.max(band.startMinute, band.endMinute - 60));
  };

  const renderPreviewLayer = (preview: BandPreview | null, keyPrefix: string, className: string): ReactElement | null => {
    const startMinute = previewStartMinute(preview);
    if (startMinute === null) {
      return null;
    }
    const topSlots = minutesToSlots(startMinute - band.startMinute);
    const previewSlots = minutesToSlots(60);
    const tailSlots = Math.max(0, bandSlots - topSlots - previewSlots);

    return (
      <div aria-hidden="true" className={cn('pointer-events-none relative z-0', band.overlayPullClassName)}>
        {slotsFragment(topSlots, `${keyPrefix}-top-${band.id}`)}
        <div className={className}>
          {slotsFragment(previewSlots, `${keyPrefix}-body-${band.id}`)}
        </div>
        {slotsFragment(tailSlots, `${keyPrefix}-tail-${band.id}`)}
      </div>
    );
  };

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'relative border-b border-border-muted/50 pb-3 pl-0 pr-3 pt-0',
        band.bandClassName,
        isOver && 'ring-1 ring-[color:var(--color-primary)]',
      )}
      onPointerMove={(event) => {
        if (!(event.currentTarget instanceof HTMLElement)) {
          return;
        }
        const card = (event.target as Element | null)?.closest('[data-calendar-event-card="true"]');
        if (card) {
          setHoverPreview(null);
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        const minute = pointerMinuteForBand(event.clientY, bounds, band);
        setHoverPreview({ bandId: band.id, startMinute: roundToNearestHalfHour(minute) });
      }}
      onPointerLeave={() => {
        if (hoverPreview?.bandId === band.id) {
          setHoverPreview(null);
        }
      }}
      onPointerUp={(event) => {
        const card = (event.target as Element | null)?.closest('[data-calendar-event-card="true"]');
        if (card) {
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        const minute = pointerMinuteForBand(event.clientY, bounds, band);
        onCreateFromMinute(roundToNearestHalfHour(minute));
      }}
    >
      <div className="pointer-events-none absolute right-3 top-0 z-20 -translate-y-1/2">
        <h3 id={headingId} className="text-xs text-text-secondary [font-family:var(--font-heading)]">
          {band.label}
        </h3>
      </div>
      {renderPreviewLayer(hoverPreviewForBand, 'hover-preview', 'rounded-panel border border-dashed border-border-muted/50 bg-surface/20')}
      {renderPreviewLayer(dragPreviewForBand, 'drag-preview', 'rounded-panel border border-dashed border-primary/70 bg-primary/10')}
      <div className="relative z-10">{eventRows}</div>
    </section>
  );
};

export const CalendarDayView = ({
  events,
  onOpenRecord,
  onCreateEvent,
  onRescheduleEvent,
  date = new Date(),
}: CalendarDayViewProps) => {
  const [now, setNow] = useState(() => new Date());
  const [liveTimeAnnouncement, setLiveTimeAnnouncement] = useState('');
  const [hoverPreview, setHoverPreview] = useState<BandPreview | null>(null);
  const [dragPreview, setDragPreview] = useState<BandPreview | null>(null);
  const [activeDraggedRecordId, setActiveDraggedRecordId] = useState<string | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const nowNeedleRef = useRef<HTMLDivElement | null>(null);
  const autoScrollDoneRef = useRef(false);

  const dayStart = useMemo(() => startOfLocalDay(date), [date]);
  const dayKey = useMemo(() => toLocalDateKey(dayStart), [dayStart]);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setLiveTimeAnnouncement(`Current time: ${formatTimeLabelFromDate(now)}`);
  }, [now]);

  const dayEvents = useMemo(() => {
    const next: DayEventLayout[] = [];

    for (const event of events) {
      const start = parseIsoDate(event.event_state.start_dt);
      const end = parseIsoDate(event.event_state.end_dt);
      if (!start || !end) {
        continue;
      }
      if (!isSameLocalDay(start, dayStart)) {
        continue;
      }

      const { projectLabel, projectKey } = extractProjectLabel(event);
      const startMinute = clamp(toMinuteOfDay(start), 0, (24 * 60) - SLOT_MINUTES);
      const endMinute = clamp(toMinuteOfDay(end), startMinute + SLOT_MINUTES, 24 * 60);

      next.push({
        event,
        startMinute,
        endMinute,
        durationSlots: minutesToSlots(endMinute - startMinute),
        gapSlots: 0,
        kind: event.item_kind ?? 'event',
        projectLabel,
        projectKey,
      });
    }

    return next.sort((left, right) => {
      if (left.startMinute !== right.startMinute) {
        return left.startMinute - right.startMinute;
      }
      return left.event.record_id.localeCompare(right.event.record_id);
    });
  }, [dayStart, events]);

  const dayEventsByBand = useMemo(() => {
    const next = new Map<DayBandId, DayEventLayout[]>();
    for (const band of DAY_BANDS) {
      next.set(band.id, []);
    }

    for (const entry of dayEvents) {
      const band = DAY_BANDS.find((candidate) => entry.startMinute >= candidate.startMinute && entry.startMinute < candidate.endMinute);
      if (!band) {
        continue;
      }
      const rows = next.get(band.id);
      if (!rows) {
        continue;
      }
      rows.push(entry);
    }

    for (const band of DAY_BANDS) {
      const rows = next.get(band.id) ?? [];
      rows.sort((left, right) => left.startMinute - right.startMinute);
      next.set(band.id, rows);
    }

    return next;
  }, [dayEvents]);

  const eventByRecordId = useMemo(() => {
    const map = new Map<string, DayEventLayout>();
    for (const entry of dayEvents) {
      map.set(entry.event.record_id, entry);
    }
    return map;
  }, [dayEvents]);

  const nowIsCurrentDay = isSameLocalDay(now, dayStart);
  const nowMinute = clamp(toMinuteOfDay(now), 0, (24 * 60) - SLOT_MINUTES);
  const nowSlots = minutesToSlots(nowMinute);
  const trailingNowSlots = Math.max(0, SLOT_COUNT_PER_DAY - nowSlots);

  useEffect(() => {
    if (!nowIsCurrentDay) {
      autoScrollDoneRef.current = false;
      return;
    }

    if (autoScrollDoneRef.current) {
      return;
    }

    let frameId = 0;
    const alignToNow = () => {
      const viewport = scrollViewportRef.current;
      const needle = nowNeedleRef.current;
      if (!viewport || !needle) {
        frameId = window.requestAnimationFrame(alignToNow);
        return;
      }
      if (viewport.clientHeight <= 0 || viewport.scrollHeight <= 0) {
        frameId = window.requestAnimationFrame(alignToNow);
        return;
      }

      const targetScrollTop = needle.offsetTop - (viewport.clientHeight * 0.25);
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = clamp(targetScrollTop, 0, maxScrollTop);
      autoScrollDoneRef.current = true;
    };

    frameId = window.requestAnimationFrame(alignToNow);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [dayStart, nowIsCurrentDay]);

  const createAtMinute = (rawMinute: number) => {
    if (!onCreateEvent) {
      return;
    }
    const startMinute = roundToNearestHalfHour(rawMinute);
    const endMinute = Math.min(24 * 60, startMinute + 60);

    void onCreateEvent({
      title: '',
      start_dt: toIsoAtMinute(dayStart, startMinute),
      end_dt: toIsoAtMinute(dayStart, endMinute),
      timezone,
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const dragPreviewFromEvent = (event: DragMoveEvent | DragEndEvent): BandPreview | null => {
    const overBandId = event.over ? readBandId(event.over.id) : null;
    if (!overBandId) {
      return null;
    }
    const overBand = bandById.get(overBandId);
    if (!overBand || !event.over?.rect) {
      return null;
    }

    const activeRect = event.active.rect.current.translated ?? event.active.rect.current.initial;
    if (!activeRect) {
      return null;
    }

    const pointerY = activeRect.top + (activeRect.height / 2);
    const relativeY = clamp(pointerY - event.over.rect.top, 0, event.over.rect.height);
    const ratio = event.over.rect.height > 0 ? relativeY / event.over.rect.height : 0;
    const minute = overBand.startMinute + ratio * (overBand.endMinute - overBand.startMinute);

    return {
      bandId: overBandId,
      startMinute: roundToNearestHalfHour(minute),
    };
  };

  const onDragStart = (event: DragStartEvent) => {
    const recordId = readRecordIdFromDraggable(event.active.id);
    setActiveDraggedRecordId(recordId);
    setHoverPreview(null);
  };

  const onDragMove = (event: DragMoveEvent) => {
    setDragPreview(dragPreviewFromEvent(event));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const recordId = readRecordIdFromDraggable(event.active.id);
    const preview = dragPreviewFromEvent(event);

    setDragPreview(null);
    setActiveDraggedRecordId(null);

    if (!recordId || !preview) {
      return;
    }

    const source = eventByRecordId.get(recordId);
    if (!source) {
      return;
    }

    const durationMinutes = Math.max(SLOT_MINUTES, source.endMinute - source.startMinute);
    const startMinute = clamp(preview.startMinute, 0, Math.max(0, (24 * 60) - durationMinutes));
    const endMinute = Math.min(24 * 60, startMinute + durationMinutes);

    if (startMinute === source.startMinute && endMinute === source.endMinute) {
      return;
    }

    const nextPayload: RescheduleEventPayload = {
      record_id: source.event.record_id,
      start_dt: toIsoAtMinute(dayStart, startMinute),
      end_dt: toIsoAtMinute(dayStart, endMinute),
      timezone: source.event.event_state.timezone || timezone,
    };

    if (onRescheduleEvent) {
      void onRescheduleEvent(nextPayload);
      return;
    }

    onOpenRecord(source.event.record_id);
  };

  const dayLabel = dayStart.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      role="region"
      tabIndex={-1}
      aria-label={`Day view, ${dayLabel}`}
      className="space-y-3"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveTimeAnnouncement}
      </p>

      {dayEvents.length === 0 ? (
        <div className="rounded-panel border border-border-muted bg-surface p-6">
          <ModuleEmptyState title="No events today" description="Create an event to plan this day." />
          {onCreateEvent ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => createAtMinute(9 * 60)}
                className="rounded-control border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Create event
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragPreview(null);
            setActiveDraggedRecordId(null);
          }}
        >
          <div
            ref={scrollViewportRef}
            className="max-h-[70vh] overflow-y-auto rounded-panel border border-border-muted bg-surface-elevated"
          >
            <div className="px-2 py-2">
              {nowIsCurrentDay ? (
                <div aria-hidden="true" className="pointer-events-none relative z-20 -mb-[calc(var(--day-hour-height)*24+2px)]">
                  <div className="grid grid-cols-[var(--day-ruler-width)_minmax(0,1fr)]">
                    <div>
                      {slotsFragment(nowSlots, `needle-ruler-top-${dayKey}`)}
                      <div className="flex h-[2px] items-center justify-end">
                        <span className="mr-[-5px] inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                      </div>
                      {slotsFragment(trailingNowSlots, `needle-ruler-tail-${dayKey}`)}
                    </div>
                    <div>
                      {slotsFragment(nowSlots, `needle-main-top-${dayKey}`)}
                      <div ref={nowNeedleRef} className="h-[2px] w-full bg-primary" />
                      {slotsFragment(trailingNowSlots, `needle-main-tail-${dayKey}`)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-[var(--day-ruler-width)_minmax(0,1fr)]">
                <div className="border-r border-[color:var(--color-day-ruler)]">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={`hour-${hour}`} className="relative h-[var(--day-hour-height)]">
                      <div className="absolute right-0 top-2 flex items-center">
                        <span className="pr-2 text-xs text-[color:var(--color-day-ruler-tick)] [font-family:var(--font-heading)]">
                          {formatHourLabel(hour)}
                        </span>
                        <span className="h-px w-2 bg-[color:var(--color-day-ruler)]" aria-hidden="true" />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  {DAY_BANDS.map((band) => (
                    <BandSection
                      key={band.id}
                      band={band}
                      entries={dayEventsByBand.get(band.id) ?? []}
                      onOpenRecord={onOpenRecord}
                      onCreateFromMinute={createAtMinute}
                      hoverPreview={hoverPreview}
                      setHoverPreview={setHoverPreview}
                      dragPreview={activeDraggedRecordId ? dragPreview : null}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DndContext>
      )}
    </div>
  );
};
