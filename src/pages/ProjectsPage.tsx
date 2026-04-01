import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext';
import { useAuthz } from '../context/AuthzContext';
import { Dialog } from '../components/primitives';
import { PersonalizedDashboardPanel, type HubDashboardView } from '../features/PersonalizedDashboardPanel';
import { getHubHome, getRecordDetail } from '../services/hub/records';
import type { HubRecordDetail } from '../services/hub/types';
import { subscribeHubLive } from '../services/hubLive';
import { subscribeHubHomeRefresh } from '../lib/hubHomeRefresh';

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

const parseDashboardView = (raw: string | null): HubDashboardView =>
  raw === 'stream' || raw === 'project-lens' ? raw : 'project-lens';

export const ProjectsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects } = useProjects();
  const { accessToken } = useAuthz();

  const [homeLoading, setHomeLoading] = useState(false);
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

  const selectedRecordAbortControllerRef = useRef<AbortController | null>(null);
  const selectedRecordRequestIdRef = useRef(0);
  const selectedHubRecordIdRef = useRef<string | null>(null);
  const selectedHubRecordTriggerRef = useRef<HTMLElement | null>(null);
  const liveRefreshHomeTimeoutRef = useRef<number | null>(null);
  const dashboardView = parseDashboardView(searchParams.get('view'));

  useEffect(() => {
    const taskId = searchParams.get('task_id');
    if (!taskId) {
      return;
    }
    selectedHubRecordTriggerRef.current = getActiveFocusTarget();
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
      return;
    }

    setHomeLoading(true);
    try {
      const next = await getHubHome(accessToken, {
        tasks_limit: 8,
        events_limit: 8,
        captures_limit: 20,
        unread: true,
      });
      setHomeData(next);
      setHomeError(null);
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : 'Failed to load Hub Home.');
    } finally {
      setHomeLoading(false);
    }
  }, [accessToken]);

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

  return (
    <div className="space-y-4">
      <PersonalizedDashboardPanel
        homeData={homeData}
        homeLoading={homeLoading}
        homeError={homeError}
        projects={projects}
        onOpenRecord={onOpenHubRecord}
        initialView={dashboardView}
        onViewChange={onDashboardViewChange}
      />

      <Dialog
        open={Boolean(selectedHubRecordId)}
        onClose={onCloseSelectedRecord}
        triggerRef={selectedHubRecordTriggerRef}
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
