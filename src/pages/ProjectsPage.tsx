import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useProjects } from '../context/ProjectsContext';
import { useAuthz } from '../context/AuthzContext';
import { CalendarModuleSkin, type CalendarScope } from '../components/project-space/CalendarModuleSkin';
import { RemindersModuleSkin } from '../components/project-space/RemindersModuleSkin';
import { TasksModuleSkin } from '../components/project-space/TasksModuleSkin';
import { adaptTaskSummaries } from '../components/project-space/taskAdapter';
import { Dialog } from '../components/primitives';
import { PersonalizedDashboardPanel, type HubDashboardView } from '../features/PersonalizedDashboardPanel';
import { useDashboardMutations } from '../features/PersonalizedDashboardPanel/hooks/useDashboardMutations';
import { useRemindersRuntime } from '../hooks/useRemindersRuntime';
import { getHubHome, getRecordDetail } from '../services/hub/records';
import type { HubRecordDetail } from '../services/hub/types';
import { subscribeHubLive } from '../services/hubLive';
import { subscribeHubHomeRefresh } from '../lib/hubHomeRefresh';
import { dialogLayoutIds } from '../styles/motion';

const resolveFocusRestoreTarget = (candidate: HTMLElement | null): HTMLElement | null => {
  if (candidate && candidate.isConnected) {
    return candidate;
  }
  const mainContent = document.getElementById('main-content');
  if (mainContent instanceof HTMLElement) {
    if (!mainContent.hasAttribute('tabindex')) {
      mainContent.setAttribute('tabindex', '-1');
    }
    return mainContent;
  }
  return null;
};

const getActiveFocusTarget = (): HTMLElement | null => {
  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    return document.activeElement;
  }
  return resolveFocusRestoreTarget(null);
};

const readElementRect = (element: HTMLElement | null): { top: number; left: number; width: number; height: number } | null => {
  if (!element || !element.isConnected) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const parseDashboardView = (raw: string | null): HubDashboardView =>
  raw === 'stream' || raw === 'project-lens' ? raw : 'project-lens';

const SurfaceSchema = z.enum(['tasks', 'calendar', 'reminders', 'thoughts']);
type ProjectsPageSurface = z.infer<typeof SurfaceSchema>;

const parseProjectsPageSurface = (raw: string | null): ProjectsPageSurface | null => {
  const result = SurfaceSchema.safeParse(raw);
  return result.success ? result.data : null;
};

export const ProjectsPage = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects } = useProjects();
  const { accessToken } = useAuthz();
  const selectedSurface = parseProjectsPageSurface(searchParams.get('surface'));
  const fullPageSurface = selectedSurface === 'tasks' || selectedSurface === 'calendar' || selectedSurface === 'reminders'
    ? selectedSurface
    : null;
  const [calendarScope, setCalendarScope] = useState<CalendarScope>('relevant');

  const [homeLoading, setHomeLoading] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<{
    personal_project_id: Awaited<ReturnType<typeof getHubHome>>['personal_project_id'];
    tasks: Awaited<ReturnType<typeof getHubHome>>['tasks'];
    tasks_next_cursor: Awaited<ReturnType<typeof getHubHome>>['tasks_next_cursor'];
    captures: Awaited<ReturnType<typeof getHubHome>>['captures'];
    events: Awaited<ReturnType<typeof getHubHome>>['events'];
    notifications: Awaited<ReturnType<typeof getHubHome>>['notifications'];
  }>({
    personal_project_id: null,
    tasks: [],
    tasks_next_cursor: null,
    captures: [],
    events: [],
    notifications: [],
  });

  const [selectedHubRecordId, setSelectedHubRecordId] = useState<string | null>(null);
  const [selectedHubRecord, setSelectedHubRecord] = useState<HubRecordDetail | null>(null);
  const [selectedHubRecordLoading, setSelectedHubRecordLoading] = useState(false);
  const [selectedHubRecordError, setSelectedHubRecordError] = useState<string | null>(null);
  const [selectedHubRecordTriggerRect, setSelectedHubRecordTriggerRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedRecordAbortControllerRef = useRef<AbortController | null>(null);
  const selectedRecordRequestIdRef = useRef(0);
  const selectedHubRecordIdRef = useRef<string | null>(null);
  const selectedHubRecordTriggerRef = useRef<HTMLElement | null>(null);
  const liveRefreshHomeTimeoutRef = useRef<number | null>(null);
  const dashboardView = parseDashboardView(searchParams.get('view'));
  const remindersRuntime = useRemindersRuntime(
    fullPageSurface === 'reminders' ? accessToken ?? null : null,
    { autoload: fullPageSurface === 'reminders' },
  );
  const { onDismissReminder, onSnoozeReminder } = useDashboardMutations({
    accessToken,
    refreshReminders: remindersRuntime.refresh,
  });

  useEffect(() => {
    const taskId = searchParams.get('task_id');
    if (!taskId) {
      return;
    }
    selectedHubRecordTriggerRef.current = getActiveFocusTarget();
    setSelectedHubRecordTriggerRect(readElementRect(selectedHubRecordTriggerRef.current));
    selectedHubRecordIdRef.current = taskId;
    setSelectedHubRecordId(taskId);

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('task_id');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const refreshHome = useCallback(async () => {
    if (!accessToken) {
      setHomeData({ personal_project_id: null, tasks: [], tasks_next_cursor: null, captures: [], events: [], notifications: [] });
      setHomeError(null);
      setHomeLoading(false);
      setHomeReady(false);
      return;
    }

    setHomeLoading(true);
    try {
      const next = await getHubHome(accessToken, {
        tasks_limit: fullPageSurface === 'tasks' ? 50 : 8,
        events_limit: fullPageSurface === 'calendar' ? 50 : 8,
        captures_limit: selectedSurface === 'thoughts' ? 50 : 20,
        unread: true,
      });
      setHomeData(next);
      setHomeError(null);
      setHomeReady(true);
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : 'Failed to load myHub.');
      setHomeReady(true);
    } finally {
      setHomeLoading(false);
    }
  }, [accessToken, fullPageSurface, selectedSurface]);

  const refreshSelectedRecord = useCallback(
    async (recordId: string | null) => {
      selectedRecordAbortControllerRef.current?.abort();
      selectedRecordAbortControllerRef.current = null;
      const requestId = selectedRecordRequestIdRef.current + 1;
      selectedRecordRequestIdRef.current = requestId;

      if (!accessToken || !recordId) {
        setSelectedHubRecord(null);
        setSelectedHubRecordError(null);
        setSelectedHubRecordLoading(false);
        return;
      }

      const controller = new AbortController();
      selectedRecordAbortControllerRef.current = controller;
      setSelectedHubRecord(null);
      setSelectedHubRecordError(null);
      setSelectedHubRecordLoading(true);
      try {
        const record = await getRecordDetail(accessToken, recordId, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted
          || selectedRecordAbortControllerRef.current !== controller
          || selectedRecordRequestIdRef.current !== requestId
        ) {
          return;
        }
        setSelectedHubRecord(record);
        setSelectedHubRecordError(null);
      } catch (error) {
        if (
          controller.signal.aborted
          || selectedRecordAbortControllerRef.current !== controller
          || selectedRecordRequestIdRef.current !== requestId
        ) {
          return;
        }
        setSelectedHubRecord(null);
        setSelectedHubRecordError(error instanceof Error ? error.message : 'Failed to load record.');
      } finally {
        if (selectedRecordAbortControllerRef.current === controller && selectedRecordRequestIdRef.current === requestId) {
          selectedRecordAbortControllerRef.current = null;
          setSelectedHubRecordLoading(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => () => {
    selectedRecordAbortControllerRef.current?.abort();
    selectedRecordAbortControllerRef.current = null;
    selectedRecordRequestIdRef.current += 1;
  }, []);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  useEffect(() => subscribeHubHomeRefresh(() => {
    void refreshHome();
  }), [refreshHome]);

  useEffect(() => {
    void refreshSelectedRecord(selectedHubRecordId);
  }, [refreshSelectedRecord, selectedHubRecordId]);

  useEffect(() => {
    selectedHubRecordIdRef.current = selectedHubRecordId;
  }, [selectedHubRecordId]);

  useEffect(() => {
    if (!accessToken) {
      if (liveRefreshHomeTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshHomeTimeoutRef.current);
        liveRefreshHomeTimeoutRef.current = null;
      }
      return;
    }

    const unsubscribe = subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'task.changed') {
        return;
      }
      if (liveRefreshHomeTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshHomeTimeoutRef.current);
      }
      liveRefreshHomeTimeoutRef.current = window.setTimeout(() => {
        liveRefreshHomeTimeoutRef.current = null;
        void refreshHome();
      }, 500);
      if (message.task.record_id === selectedHubRecordIdRef.current) {
        void refreshSelectedRecord(selectedHubRecordIdRef.current);
      }
    });

    return () => {
      if (liveRefreshHomeTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshHomeTimeoutRef.current);
        liveRefreshHomeTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, [accessToken, refreshHome, refreshSelectedRecord]);

  const onOpenHubRecord = useCallback((recordId: string) => {
    selectedHubRecordTriggerRef.current = getActiveFocusTarget();
    setSelectedHubRecordTriggerRect(readElementRect(selectedHubRecordTriggerRef.current));
    selectedHubRecordIdRef.current = recordId;
    setSelectedHubRecordId(recordId);
  }, []);

  const onCloseSelectedRecord = useCallback(() => {
    selectedHubRecordTriggerRef.current = resolveFocusRestoreTarget(selectedHubRecordTriggerRef.current);
    selectedRecordAbortControllerRef.current?.abort();
    selectedRecordAbortControllerRef.current = null;
    selectedRecordRequestIdRef.current += 1;
    selectedHubRecordIdRef.current = null;
    setSelectedHubRecordId(null);
    setSelectedHubRecord(null);
    setSelectedHubRecordError(null);
    setSelectedHubRecordLoading(false);
  }, []);

  const onDashboardViewChange = useCallback((view: HubDashboardView) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('view', view);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearSurface = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('surface');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const filteredCalendarEvents = useMemo(() => {
    if (calendarScope === 'all') {
      return homeData.events;
    }
    const now = new Date();
    const windowStart = now.getTime() - (24 * 60 * 60 * 1000);
    const windowEnd = now.getTime() + (14 * 24 * 60 * 60 * 1000);
    return homeData.events.filter((event) => {
      const startTime = new Date(event.event_state.start_dt).getTime();
      return Number.isFinite(startTime) && startTime >= windowStart && startTime <= windowEnd;
    });
  }, [calendarScope, homeData.events]);

  const fullPageTitle = fullPageSurface === 'tasks'
    ? 'Tasks'
    : fullPageSurface === 'calendar'
      ? 'Calendar'
      : fullPageSurface === 'reminders'
        ? 'Reminders'
        : 'myHub';

  return (
    <div className="relative space-y-4">
      <h1 className="sr-only">{fullPageTitle}</h1>
      {fullPageSurface ? (
        <section className="space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-subtle bg-elevated p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">myHub</p>
              <h2 className="text-lg font-semibold text-text">{fullPageTitle}</h2>
            </div>
            <button
              type="button"
              onClick={clearSurface}
              className="rounded-control border border-border-muted bg-surface px-3 py-1.5 text-sm font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Back to Dashboard
            </button>
          </header>

          {homeError && fullPageSurface !== 'reminders' ? (
            <p className="rounded-panel border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger" role="alert">
              {homeError}
            </p>
          ) : null}

          <section className="rounded-panel border border-subtle bg-elevated p-4">
            {fullPageSurface === 'tasks' ? (
              <TasksModuleSkin
                sizeTier="L"
                tasks={adaptTaskSummaries(homeData.tasks)}
                tasksLoading={homeLoading}
                onOpenRecord={onOpenHubRecord}
                readOnly
              />
            ) : null}
            {fullPageSurface === 'calendar' ? (
              <CalendarModuleSkin
                sizeTier="L"
                events={filteredCalendarEvents}
                loading={homeLoading}
                scope={calendarScope}
                onScopeChange={setCalendarScope}
                onOpenRecord={onOpenHubRecord}
              />
            ) : null}
            {fullPageSurface === 'reminders' ? (
              <RemindersModuleSkin
                sizeTier="L"
                reminders={remindersRuntime.reminders}
                loading={remindersRuntime.loading}
                error={remindersRuntime.error}
                onDismiss={onDismissReminder}
                onSnooze={(reminderId) => onSnoozeReminder(reminderId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}
                onCreate={remindersRuntime.create}
              />
            ) : null}
          </section>
        </section>
      ) : (
        <PersonalizedDashboardPanel
          homeData={homeData}
          homeLoading={homeLoading}
          homeReady={homeReady}
          homeError={homeError}
          projects={projects}
          onOpenRecord={onOpenHubRecord}
          initialView={dashboardView}
          onViewChange={onDashboardViewChange}
        />
      )}

      {!prefersReducedMotion && selectedHubRecordTriggerRect ? (
        <motion.div
          layoutId={dialogLayoutIds.myHubRecordInspector}
          aria-hidden="true"
          className="pointer-events-none fixed z-[299] opacity-0"
          style={{
            top: selectedHubRecordTriggerRect.top,
            left: selectedHubRecordTriggerRect.left,
            width: selectedHubRecordTriggerRect.width,
            height: selectedHubRecordTriggerRect.height,
          }}
        />
      ) : null}

      <Dialog
        open={Boolean(selectedHubRecordId)}
        onClose={onCloseSelectedRecord}
        triggerRef={selectedHubRecordTriggerRef}
        layoutId={dialogLayoutIds.myHubRecordInspector}
        motionVariant="fold-sheet"
        title="Record Inspector"
        description="Review the selected Hub item without leaving the Hub."
      >
        {selectedHubRecordLoading ? <p className="text-sm text-muted">Loading record...</p> : null}
        {selectedHubRecordError ? (
          <p className="text-sm text-danger" role="alert">
            {selectedHubRecordError}
          </p>
        ) : null}
        {selectedHubRecord ? (
          <div className="space-y-4">
            <section className="rounded-panel border border-border-muted bg-surface p-4">
              <h2 className="text-base font-semibold text-text">{selectedHubRecord.title}</h2>
              <p className="mt-1 text-xs text-muted">
                Collection: {selectedHubRecord.schema?.name || selectedHubRecord.collection_id}
              </p>
              <p className="mt-2 text-xs text-muted">
                {selectedHubRecord.capabilities.task_state?.status || selectedHubRecord.capabilities.event_state ? 'Active record' : 'Record'}
                {selectedHubRecord.capabilities.task_state?.priority
                  ? ` · ${selectedHubRecord.capabilities.task_state.priority}`
                  : ''}
                {selectedHubRecord.origin_kind ? ` · ${selectedHubRecord.origin_kind}` : ''}
              </p>
            </section>

            <section className="rounded-panel border border-border-muted bg-surface p-4">
              <h3 className="text-sm font-semibold text-primary">Details</h3>
              {selectedHubRecord.capabilities.event_state ? (
                <p className="mt-2 text-sm text-muted">
                  Event starts {new Date(selectedHubRecord.capabilities.event_state.start_dt).toLocaleString()}.
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted">
                {selectedHubRecord.comments.length > 0
                  ? `${selectedHubRecord.comments.length} discussion comment(s).`
                  : 'No comments yet.'}
              </p>
              {Object.keys(selectedHubRecord.values).length > 0 ? (
                <dl className="mt-3 space-y-2">
                  {Object.entries(selectedHubRecord.values).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{key}</dt>
                      <dd className="text-sm text-text">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};
