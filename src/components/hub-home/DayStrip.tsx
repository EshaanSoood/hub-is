import { type DragEvent, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import type {
  BacklogDragPayload,
  DayStripEventItem,
  DayStripReminderItem,
  DayStripTaskItem,
  TimelineTypeFilter,
} from './types';
import { HUB_BACKLOG_DRAG_MIME } from './types';
import {
  DAY_STRIP_FORWARD_WINDOW_MS,
  DAY_STRIP_HOUR_MS,
  DAY_STRIP_KEYBOARD_SLOT_MS,
} from './dayStripWindow';

const ITEM_MIN_WIDTH_PX = 180;
const ITEM_TITLE_MAX_CHARS = 30;
const EMPTY_DAY_PROMPT_TITLE = 'Chill day ahead?';
const EMPTY_DAY_PROMPT_BODY = 'Drag tasks over to the timeline to sketch your day.';

const parseIso = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const formatHourLabel = (date: Date): string => {
  const hour = date.getHours();
  const suffix = hour >= 12 ? 'p' : 'a';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
};

const formatTimeLabel = (date: Date): string =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatDateMarker = (date: Date): string =>
  date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });

const truncateTimelineTitle = (title: string): string =>
  title.length > ITEM_TITLE_MAX_CHARS ? `${title.slice(0, ITEM_TITLE_MAX_CHARS)}…` : title;

type TimelineEvent = {
  id: string;
  kind: 'event';
  recordId: string;
  title: string;
  startMs: number;
  endMs: number;
};

type TimelineTask = {
  id: string;
  kind: 'task';
  recordId: string;
  title: string;
  timeMs: number;
  status: DayStripTaskItem['status'];
};

type TimelineReminder = {
  id: string;
  kind: 'reminder';
  reminderId: string;
  recordId: string;
  title: string;
  timeMs: number;
  dismissed: boolean;
};

type TimelineItem = TimelineEvent | TimelineTask | TimelineReminder;

const isValidDragPayload = (value: unknown): value is BacklogDragPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'task') {
    return typeof candidate.recordId === 'string' && candidate.recordId.length > 0;
  }
  if (candidate.kind === 'reminder') {
    return typeof candidate.reminderId === 'string' && candidate.reminderId.length > 0;
  }
  return false;
};

export const DayStrip = ({
  className,
  events,
  tasks,
  reminders,
  typeFilter,
  onOpenRecord,
  onDropFromBacklog,
  showEmptyTimeline = false,
  keyboardDragItem = null,
  onKeyboardDragAnnouncement,
  onKeyboardDrop,
  onKeyboardCancel,
  focusViewportKey = 0,
  presentation = 'full',
}: {
  className?: string;
  events: DayStripEventItem[];
  tasks: DayStripTaskItem[];
  reminders: DayStripReminderItem[];
  typeFilter: TimelineTypeFilter;
  onOpenRecord: (recordId: string) => void;
  onDropFromBacklog?: (payload: BacklogDragPayload, assignedAt: Date) => void | Promise<void>;
  showEmptyTimeline?: boolean;
  keyboardDragItem?: { title: string } | null;
  onKeyboardDragAnnouncement?: (message: string) => void;
  onKeyboardDrop?: (assignedAt: Date) => void | Promise<void>;
  onKeyboardCancel?: () => void;
  focusViewportKey?: number;
  presentation?: 'full' | 'collapsed-empty';
}) => {
  const [now, setNow] = useState(() => new Date());
  const [dragOver, setDragOver] = useState(false);
  const [keyboardTargetIndexOverride, setKeyboardTargetIndexOverride] = useState<number | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const nowNeedleRef = useRef<HTMLDivElement | null>(null);
  const keyboardSlotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const autoScrollKeyRef = useRef<string>('');
  const stripId = useId();
  const earlierLabelId = `${stripId}-earlier`;
  const upcomingLabelId = `${stripId}-upcoming`;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const timelineItems = useMemo(() => {
    const next: TimelineItem[] = [];

    if (typeFilter === 'all' || typeFilter === 'events') {
      for (const event of events) {
        const start = parseIso(event.startAtIso);
        const end = parseIso(event.endAtIso);
        if (!start || !end) {
          continue;
        }
        next.push({
          id: event.id,
          kind: 'event',
          recordId: event.recordId,
          title: event.title,
          startMs: start.getTime(),
          endMs: end.getTime(),
        });
      }
    }

    if (typeFilter === 'all' || typeFilter === 'tasks') {
      for (const task of tasks) {
        const due = parseIso(task.dueAtIso);
        if (!due) {
          continue;
        }
        next.push({
          id: task.id,
          kind: 'task',
          recordId: task.recordId,
          title: task.title,
          timeMs: due.getTime(),
          status: task.status,
        });
      }
    }

    if (typeFilter === 'all' || typeFilter === 'reminders') {
      for (const reminder of reminders) {
        const remindAt = parseIso(reminder.remindAtIso);
        if (!remindAt) {
          continue;
        }
        next.push({
          id: reminder.id,
          kind: 'reminder',
          reminderId: reminder.reminderId,
          recordId: reminder.recordId,
          title: reminder.title,
          timeMs: remindAt.getTime(),
          dismissed: reminder.dismissed,
        });
      }
    }

    return next.sort((left, right) => {
      const leftAnchor = left.kind === 'event' ? left.startMs : left.timeMs;
      const rightAnchor = right.kind === 'event' ? right.startMs : right.timeMs;
      if (leftAnchor !== rightAnchor) {
        return leftAnchor - rightAnchor;
      }
      return left.id.localeCompare(right.id);
    });
  }, [events, reminders, tasks, typeFilter]);
  const hasNoScheduledItems = timelineItems.length === 0;

  const range = useMemo(() => {
    const nowMs = now.getTime();
    const defaultStart = nowMs;
    const defaultEnd = nowMs + DAY_STRIP_FORWARD_WINDOW_MS;
    if (timelineItems.length === 0) {
      return { startMs: defaultStart, endMs: defaultEnd };
    }

    const earliest = timelineItems.reduce((acc, item) => {
      const next = item.kind === 'event' ? item.startMs : item.timeMs;
      return Math.min(acc, next);
    }, Number.POSITIVE_INFINITY);

    const latest = timelineItems.reduce((acc, item) => {
      const next = item.kind === 'event' ? item.endMs : item.timeMs;
      return Math.max(acc, next);
    }, Number.NEGATIVE_INFINITY);

    const startMs = earliest < nowMs ? Math.min(defaultStart, earliest - DAY_STRIP_HOUR_MS) : defaultStart;
    const endMs = latest > defaultEnd ? latest + DAY_STRIP_HOUR_MS : defaultEnd;
    return { startMs, endMs };
  }, [now, timelineItems]);

  const totalMs = Math.max(DAY_STRIP_HOUR_MS, range.endMs - range.startMs);
  const nowPercent = clamp(((now.getTime() - range.startMs) / totalMs) * 100, 0, 100);
  const spanHours = totalMs / DAY_STRIP_HOUR_MS;
  const baseWidthPx = Math.max(720, Math.ceil(spanHours * 90));
  const widthPx = baseWidthPx;
  const showTimeline = showEmptyTimeline || timelineItems.length > 0;
  const useCollapsedEmptyPresentation = presentation === 'collapsed-empty' && hasNoScheduledItems && showTimeline;

  const ticks = useMemo(() => {
    const first = new Date(range.startMs);
    first.setMinutes(0, 0, 0);
    if (first.getTime() < range.startMs) {
      first.setHours(first.getHours() + 1);
    }
    const next: Array<{ key: string; ms: number; major: boolean; midnight: boolean; label: string }> = [];
    for (let current = new Date(first); current.getTime() <= range.endMs; current.setHours(current.getHours() + 1)) {
      const ms = current.getTime();
      const major = current.getHours() % 3 === 0;
      next.push({
        key: current.toISOString(),
        ms,
        major,
        midnight: current.getHours() === 0,
        label: major ? formatHourLabel(current) : '',
      });
    }
    return next;
  }, [range.endMs, range.startMs]);

  const markerLaneById = useMemo(() => {
    const markers = timelineItems.filter((item) => item.kind !== 'event');
    return new Map(markers.map((item, index) => [item.id, index % 2]));
  }, [timelineItems]);

  const orderedIds = useMemo(() => timelineItems.map((item) => item.id), [timelineItems]);
  const orderedIdIndex = useMemo(() => new Map(orderedIds.map((id, index) => [id, index])), [orderedIds]);

  const percentForMs = (ms: number): number => clamp(((ms - range.startMs) / totalMs) * 100, 0, 100);

  useEffect(() => {
    if (hasNoScheduledItems) {
      autoScrollKeyRef.current = '';
      return;
    }

    const rangeKey = `${range.startMs}:${range.endMs}:${timelineItems.length}`;
    if (autoScrollKeyRef.current === rangeKey) {
      return;
    }

    let frameId = 0;
    const alignNowNeedle = () => {
      const viewport = scrollViewportRef.current;
      const timeline = timelineRef.current;
      const nowNeedle = nowNeedleRef.current;
      if (!viewport || !timeline || !nowNeedle) {
        frameId = window.requestAnimationFrame(alignNowNeedle);
        return;
      }
      if (viewport.scrollWidth <= 0 || viewport.clientWidth <= 0) {
        frameId = window.requestAnimationFrame(alignNowNeedle);
        return;
      }
      const computedStyle = window.getComputedStyle(viewport);
      const viewportPaddingLeft = Number.parseFloat(computedStyle.paddingLeft || '0') || 0;
      const nowPixel = viewportPaddingLeft + nowNeedle.offsetLeft + nowNeedle.offsetWidth / 2;
      const targetScrollLeft = nowPixel - viewport.clientWidth * 0.25;
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      viewport.scrollLeft = clamp(targetScrollLeft, 0, maxScrollLeft);
      autoScrollKeyRef.current = rangeKey;
    };

    frameId = window.requestAnimationFrame(alignNowNeedle);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [hasNoScheduledItems, nowPercent, range.endMs, range.startMs, timelineItems.length, widthPx]);

  const keyboardSlots = useMemo(() => {
    const slotCount = Math.max(1, Math.floor(totalMs / DAY_STRIP_KEYBOARD_SLOT_MS) + 1);
    return Array.from({ length: slotCount }, (_, index) => {
      const ms = clamp(range.startMs + index * DAY_STRIP_KEYBOARD_SLOT_MS, range.startMs, range.endMs);
      return {
        index,
        ms,
        label: formatTimeLabel(new Date(ms)),
      };
    });
  }, [range.endMs, range.startMs, totalMs]);

  const keyboardDefaultIndex = useMemo(() => {
    if (keyboardSlots.length === 0) {
      return 0;
    }
    return keyboardSlots.reduce((closestIndex, slot, index, allSlots) => {
      const currentDistance = Math.abs(slot.ms - now.getTime());
      const closestSlotMs = allSlots[closestIndex]?.ms ?? slot.ms;
      const closestDistance = Math.abs(closestSlotMs - now.getTime());
      return currentDistance < closestDistance ? index : closestIndex;
    }, 0);
  }, [keyboardSlots, now]);

  const keyboardTargetIndex = keyboardTargetIndexOverride ?? keyboardDefaultIndex;

  useEffect(() => {
    if (keyboardDragItem) {
      keyboardSlotRefs.current[keyboardTargetIndex]?.focus();
      const activeSlot = keyboardSlots[keyboardTargetIndex];
      if (activeSlot) {
        onKeyboardDragAnnouncement?.(activeSlot.label);
      }
    }
  }, [keyboardDragItem, keyboardSlots, keyboardTargetIndex, onKeyboardDragAnnouncement]);

  useEffect(() => {
    if (focusViewportKey <= 0) {
      return;
    }
    scrollViewportRef.current?.focus();
  }, [focusViewportKey]);

  const handleItemKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const currentIndex = orderedIdIndex.get(id);
    if (typeof currentIndex !== 'number') {
      return;
    }
    const nextIndex = event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= orderedIds.length) {
      return;
    }
    const targetId = orderedIds[nextIndex];
    if (!targetId) {
      return;
    }
    itemRefs.current[targetId]?.focus();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!onDropFromBacklog || !timelineRef.current) {
      return;
    }
    event.preventDefault();
    setDragOver(false);
    const payloadRaw = event.dataTransfer.getData(HUB_BACKLOG_DRAG_MIME);
    if (!payloadRaw) {
      return;
    }
    let payloadParsed: unknown = null;
    try {
      payloadParsed = JSON.parse(payloadRaw);
    } catch {
      return;
    }
    if (!isValidDragPayload(payloadParsed)) {
      return;
    }
    const bounds = timelineRef.current.getBoundingClientRect();
    const relativeX = clamp(event.clientX - bounds.left, 0, bounds.width);
    const ratio = bounds.width > 0 ? relativeX / bounds.width : 0;
    const assignedAt = new Date(range.startMs + ratio * totalMs);
    void onDropFromBacklog(payloadParsed, assignedAt);
  };

  const updateKeyboardTargetIndex = (nextIndex: number) => {
    const clampedIndex = clamp(nextIndex, 0, keyboardSlots.length - 1);
    setKeyboardTargetIndexOverride(clampedIndex);
  };

  const handleKeyboardSlotKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!keyboardDragItem) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateKeyboardTargetIndex(keyboardTargetIndex + 1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updateKeyboardTargetIndex(keyboardTargetIndex - 1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateKeyboardTargetIndex(keyboardTargetIndex + 4);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateKeyboardTargetIndex(keyboardTargetIndex - 4);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const slot = keyboardSlots[keyboardTargetIndex];
      if (slot) {
        void onKeyboardDrop?.(new Date(slot.ms));
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onKeyboardCancel?.();
    }
  };

  const nowMs = now.getTime();
  const earlierItems = timelineItems.filter((item) => (item.kind === 'event' ? item.startMs < nowMs : item.timeMs < nowMs));
  const upcomingItems = timelineItems.filter((item) => (item.kind === 'event' ? item.startMs >= nowMs : item.timeMs >= nowMs));

  const renderTimelineItem = (item: TimelineItem) => {
    if (item.kind === 'event') {
      const left = percentForMs(item.startMs);
      const right = percentForMs(item.endMs);
      const width = Math.max(0.9, right - left);
      const widthPxForEvent = Math.max(ITEM_MIN_WIDTH_PX, (width / 100) * widthPx);
      const inPast = item.endMs < nowMs;
      const clippedRight = item.endMs > range.endMs;
      const startText = formatTimeLabel(new Date(item.startMs));
      const endText = formatTimeLabel(new Date(item.endMs));
      const titleForDisplay = truncateTimelineTitle(item.title);

      return (
        <button
          key={item.id}
          ref={(node) => {
            itemRefs.current[item.id] = node;
          }}
          type="button"
          tabIndex={-1}
          aria-label={`Event: ${item.title} from ${startText} to ${endText}`}
          className={`absolute top-[46px] h-8 rounded-control border px-2 text-left text-xs font-medium ${
            inPast
              ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-on-primary opacity-60'
              : 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-on-primary'
          }`}
          style={{ left: `${left}%`, width: `${widthPxForEvent}px` }}
          onClick={() => onOpenRecord(item.recordId)}
          onKeyDown={(event) => handleItemKeyDown(event, item.id)}
        >
          <span className="block truncate">
            {titleForDisplay}
            {clippedRight ? ' →' : ''}
          </span>
        </button>
      );
    }

    const timeMs = item.timeMs;
    const lane = markerLaneById.get(item.id) ?? 0;
    const markerTop = lane === 0 ? 22 : 86;
    const labelTop = lane === 0 ? 2 : 104;
    const left = percentForMs(timeMs);
    const timeLabel = formatTimeLabel(new Date(timeMs));
    const titleForDisplay = truncateTimelineTitle(item.title);

    if (item.kind === 'task') {
      const complete = item.status === 'done' || item.status === 'cancelled';
      const overdue = !complete && timeMs < nowMs;

      return (
        <div key={item.id} className="absolute w-[180px] -translate-x-1/2" style={{ left: `${left}%` }}>
          <button
            ref={(node) => {
              itemRefs.current[item.id] = node;
            }}
            type="button"
            tabIndex={-1}
            aria-label={`Task: ${item.title} at ${timeLabel}`}
            className={`absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 p-0 [border-radius:9999px] ${
              overdue
                ? 'border-danger bg-danger text-on-primary'
                : 'border-[color:var(--color-primary-strong)] bg-[color:var(--color-primary-strong)] text-on-primary'
            }`}
            style={{ top: `${markerTop}px` }}
            onClick={() => onOpenRecord(item.recordId)}
            onKeyDown={(event) => handleItemKeyDown(event, item.id)}
          >
            {complete ? <span className="absolute inset-0 grid place-items-center text-[9px] leading-none">✓</span> : null}
          </button>
          <span
            className="absolute top-0 block w-full truncate text-center text-[11px] text-text"
            style={{ top: `${labelTop}px` }}
            title={item.title}
          >
            {titleForDisplay}
          </span>
        </div>
      );
    }

    const pastUndismissed = !item.dismissed && timeMs < nowMs;
    const settledDismissed = item.dismissed && timeMs < nowMs;
    return (
      <div key={item.id} className="absolute w-[180px] -translate-x-1/2" style={{ left: `${left}%` }}>
        <button
          ref={(node) => {
            itemRefs.current[item.id] = node;
          }}
          type="button"
          tabIndex={-1}
          aria-label={`Reminder: ${item.title} at ${timeLabel}`}
          className={`absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-2 ${
            settledDismissed
              ? 'border-[color:var(--color-capture-rail)] bg-[color:var(--color-capture-rail)] opacity-40'
              : pastUndismissed
                  ? 'border-danger bg-[color:var(--color-capture-rail)]'
                  : 'border-[color:var(--color-capture-rail)] bg-[color:var(--color-capture-rail)]'
          }`}
          style={{ top: `${markerTop}px` }}
          onClick={() => onOpenRecord(item.recordId)}
          onKeyDown={(event) => handleItemKeyDown(event, item.id)}
        />
        <span
          className="absolute top-0 block w-full truncate text-center text-[11px] text-text"
          style={{ top: `${labelTop}px` }}
          title={item.title}
        >
          {titleForDisplay}
        </span>
      </div>
    );
  };

  if (useCollapsedEmptyPresentation) {
    return (
      <div className={cn('grid gap-[var(--daily-brief-collapsed-stack-gap)]', className)}>
        <div
          ref={timelineRef}
          data-testid="daily-brief-collapsed-strip"
          className={cn(
            'paper-well flex min-h-[var(--daily-brief-collapsed-timeline-height)] items-center overflow-hidden rounded-panel px-4 py-3 transition-colors',
            dragOver && 'bg-primary/6',
          )}
          onDragOver={(event) => {
            if (!onDropFromBacklog) {
              return;
            }
            event.preventDefault();
            setDragOver(true);
            event.dataTransfer.dropEffect = 'move';
          }}
          onDragLeave={() => {
            setDragOver(false);
          }}
          onDrop={handleDrop}
        >
          <div aria-hidden="true" className="flex w-full items-center">
            <span className="h-6 w-px bg-border-muted" />
            <span className="h-px flex-1 bg-border-muted/70" />
            <span className="h-6 w-px bg-border-muted" />
          </div>
        </div>

        <div className="mx-auto max-w-[var(--daily-brief-prompt-max-width)] px-3 text-center">
          <p className="text-sm font-semibold text-text">{EMPTY_DAY_PROMPT_TITLE}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{EMPTY_DAY_PROMPT_BODY}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-panel bg-surface-low p-2 shadow-soft-subtle', className)}>
      {!showTimeline ? (
        <div className="paper-well flex h-20 items-center justify-center px-4 text-center">
          <div>
            <p className="text-sm font-semibold text-text">{EMPTY_DAY_PROMPT_TITLE}</p>
            <p className="mt-1 text-xs text-text-secondary">{EMPTY_DAY_PROMPT_BODY}</p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollViewportRef}
          tabIndex={-1}
          className="overflow-x-auto px-[96px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            ref={timelineRef}
            data-testid="daily-brief-timeline"
            className="relative h-[146px] min-w-full select-none"
            style={{ width: `${widthPx}px` }}
            onDragOver={(event) => {
              if (!onDropFromBacklog) {
                return;
              }
              event.preventDefault();
              setDragOver(true);
              event.dataTransfer.dropEffect = 'move';
            }}
            onDragLeave={() => {
              setDragOver(false);
            }}
            onDrop={handleDrop}
          >
            <div
              className={`absolute inset-x-0 top-10 h-12 rounded-control bg-surface/90 transition-colors ${
                dragOver
                  ? 'ghost-button bg-primary/10'
                  : 'ghost-button'
              }`}
            />
            <div className="absolute bottom-7 left-0 right-0 border-t border-border-muted" />
            <div
              ref={nowNeedleRef}
              aria-hidden="true"
              className="absolute bottom-7 top-4 w-[2px] rounded-full bg-text"
              style={{ left: `${nowPercent}%` }}
            />

            {ticks.map((tick) => {
              const left = percentForMs(tick.ms);
              return (
                <div key={tick.key} className="absolute bottom-0 -translate-x-1/2" style={{ left: `${left}%` }}>
                  <span
                    className={`absolute bottom-7 left-1/2 -translate-x-1/2 ${tick.midnight ? 'h-5 w-0.5 bg-border-strong' : tick.major ? 'h-4 w-px bg-border-strong' : 'h-2.5 w-px bg-border-muted'}`}
                    aria-hidden="true"
                  />
                  {tick.label ? <span className="text-[11px] text-text-secondary">{tick.label}</span> : null}
                  {tick.midnight ? (
                    <span className="ml-1 text-[11px] text-text-secondary">{formatDateMarker(new Date(tick.ms))}</span>
                  ) : null}
                </div>
              );
            })}

            <h3 id={earlierLabelId} className="sr-only">Earlier today</h3>
            <div aria-labelledby={earlierLabelId}>
              {earlierItems.map((item) => renderTimelineItem(item))}
            </div>
            <h3 id={upcomingLabelId} className="sr-only">Upcoming</h3>
            <div aria-labelledby={upcomingLabelId}>
              {upcomingItems.map((item) => renderTimelineItem(item))}
            </div>

            {keyboardDragItem ? (
              <div
                aria-label={`Schedule ${keyboardDragItem.title}`}
                className="absolute inset-x-0 top-10 h-12"
                data-testid="daily-brief-keyboard-dropzone"
                role="group"
              >
                <div className="flex h-full">
                  {keyboardSlots.map((slot, index) => {
                    const active = index === keyboardTargetIndex;
                    return (
                      <button
                        key={slot.ms}
                        ref={(node) => {
                          keyboardSlotRefs.current[index] = node;
                        }}
                        type="button"
                        tabIndex={active ? 0 : -1}
                        aria-label={`Choose ${slot.label}`}
                        aria-current={active ? 'true' : undefined}
                        className={`relative h-full flex-1 border-r border-border-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                          active ? 'bg-primary/12' : 'bg-transparent'
                        }`}
                        onFocus={() => {
                          setKeyboardTargetIndexOverride(index);
                        }}
                        onKeyDown={handleKeyboardSlotKeyDown}
                        onClick={() => {
                          void onKeyboardDrop?.(new Date(slot.ms));
                        }}
                      >
                        {active ? (
                          <>
                            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary" />
                            <span className="ghost-button absolute -top-7 left-1/2 -translate-x-1/2 bg-surface px-2 py-0.5 text-[11px] text-text">
                              {slot.label}
                            </span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
