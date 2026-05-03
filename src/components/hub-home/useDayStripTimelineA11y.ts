import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { DAY_STRIP_KEYBOARD_SLOT_MS } from './dayStripWindow';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MARKER_MATCH_THRESHOLD_MS = FIVE_MINUTES_MS / 2;

type TimelineItemKind = 'event' | 'task' | 'reminder';

export interface DayStripTimelineA11yItem {
  id: string;
  kind: TimelineItemKind;
  title: string;
  recordId: string;
  timeMs: number;
  reminderId?: string;
}

type MovableTimelineItem =
  | {
    id: string;
    kind: 'task';
    title: string;
    recordId: string;
    originalTimeMs: number;
  }
  | {
    id: string;
    kind: 'reminder';
    title: string;
    recordId: string;
    reminderId: string;
    originalTimeMs: number;
  };

interface UseDayStripTimelineA11yParams {
  nowMs: number;
  rangeStartMs: number;
  rangeEndMs: number;
  timelineItems: DayStripTimelineA11yItem[];
  keyboardDragItem?: { title: string } | null;
  announce?: (message: string) => void;
  onOpenRecord: (recordId: string) => void;
  onMoveTask?: (recordId: string, dueAtIso: string) => void | Promise<void>;
  onMoveReminder?: (reminderId: string, remindAtIso: string) => void | Promise<void>;
  onKeyboardDrop?: (assignedAt: Date) => void | Promise<void>;
  onKeyboardCancel?: () => void;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const formatTimeLabel = (timeMs: number): string =>
  new Date(timeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatTimelineItemLabel = (item: Pick<DayStripTimelineA11yItem, 'title' | 'timeMs'>): string =>
  `${item.title} at ${formatTimeLabel(item.timeMs)}.`;

const isMoveKey = (event: KeyboardEvent): boolean => event.code === 'Period' || event.code === 'Comma';

const resolveMarkerStepMs = (event: KeyboardEvent): number => (event.shiftKey ? FIVE_MINUTES_MS : DAY_STRIP_KEYBOARD_SLOT_MS);

const resolveMarkerDirection = (event: KeyboardEvent): 1 | -1 => (event.code === 'Period' ? 1 : -1);

const asMovableTimelineItem = (item: DayStripTimelineA11yItem): MovableTimelineItem | null => {
  if (item.kind === 'task') {
    return {
      id: item.id,
      kind: 'task',
      title: item.title,
      recordId: item.recordId,
      originalTimeMs: item.timeMs,
    };
  }
  if (item.kind === 'reminder' && item.reminderId) {
    return {
      id: item.id,
      kind: 'reminder',
      title: item.title,
      recordId: item.recordId,
      reminderId: item.reminderId,
      originalTimeMs: item.timeMs,
    };
  }
  return null;
};

export const useDayStripTimelineA11y = ({
  nowMs,
  rangeStartMs,
  rangeEndMs,
  timelineItems,
  keyboardDragItem = null,
  announce,
  onOpenRecord,
  onMoveTask,
  onMoveReminder,
  onKeyboardDrop,
  onKeyboardCancel,
}: UseDayStripTimelineA11yParams) => {
  const [activeMarkerMs, setActiveMarkerMs] = useState(() => clamp(nowMs, rangeStartMs, rangeEndMs));
  const [movingItem, setMovingItem] = useState<MovableTimelineItem | null>(null);
  const markerMs = clamp(activeMarkerMs, rangeStartMs, rangeEndMs);

  const markerHit = useMemo(() => {
    for (const item of timelineItems) {
      if (Math.abs(item.timeMs - markerMs) <= MARKER_MATCH_THRESHOLD_MS) {
        return item;
      }
    }
    return null;
  }, [markerMs, timelineItems]);

  const announceMarker = useCallback((nextMarkerMs: number) => {
    const matchedItem = timelineItems.find((item) => Math.abs(item.timeMs - nextMarkerMs) <= MARKER_MATCH_THRESHOLD_MS) ?? null;
    if (matchedItem) {
      announce?.(formatTimelineItemLabel(matchedItem));
      return;
    }
    announce?.(formatTimeLabel(nextMarkerMs));
  }, [announce, timelineItems]);

  const moveMarkerBy = useCallback((deltaMs: number) => {
    setActiveMarkerMs((current) => {
      const nextMarkerMs = clamp(current + deltaMs, rangeStartMs, rangeEndMs);
      announceMarker(nextMarkerMs);
      return nextMarkerMs;
    });
  }, [announceMarker, rangeEndMs, rangeStartMs]);

  const viewportLabel = useMemo(() => {
    if (keyboardDragItem) {
      return `Schedule ${keyboardDragItem.title}. ${markerHit ? formatTimelineItemLabel(markerHit) : `${formatTimeLabel(markerMs)}.`} Press Space to drop or Escape to cancel.`;
    }
    if (movingItem) {
      return `Move ${movingItem.title}. ${markerHit ? formatTimelineItemLabel(markerHit) : `${formatTimeLabel(markerMs)}.`} Press Space to drop or Escape to cancel.`;
    }
    if (markerHit) {
      return `Today timeline marker. ${formatTimelineItemLabel(markerHit)} Use period and comma to move by 15 minutes. Use Shift plus period and Shift plus comma to move by 5 minutes.`;
    }
    return `Today timeline marker at ${formatTimeLabel(markerMs)}. Use period and comma to move by 15 minutes. Use Shift plus period and Shift plus comma to move by 5 minutes.`;
  }, [keyboardDragItem, markerHit, markerMs, movingItem]);

  const beginMove = useCallback((item: DayStripTimelineA11yItem): boolean => {
    const movable = asMovableTimelineItem(item);
    if (!movable) {
      return false;
    }
    setMovingItem(movable);
    setActiveMarkerMs(clamp(item.timeMs, rangeStartMs, rangeEndMs));
    announce?.(`Move ${item.title}. ${formatTimelineItemLabel(item)} Press Space to drop or Escape to cancel.`);
    return true;
  }, [announce, rangeEndMs, rangeStartMs]);

  const cancelMove = useCallback(() => {
    if (!movingItem) {
      return;
    }
    setActiveMarkerMs(clamp(movingItem.originalTimeMs, rangeStartMs, rangeEndMs));
    setMovingItem(null);
    announce?.('Cancelled.');
  }, [announce, movingItem, rangeEndMs, rangeStartMs]);

  const commitMove = useCallback(async () => {
    if (!movingItem) {
      return;
    }
    if (markerMs === movingItem.originalTimeMs) {
      setMovingItem(null);
      onOpenRecord(movingItem.recordId);
      return;
    }
    try {
      if (movingItem.kind === 'task') {
        await onMoveTask?.(movingItem.recordId, new Date(markerMs).toISOString());
      }
      if (movingItem.kind === 'reminder') {
        await onMoveReminder?.(movingItem.reminderId, new Date(markerMs).toISOString());
      }
      setMovingItem(null);
      announce?.(`Moved ${movingItem.title} to ${formatTimeLabel(markerMs)}.`);
    } catch {
      announce?.(`Could not move ${movingItem.title}.`);
    }
  }, [announce, markerMs, movingItem, onMoveReminder, onMoveTask, onOpenRecord]);

  const handleViewportKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (isMoveKey(event)) {
      event.preventDefault();
      moveMarkerBy(resolveMarkerDirection(event) * resolveMarkerStepMs(event));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveMarkerBy(DAY_STRIP_KEYBOARD_SLOT_MS);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveMarkerBy(-DAY_STRIP_KEYBOARD_SLOT_MS);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveMarkerBy(FIVE_MINUTES_MS);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveMarkerBy(-FIVE_MINUTES_MS);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveMarkerMs(rangeStartMs);
      announceMarker(rangeStartMs);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveMarkerMs(rangeEndMs);
      announceMarker(rangeEndMs);
      return;
    }

    if (!movingItem && !keyboardDragItem) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (keyboardDragItem) {
        onKeyboardCancel?.();
        return;
      }
      cancelMove();
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (keyboardDragItem) {
        void onKeyboardDrop?.(new Date(markerMs));
        return;
      }
      void commitMove();
    }
  }, [announceMarker, cancelMove, commitMove, keyboardDragItem, markerMs, moveMarkerBy, movingItem, onKeyboardCancel, onKeyboardDrop, rangeEndMs, rangeStartMs]);

  const handleViewportFocus = useCallback(() => {
    if (keyboardDragItem) {
      announce?.(`Schedule ${keyboardDragItem.title}. ${markerHit ? formatTimelineItemLabel(markerHit) : `${formatTimeLabel(markerMs)}.`} Press Space to drop or Escape to cancel.`);
      return;
    }
    if (markerHit) {
      announce?.(formatTimelineItemLabel(markerHit));
      return;
    }
    announce?.(formatTimeLabel(markerMs));
  }, [announce, keyboardDragItem, markerHit, markerMs]);

  const handleItemKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, item: DayStripTimelineA11yItem): boolean => {
    if (event.key !== ' ') {
      return false;
    }
    const startedMove = beginMove(item);
    if (!startedMove) {
      return false;
    }
    event.preventDefault();
    return true;
  }, [beginMove]);

  return {
    movingItemId: movingItem?.id ?? null,
    viewportLabel,
    handleViewportFocus,
    handleViewportKeyDown,
    handleItemKeyDown,
    formatTimelineItemLabel,
  };
};
