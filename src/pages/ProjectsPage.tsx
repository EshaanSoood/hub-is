import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext';
import { useAuthz } from '../context/AuthzContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Dialog, HubOsWordmark, Select } from '../components/primitives';
import { PersonalizedDashboardPanel } from '../features/PersonalizedDashboardPanel';
import { createHubProject } from '../services/projectsService';
import { createEventFromNlp, getHubHome, getRecordDetail } from '../services/hub/records';
import type { HubRecordDetail } from '../services/hub/types';
import { subscribeHubLive } from '../services/hubLive';
import { subscribeHubHomeRefresh } from '../lib/hubHomeRefresh';
import { CalendarModuleSkin } from '../components/project-space/CalendarModuleSkin';
import { usePersonalCalendarRuntime } from '../hooks/usePersonalCalendarRuntime';

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

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, loading, error, refreshProjects } = useProjects();
  const { accessToken, refreshSession } = useAuthz();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [hubView, setHubView] = useState<'daily-brief' | 'project-lens' | 'stream'>('daily-brief');
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
  const {
    calendarEvents,
    calendarError,
    calendarLoading,
    calendarMode,
    refreshCalendar,
    setCalendarMode,
  } = usePersonalCalendarRuntime(accessToken ?? null);
  const [calendarCreateProjectId, setCalendarCreateProjectId] = useState(() => projects[0]?.id || '');
  const selectedRecordAbortControllerRef = useRef<AbortController | null>(null);
  const selectedRecordRequestIdRef = useRef(0);
  const selectedHubRecordIdRef = useRef<string | null>(null);
  const selectedHubRecordTriggerRef = useRef<HTMLElement | null>(null);

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.isPersonal),
    [projects],
  );
  const calendarProjectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const selectedCalendarCreateProjectId = useMemo(() => {
    if (projects.length === 0) {
      return '';
    }
    if (projects.some((project) => project.id === calendarCreateProjectId)) {
      return calendarCreateProjectId;
    }
    return projects[0]?.id || '';
  }, [calendarCreateProjectId, projects]);
  useEffect(() => {
    const taskId = searchParams.get('task_id');
    if (!taskId) {
      return;
    }
    selectedHubRecordTriggerRef.current = getActiveFocusTarget();
    selectedHubRecordIdRef.current = taskId;
    setSelectedHubRecordId(taskId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('task_id');
    setSearchParams(nextParams, { replace: true });
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
      return;
    }
    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'task.changed') {
        return;
      }
      void refreshHome();
      if (message.task.record_id === selectedHubRecordIdRef.current) {
        void refreshSelectedRecord(selectedHubRecordIdRef.current);
      }
    });
  }, [accessToken, refreshHome, refreshSelectedRecord]);

  const onCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setCreateError('An authenticated session is required.');
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError('Project name is required.');
      return;
    }

    setCreateError(null);
    setCreating(true);
    try {
      const created = await createHubProject(accessToken, {
        name: trimmed,
        summary: '',
      });

      if (created.error || !created.data) {
        setCreateError(created.error || 'Project creation failed.');
        return;
      }

      setName('');
      navigate(`/projects/${created.data.id}/overview`);
      void Promise.allSettled([refreshProjects(), refreshSession()]);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Project creation failed.');
    } finally {
      setCreating(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <PageHeader
        title={<HubOsWordmark aria-label="Hub OS" className="block h-9 w-auto" />}
        description="Your personal big picture across projects, with work opening in the Record Inspector without leaving the Hub."
      />

      <PersonalizedDashboardPanel
        homeData={homeData}
        homeLoading={homeLoading}
        homeError={homeError}
        projects={projects}
        onOpenRecord={onOpenHubRecord}
        onViewChange={setHubView}
      />

      {hubView === 'project-lens' ? (
        <>
          <section className="rounded-panel border border-subtle bg-elevated p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="heading-3 text-primary">Projects</h2>
              {loading ? <span className="text-xs text-muted">Loading...</span> : null}
            </div>

            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

            {!loading && visibleProjects.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No projects yet. Create one to begin.</p>
            ) : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-label="Project list">
                {visibleProjects.map((project) => (
                  <li key={project.id} className="rounded-panel border border-border-muted bg-surface p-3">
                    <p className="text-sm font-bold text-text">{project.name}</p>
                    <p className="mt-1 text-xs text-text-secondary">Role: {project.membershipRole}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to={`/projects/${project.id}/overview`}
                        className="rounded-control border border-border-muted px-3 py-1.5 text-sm font-medium text-primary"
                      >
                        Overview
                      </Link>
                      <Link
                        to={`/projects/${project.id}/work`}
                        className="rounded-control border border-border-muted px-3 py-1.5 text-sm font-medium text-primary"
                      >
                        Work
                      </Link>
                      <Link
                        to={`/projects/${project.id}/tools`}
                        className="rounded-control border border-border-muted px-3 py-1.5 text-sm font-medium text-primary"
                      >
                        Tools
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="quick-create" className="rounded-panel border border-subtle bg-elevated p-4">
            <h2 className="heading-3 text-primary">Create Project</h2>
            <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={onCreateProject}>
              <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-muted" htmlFor="create-project-name">
                Project name
                <input
                  id="create-project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  placeholder="New project"
                  disabled={creating}
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                disabled={creating}
                className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </form>

            {createError ? (
              <p className="mt-2 text-sm text-danger" role="alert" aria-live="polite">
                {createError}
              </p>
            ) : null}
          </section>

          <section className="rounded-panel border border-subtle bg-elevated p-4" aria-labelledby="personal-dashboard-calendar-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="personal-dashboard-calendar-heading" className="heading-3 text-primary">
                Calendar
              </h2>
              {calendarProjectOptions.length > 0 ? (
                <Select
                  value={selectedCalendarCreateProjectId}
                  onValueChange={setCalendarCreateProjectId}
                  options={calendarProjectOptions}
                  ariaLabel="Select project for new personal calendar events"
                  triggerClassName="min-w-44"
                />
              ) : null}
            </div>
            {calendarError ? (
              <div className="mt-3 rounded-panel border border-danger/30 bg-danger/5 p-4" role="alert">
                <p className="text-sm text-danger">{calendarError}</p>
                <button
                  type="button"
                  onClick={() => {
                    void refreshCalendar();
                  }}
                  className="mt-3 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <CalendarModuleSkin
                  events={calendarEvents}
                  loading={calendarLoading}
                  scope={calendarMode}
                  onScopeChange={setCalendarMode}
                  onOpenRecord={onOpenHubRecord}
                  onCreateEvent={
                    accessToken && selectedCalendarCreateProjectId
                      ? async (payload) => {
                          await createEventFromNlp(accessToken, selectedCalendarCreateProjectId, payload);
                          await refreshCalendar();
                        }
                      : undefined
                  }
                />
              </div>
            )}
          </section>
        </>
      ) : null}

      <Dialog
        open={Boolean(selectedHubRecordId)}
        onClose={onCloseSelectedRecord}
        triggerRef={selectedHubRecordTriggerRef}
        title="Record Inspector"
        description="Review the selected Hub item without leaving the Hub."
        panelClassName="max-w-2xl"
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
