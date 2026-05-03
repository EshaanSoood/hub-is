import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ContextBar, DailyBriefCountPill, nounForCount } from '../../components/hub-home/ContextBar';
import { DayStrip } from '../../components/hub-home/DayStrip';
import { BacklogPanel } from '../../components/hub-home/BacklogPanel';
import { DAY_STRIP_FORWARD_WINDOW_MS } from '../../components/hub-home/dayStripWindow';
import type { BacklogDragPayload } from '../../components/hub-home/types';
import { routeFadeVariants } from '../../components/motion/hubMotion';
import { LiveRegion } from '../../components/primitives';
import { useLiveRegion } from '../../hooks/useLiveRegion';
import { cn } from '../../lib/cn';
import type { DashboardDailyData, DashboardDayCounts, ProjectOption } from './types';
import { parseIso } from './utils';

type DailyBriefState = 'active-day' | 'empty-backlog' | 'true-zero';

const hasActiveScheduledTime = (value: string, nowMs: number, windowEndMs: number): boolean => {
  const parsed = parseIso(value);
  if (!parsed) {
    return false;
  }
  const scheduledMs = parsed.getTime();
  return scheduledMs >= nowMs && scheduledMs <= windowEndMs;
};

const hasActiveEventTime = (startValue: string, endValue: string, nowMs: number, windowEndMs: number): boolean => {
  const start = parseIso(startValue);
  const end = parseIso(endValue);
  if (!start || !end) {
    return false;
  }
  return end.getTime() >= nowMs && start.getTime() <= windowEndMs;
};

const resolveDailyBriefState = (dailyData: DashboardDailyData, now: Date): DailyBriefState => {
  const nowMs = now.getTime();
  const windowEndMs = nowMs + DAY_STRIP_FORWARD_WINDOW_MS;

  const hasActiveDay =
    dailyData.dayEvents.some((event) => hasActiveEventTime(event.startAtIso, event.endAtIso, nowMs, windowEndMs))
    || dailyData.timedTasks.some((task) => hasActiveScheduledTime(task.dueAtIso, nowMs, windowEndMs))
    || dailyData.timedReminders.some((reminder) => hasActiveScheduledTime(reminder.remindAtIso, nowMs, windowEndMs));

  if (hasActiveDay) {
    return 'active-day';
  }

  const hasBacklog =
    dailyData.overdueTasks.length > 0
    || dailyData.untimedTasks.length > 0
    || dailyData.missedReminders.length > 0;

  return hasBacklog ? 'empty-backlog' : 'true-zero';
};

interface DayStripSectionProps {
  countReady: boolean;
  greeting: string;
  headerActions?: ReactNode;
  now: Date;
  filteredDailyData: DashboardDailyData;
  dayCounts: DashboardDayCounts;
  activeProjectFilter: string;
  projectOptions: ProjectOption[];
  onProjectFilterChange: (value: string) => void;
  onOpenRecord: (recordId: string) => void;
  onDropFromBacklog: (payload: BacklogDragPayload, assignedAt: Date) => Promise<void>;
  onCompleteTask: (recordId: string) => Promise<void>;
  onRescheduleTask: (recordId: string, dueAtIso: string) => Promise<void>;
  onSnoozeTask: (recordId: string) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onSnoozeReminder: (reminderId: string, remindAtIso: string) => Promise<void>;
}

export const DayStripSection = ({
  countReady,
  greeting,
  headerActions,
  now,
  filteredDailyData,
  dayCounts,
  activeProjectFilter,
  projectOptions,
  onProjectFilterChange,
  onOpenRecord,
  onDropFromBacklog,
  onCompleteTask,
  onRescheduleTask,
  onSnoozeTask,
  onDismissReminder,
  onSnoozeReminder,
}: DayStripSectionProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat([], { weekday: 'long', month: 'long', day: 'numeric' }).format(now),
    [now],
  );
  const briefState = useMemo(() => resolveDailyBriefState(filteredDailyData, now), [filteredDailyData, now]);
  const compactGreeting = useMemo(() => greeting.split(' · ')[0] ?? greeting, [greeting]);
  const fadeVariants = useMemo(() => routeFadeVariants(prefersReducedMotion), [prefersReducedMotion]);
  const { announcement, announce } = useLiveRegion();
  const [keyboardDragItem, setKeyboardDragItem] = useState<{
    id: string;
    title: string;
    payload: BacklogDragPayload;
  } | null>(null);
  const [restoreFocusItemId, setRestoreFocusItemId] = useState<string | null>(null);
  const [focusViewportKey, setFocusViewportKey] = useState(0);

  const handleBeginKeyboardDrag = useCallback((item: { id: string; title: string; payload: BacklogDragPayload }) => {
    setRestoreFocusItemId(null);
    setKeyboardDragItem(item);
    announce(`Picked up ${item.title}. Use period and comma to move by 15 minutes, Shift plus period and Shift plus comma to move by 5 minutes, Space to drop, or Escape to cancel.`);
  }, [announce]);

  const handleKeyboardCancel = useCallback(() => {
    if (keyboardDragItem) {
      setRestoreFocusItemId(keyboardDragItem.id);
    }
    setKeyboardDragItem(null);
    announce('Cancelled.');
  }, [announce, keyboardDragItem]);

  const handleKeyboardDrop = useCallback(async (assignedAt: Date) => {
    if (!keyboardDragItem) {
      return;
    }
    const { id, title, payload } = keyboardDragItem;
    try {
      await onDropFromBacklog(payload, assignedAt);
      setKeyboardDragItem(null);
      setFocusViewportKey((current) => current + 1);
      announce(`Dropped ${title} at ${assignedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    } catch {
      setRestoreFocusItemId(id);
      announce(`Could not schedule ${title}.`);
    }
  }, [announce, keyboardDragItem, onDropFromBacklog]);
  const showCollapsedBrief = briefState !== 'active-day' && keyboardDragItem === null;
  const focusBacklog = useCallback(() => {
    const backlogToggle = document.getElementById('backlog-toggle');
    if (!(backlogToggle instanceof HTMLButtonElement)) {
      return;
    }
    backlogToggle.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
    backlogToggle.focus();
  }, [prefersReducedMotion]);

  return (
    <div
      aria-labelledby="daily-brief-heading"
      className={cn(
        'section-scored rounded-panel bg-surface shadow-soft',
        showCollapsedBrief ? 'px-5 pb-2 pt-3' : 'p-4',
      )}
      data-daily-brief-state={briefState}
      data-testid="daily-brief"
    >
      <LiveRegion message={announcement} role="status" ariaLive="polite" />

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={briefState}
          animate="animate"
          exit="exit"
          initial="initial"
          variants={fadeVariants}
        >
          {showCollapsedBrief ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,var(--daily-brief-rail-width))_minmax(0,1fr)_minmax(0,var(--daily-brief-rail-width))] xl:items-start xl:gap-[var(--daily-brief-column-gap)]">
                <div className="min-w-0 space-y-1">
                  <h2 id="daily-brief-heading" className="font-serif text-xl font-semibold text-text">What&apos;s Up Today</h2>
                  <p className="text-sm font-semibold text-text">{compactGreeting}</p>
                  <p className="text-xs text-muted">{dateLabel}</p>
                </div>

                <DayStrip
                  className="min-w-0"
                  events={[]}
                  tasks={[]}
                  reminders={[]}
                  typeFilter="all"
                onOpenRecord={onOpenRecord}
                onDropFromBacklog={onDropFromBacklog}
                showEmptyTimeline
                presentation="collapsed-empty"
                onMoveTask={onRescheduleTask}
                onMoveReminder={onSnoozeReminder}
                onAccessibilityAnnouncement={announce}
              />

                <div className="flex min-w-0 flex-col gap-[var(--daily-brief-right-rail-gap)]">
                  <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end" role="group" aria-label="Daily brief totals">
                    <DailyBriefCountPill
                      count={dayCounts.events}
                      iconName="calendar"
                      label={nounForCount(dayCounts.events, 'event', 'events')}
                    />
                    <DailyBriefCountPill
                      count={dayCounts.tasks}
                      iconName="tasks"
                      label={nounForCount(dayCounts.tasks, 'task', 'tasks')}
                    />
                    <DailyBriefCountPill
                      count={dayCounts.reminders}
                      iconName="reminders"
                      label={nounForCount(dayCounts.reminders, 'reminder', 'reminders')}
                    />
                  </div>
                  {briefState === 'empty-backlog' ? (
                    <div
                      className="ghost-button inline-flex h-[var(--daily-brief-backlog-button-height)] w-[var(--daily-brief-backlog-button-width)] max-w-full items-center justify-between gap-2 self-start rounded-control bg-surface-highest px-3 py-2 text-sm font-semibold text-text shadow-soft-subtle xl:self-end"
                    >
                      <span>Backlog</span>
                      <span className="text-text-secondary">
                        {dayCounts.backlog} {nounForCount(dayCounts.backlog, 'item', 'items')}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button inline-flex h-[var(--daily-brief-backlog-button-height)] w-[var(--daily-brief-backlog-button-width)] max-w-full items-center justify-between gap-2 self-start rounded-control bg-surface-highest px-3 py-2 text-sm font-semibold text-text shadow-soft-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60 xl:self-end"
                      onClick={focusBacklog}
                      disabled
                    >
                      <span>Backlog</span>
                      <span className="text-text-secondary">
                        {dayCounts.backlog} {nounForCount(dayCounts.backlog, 'item', 'items')}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {briefState === 'empty-backlog' ? (
                <BacklogPanel
                  className="mt-3"
                  countReady={countReady}
                  overdueTasks={filteredDailyData.overdueTasks}
                  untimedTasks={filteredDailyData.untimedTasks}
                  missedReminders={filteredDailyData.missedReminders}
                  onOpenRecord={onOpenRecord}
                  onCompleteTask={onCompleteTask}
                  onRescheduleTask={onRescheduleTask}
                  onSnoozeTask={onSnoozeTask}
                  onAssignTaskTime={onRescheduleTask}
                  onDismissReminder={onDismissReminder}
                  onSnoozeReminder={onSnoozeReminder}
                  dragToTimelineEnabled
                  activeKeyboardDragItemId={null}
                  restoreFocusItemId={restoreFocusItemId}
                  onRestoreFocusHandled={() => {
                    setRestoreFocusItemId(null);
                  }}
                  onBeginKeyboardDrag={handleBeginKeyboardDrag}
                />
              ) : null}
            </>
          ) : (
            <>
              <h2 id="daily-brief-heading" className="font-serif text-xl font-semibold text-text">What&apos;s Up Today</h2>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text">{greeting}</p>
                  <p className="text-xs text-muted">{dateLabel}</p>
                </div>
                {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
              </div>

              <DayStrip
                key={keyboardDragItem ? `keyboard-drag-${keyboardDragItem.id}` : 'keyboard-drag-idle'}
                className="mt-3"
                events={briefState === 'active-day' ? filteredDailyData.dayEvents : []}
                tasks={briefState === 'active-day' ? filteredDailyData.timedTasks : []}
                reminders={briefState === 'active-day' ? filteredDailyData.timedReminders : []}
                typeFilter="all"
                onOpenRecord={onOpenRecord}
                onDropFromBacklog={onDropFromBacklog}
                showEmptyTimeline={briefState !== 'active-day'}
                keyboardDragItem={keyboardDragItem ? { title: keyboardDragItem.title } : null}
                onKeyboardDrop={handleKeyboardDrop}
                onKeyboardCancel={handleKeyboardCancel}
                focusViewportKey={focusViewportKey}
                onMoveTask={onRescheduleTask}
                onMoveReminder={onSnoozeReminder}
                onAccessibilityAnnouncement={announce}
              />

              <ContextBar
                className="mt-3"
                projectFilter={activeProjectFilter}
                projectOptions={projectOptions}
                onProjectFilterChange={onProjectFilterChange}
                eventCount={dayCounts.events}
                taskCount={dayCounts.tasks}
                reminderCount={dayCounts.reminders}
                backlogCount={dayCounts.backlog}
              />

              <BacklogPanel
                className="mt-3"
                countReady={countReady}
                overdueTasks={filteredDailyData.overdueTasks}
                untimedTasks={filteredDailyData.untimedTasks}
                missedReminders={filteredDailyData.missedReminders}
                onOpenRecord={onOpenRecord}
                onCompleteTask={onCompleteTask}
                onRescheduleTask={onRescheduleTask}
                onSnoozeTask={onSnoozeTask}
                onAssignTaskTime={onRescheduleTask}
                onDismissReminder={onDismissReminder}
                onSnoozeReminder={onSnoozeReminder}
                dragToTimelineEnabled
                activeKeyboardDragItemId={keyboardDragItem?.id ?? null}
                restoreFocusItemId={restoreFocusItemId}
                onRestoreFocusHandled={() => {
                  setRestoreFocusItemId(null);
                }}
                onBeginKeyboardDrag={handleBeginKeyboardDrag}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
