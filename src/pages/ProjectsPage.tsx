import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext';
import { useAuthz } from '../context/AuthzContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Dialog } from '../components/primitives';
import { Dialog as DialogRoot, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { PersonalizedDashboardPanel } from '../features/PersonalizedDashboardPanel';
import { createHubProject } from '../services/projectsService';
import { createPersonalTask, getHubHome, getRecordDetail } from '../services/hub/records';
import type { HubRecordDetail } from '../services/hub/types';
import { subscribeHubLive } from '../services/hubLive';

const LAST_PROJECT_KEY = 'hub:last-opened-project-id';
const PENDING_CAPTURE_DRAFT_KEY = 'hub:pending-project-capture';

const safeGetLastProjectId = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY) || '';
  } catch {
    return '';
  }
};

type CaptureDestination = 'tasks' | 'reminder' | 'calendar';

const destinationLabel: Record<CaptureDestination, string> = {
  tasks: 'Tasks',
  reminder: 'Reminders',
  calendar: 'Calendar',
};

const captureDestinationFromIntent = (intent: string | null): CaptureDestination => {
  if (intent === 'event') {
    return 'calendar';
  }
  if (intent === 'project-task') {
    return 'tasks';
  }
  return 'reminder';
};

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, loading, error, refreshProjects } = useProjects();
  const { accessToken, refreshSession } = useAuthz();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [captureDestination, setCaptureDestination] = useState<CaptureDestination>('reminder');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<{
    personal_project_id: Awaited<ReturnType<typeof getHubHome>>['personal_project_id'];
    tasks: Awaited<ReturnType<typeof getHubHome>>['tasks'];
    tasks_next_cursor: Awaited<ReturnType<typeof getHubHome>>['tasks_next_cursor'];
    events: Awaited<ReturnType<typeof getHubHome>>['events'];
    notifications: Awaited<ReturnType<typeof getHubHome>>['notifications'];
  }>({
    personal_project_id: null,
    tasks: [],
    tasks_next_cursor: null,
    events: [],
    notifications: [],
  });
  const [selectedHubRecordId, setSelectedHubRecordId] = useState<string | null>(null);
  const [selectedHubRecord, setSelectedHubRecord] = useState<HubRecordDetail | null>(null);
  const [selectedHubRecordLoading, setSelectedHubRecordLoading] = useState(false);
  const [selectedHubRecordError, setSelectedHubRecordError] = useState<string | null>(null);
  const captureTriggerRef = useRef<HTMLButtonElement | null>(null);
  const captureTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedRecordAbortControllerRef = useRef<AbortController | null>(null);
  const selectedRecordRequestIdRef = useRef(0);
  const selectedHubRecordIdRef = useRef<string | null>(null);

  const lastOpenedProjectId = safeGetLastProjectId();
  const lastOpenedProject = useMemo(
    () => projects.find((project) => project.id === lastOpenedProjectId) || null,
    [lastOpenedProjectId, projects],
  );

  useEffect(() => {
    if (searchParams.get('capture') !== '1') {
      return;
    }

    const intent = searchParams.get('intent');
    setCaptureDestination(captureDestinationFromIntent(intent));
    setCaptureError(null);
    setCaptureOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('capture');
    nextParams.delete('intent');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const taskId = searchParams.get('task_id');
    if (!taskId) {
      return;
    }
    selectedHubRecordIdRef.current = taskId;
    setSelectedHubRecordId(taskId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('task_id');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!captureNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCaptureNotice(null);
    }, 2200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [captureNotice]);

  const refreshHome = useCallback(async () => {
    if (!accessToken) {
      setHomeData({ personal_project_id: null, tasks: [], tasks_next_cursor: null, events: [], notifications: [] });
      setHomeError(null);
      setHomeLoading(false);
      return;
    }

    setHomeLoading(true);
    try {
      const next = await getHubHome(accessToken, {
        tasks_limit: 8,
        events_limit: 8,
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

  const onOpenCapture = () => {
    setCaptureError(null);
    setCaptureOpen(true);
  };

  const onCloseCapture = useCallback(() => {
    setCaptureOpen(false);
    setCaptureError(null);
  }, []);

  const onOpenHubRecord = useCallback((recordId: string) => {
    selectedHubRecordIdRef.current = recordId;
    setSelectedHubRecordId(recordId);
  }, []);

  const onCloseSelectedRecord = useCallback(() => {
    selectedRecordAbortControllerRef.current?.abort();
    selectedRecordAbortControllerRef.current = null;
    selectedRecordRequestIdRef.current += 1;
    selectedHubRecordIdRef.current = null;
    setSelectedHubRecordId(null);
    setSelectedHubRecord(null);
    setSelectedHubRecordError(null);
    setSelectedHubRecordLoading(false);
  }, []);

  const onSaveCapture = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = captureText.trim();
    if (!trimmed) {
      setCaptureError('Capture text is required.');
      return;
    }

    if (!accessToken) {
      setCaptureError('An authenticated session is required.');
      return;
    }

    if (captureDestination === 'calendar') {
      setCaptureError('Calendar capture is coming soon. Use Tasks for now.');
      return;
    }

    const intent = captureDestination === 'tasks' ? 'project-task' : 'reminder';

    if (captureDestination === 'tasks') {
      void (async () => {
        try {
          const created = await createPersonalTask(accessToken, { title: trimmed });
          await refreshHome();
          setCaptureNotice('Task added to Hub.');
          setCaptureText('');
          setCaptureError(null);
          setCaptureOpen(false);
          selectedHubRecordIdRef.current = created.task.record_id;
          setSelectedHubRecordId(created.task.record_id);
        } catch (error) {
          setCaptureError(error instanceof Error ? error.message : 'Failed to create Hub task.');
        }
      })();
      return;
    }

    const targetProject = lastOpenedProject ?? projects[0] ?? null;
    if (!targetProject) {
      setCaptureError('Open or create a project first so this capture has somewhere to go.');
      return;
    }

    try {
      window.sessionStorage.setItem(
        PENDING_CAPTURE_DRAFT_KEY,
        JSON.stringify({
          intent,
          seedText: trimmed,
        }),
      );
      setCaptureNotice(`Capture sent to ${destinationLabel[captureDestination]}.`);
      setCaptureText('');
      setCaptureError(null);
      setCaptureOpen(false);
      navigate(`/projects/${targetProject.id}/work?capture=1&intent=${encodeURIComponent(intent)}`);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Failed to forward capture.');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hub"
        description="Your personal big picture across projects, with work opening in the Record Inspector without leaving the Hub."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCapture}
              ref={captureTriggerRef}
              className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              New Capture
            </button>
            {lastOpenedProject ? (
              <button
                type="button"
                onClick={() => navigate(`/projects/${lastOpenedProject.id}/work`)}
                className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Resume {lastOpenedProject.name}
              </button>
            ) : null}
          </div>
        }
      />

      <PersonalizedDashboardPanel
        homeData={homeData}
        homeLoading={homeLoading}
        homeError={homeError}
        projects={projects}
        onOpenRecord={onOpenHubRecord}
      />

      {captureNotice ? (
        <section className="rounded-panel border border-subtle bg-elevated p-4">
          <p className="text-sm text-text-secondary" role="status" aria-live="polite">
            {captureNotice}
          </p>
        </section>
      ) : null}

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

      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="heading-3 text-primary">Projects</h2>
          {loading ? <span className="text-xs text-muted">Loading...</span> : null}
        </div>

        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

        {!loading && projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No projects yet. Create one to begin.</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-label="Project list">
            {projects.map((project) => (
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

      <DialogRoot open={captureOpen} onOpenChange={(nextOpen) => (!nextOpen ? onCloseCapture() : undefined)}>
        <DialogContent
          className="w-full max-w-xl border border-border-muted bg-surface-elevated p-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            captureTextareaRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (captureTriggerRef.current) {
              event.preventDefault();
              captureTriggerRef.current.focus();
            }
          }}
        >
          <DialogHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <DialogTitle className="heading-3 text-primary">New Capture</DialogTitle>
              <DialogDescription>Capture a quick task, reminder, or calendar item.</DialogDescription>
            </div>
            <button
              type="button"
              onClick={onCloseCapture}
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Close
            </button>
          </DialogHeader>

          <form className="mt-3 space-y-3" onSubmit={onSaveCapture}>
            <textarea
              ref={captureTextareaRef}
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              placeholder="Write what you need to capture..."
              rows={7}
              className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-wide text-muted">Destination</legend>
              <div className="flex flex-wrap gap-2">
                {(['tasks', 'reminder', 'calendar'] as CaptureDestination[]).map((destination) => (
                  <button
                    key={destination}
                    type="button"
                    onClick={() => setCaptureDestination(destination)}
                    className="rounded-control border px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    style={{
                      borderColor:
                        captureDestination === destination ? 'var(--color-primary)' : 'var(--color-border-muted)',
                      color: captureDestination === destination ? 'var(--color-text)' : 'var(--color-muted)',
                      background:
                        captureDestination === destination
                          ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                          : 'transparent',
                    }}
                  >
                    {destinationLabel[destination]}
                  </button>
                ))}
              </div>
            </fieldset>

            {captureError ? (
              <p className="text-sm text-danger" role="alert" aria-live="polite">
                {captureError}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCloseCapture}
                className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Save Capture
              </button>
            </div>
          </form>
        </DialogContent>
      </DialogRoot>

      <Dialog
        open={Boolean(selectedHubRecordId)}
        onClose={onCloseSelectedRecord}
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
