import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconButton, Select } from '../components/primitives';
import { Dialog as DialogRoot, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { focusWhenReady } from '../lib/focusWhenReady';
import { listCollections } from '../services/hub/collections';
import { convertRecord, createPersonalTask, createRecord } from '../services/hub/records';
import type { HubCollection, HubHomeCapture } from '../services/hub/types';
import type { ProjectRecord } from '../types/domain';

const LAST_PROJECT_KEY = 'hub:last-opened-project-id';
const PENDING_CAPTURE_DRAFT_KEY = 'hub:pending-project-capture';
const PERSONAL_CAPTURE_TARGET = '__personal__';

type CaptureMode = 'thought' | 'task' | 'reminder' | 'calendar';

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

const captureModeFromIntent = (intent: string | null): CaptureMode => {
  if (intent === 'event') {
    return 'calendar';
  }
  if (intent === 'project-task') {
    return 'task';
  }
  if (intent === 'reminder') {
    return 'reminder';
  }
  return 'thought';
};

const selectPersonalCaptureCollection = (collections: HubCollection[]): HubCollection | null => {
  if (collections.length === 0) {
    return null;
  }

  const preferred = collections.find((collection) => {
    const name = collection.name.toLowerCase();
    return ['inbox', 'capture', 'note', 'journal'].some((keyword) => name.includes(keyword));
  });

  return preferred || collections[0] || null;
};

const selectProjectCaptureCollection = (collections: HubCollection[], mode: CaptureMode): HubCollection | null => {
  if (collections.length === 0) {
    return null;
  }

  if (mode === 'thought') {
    return selectPersonalCaptureCollection(collections);
  }

  const rankedCollectionIds = new Set<string>();
  const rankByKeywords = (keywords: string[]) => {
    for (const collection of collections) {
      const haystack = `${collection.name} ${collection.collection_id}`.toLowerCase();
      if (keywords.some((keyword) => haystack.includes(keyword))) {
        rankedCollectionIds.add(collection.collection_id);
      }
    }
  };

  if (mode === 'task') {
    rankByKeywords(['task', 'todo']);
  } else if (mode === 'reminder') {
    rankByKeywords(['reminder']);
  } else if (mode === 'calendar') {
    rankByKeywords(['event', 'calendar']);
  }

  if (rankedCollectionIds.size > 0) {
    const selected = collections.find((collection) => rankedCollectionIds.has(collection.collection_id));
    if (selected) {
      return selected;
    }
  }

  return collections[0] || null;
};

const parseIso = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const formatRelativeDateTime = (value: string | null): string => {
  const parsed = parseIso(value);
  if (!parsed) {
    return 'No date';
  }
  const now = new Date();
  const dayDelta = Math.round((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (dayDelta === 0) {
    return `Today ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (dayDelta === 1) {
    return `Tomorrow ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (dayDelta > 1 && dayDelta < 7) {
    return parsed.toLocaleDateString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  }
  if (dayDelta < 0) {
    return `Overdue ${parsed.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  }
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const truncateCaptureTitle = (title: string): string => {
  const normalized = title.trim();
  if (normalized.length <= 250) {
    return normalized;
  }
  return `${normalized.slice(0, 247)}...`;
};

type CaptureSortDirection = 'desc' | 'asc';

interface ExpandedCaptureAssignment {
  recordId: string;
  mode: CaptureMode;
  projectId: string;
}

interface QuickCaptureProps {
  accessToken: string | null;
  projects: ProjectRecord[];
  personalProjectId: string | null;
  captures: HubHomeCapture[];
  onCaptureComplete: () => void | Promise<void>;
}

export const QuickCapture = ({
  accessToken,
  projects,
  personalProjectId,
  captures,
  onCaptureComplete,
}: QuickCaptureProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('thought');
  const [captureTargetProjectId, setCaptureTargetProjectId] = useState(PERSONAL_CAPTURE_TARGET);
  const [captureOptionsExpanded, setCaptureOptionsExpanded] = useState(false);
  const [captureSaving, setCaptureSaving] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [personalCollections, setPersonalCollections] = useState<HubCollection[]>([]);
  const [captureSortDirection, setCaptureSortDirection] = useState<CaptureSortDirection>('desc');
  const [expandedCaptureAssignment, setExpandedCaptureAssignment] = useState<ExpandedCaptureAssignment | null>(null);
  const [captureAssignmentSavingId, setCaptureAssignmentSavingId] = useState<string | null>(null);
  const [captureAssignmentError, setCaptureAssignmentError] = useState<string | null>(null);
  const [expandedHoverCaptureId, setExpandedHoverCaptureId] = useState<string | null>(null);
  const captureTriggerRef = useRef<HTMLButtonElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);
  const projectCollectionsCacheRef = useRef<Record<string, HubCollection[]>>({});

  const lastOpenedProjectId = safeGetLastProjectId();
  const lastOpenedProject = useMemo(
    () => projects.find((project) => project.id === lastOpenedProjectId) || null,
    [lastOpenedProjectId, projects],
  );
  const defaultProjectCaptureTarget = lastOpenedProject?.id ?? projects[0]?.id ?? PERSONAL_CAPTURE_TARGET;
  const captureProjectOptions = useMemo(
    () => [
      { value: PERSONAL_CAPTURE_TARGET, label: 'Personal Hub', disabled: captureMode === 'reminder' || captureMode === 'calendar' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [captureMode, projects],
  );
  const captureTypeOptions = useMemo(
    () => [
      { value: 'thought', label: 'Thought' },
      { value: 'task', label: 'Task' },
      { value: 'reminder', label: 'Reminder' },
      { value: 'calendar', label: 'Calendar' },
    ],
    [],
  );
  const captureAssignmentTypeOptions = useMemo(
    () => captureTypeOptions.filter((option) => option.value === 'thought' || option.value === 'task'),
    [captureTypeOptions],
  );
  const sortedCaptures = useMemo(() => {
    const direction = captureSortDirection === 'asc' ? 1 : -1;
    return [...captures].sort((left, right) => {
      const leftTime = parseIso(left.created_at)?.getTime() ?? 0;
      const rightTime = parseIso(right.created_at)?.getTime() ?? 0;
      if (leftTime === rightTime) {
        return left.record_id.localeCompare(right.record_id) * direction;
      }
      return (leftTime - rightTime) * direction;
    });
  }, [captureSortDirection, captures]);

  const focusCaptureInput = useCallback(() => focusWhenReady(() => captureInputRef.current), []);

  const loadPersonalCollections = useCallback(async () => {
    if (!accessToken || !personalProjectId) {
      return [];
    }
    const cached = projectCollectionsCacheRef.current[personalProjectId];
    if (cached) {
      setPersonalCollections(cached);
      return cached;
    }
    const collections = await listCollections(accessToken, personalProjectId);
    projectCollectionsCacheRef.current[personalProjectId] = collections;
    setPersonalCollections(collections);
    return collections;
  }, [accessToken, personalProjectId]);

  const loadProjectCollections = useCallback(
    async (projectId: string) => {
      if (!accessToken) {
        return [];
      }
      const cached = projectCollectionsCacheRef.current[projectId];
      if (cached) {
        return cached;
      }
      const collections = await listCollections(accessToken, projectId);
      projectCollectionsCacheRef.current[projectId] = collections;
      if (projectId === personalProjectId) {
        setPersonalCollections(collections);
      }
      return collections;
    },
    [accessToken, personalProjectId],
  );

  const resetCaptureComposer = useCallback(
    (nextMode: CaptureMode = 'thought', expandOptions = false, nextProjectId = PERSONAL_CAPTURE_TARGET) => {
      setCaptureText('');
      setCaptureMode(nextMode);
      setCaptureOptionsExpanded(expandOptions);
      setCaptureTargetProjectId(nextProjectId);
      setCaptureError(null);
      setCaptureNotice(null);
    },
    [],
  );

  useEffect(() => {
    if (searchParams.get('capture') !== '1') {
      return;
    }

    const intent = searchParams.get('intent');
    const nextMode = captureModeFromIntent(intent);
    const nextProjectId = nextMode === 'thought' ? PERSONAL_CAPTURE_TARGET : defaultProjectCaptureTarget;
    resetCaptureComposer(nextMode, nextMode !== 'thought', nextProjectId);
    setCaptureOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('capture');
    nextParams.delete('intent');
    setSearchParams(nextParams, { replace: true });
  }, [defaultProjectCaptureTarget, resetCaptureComposer, searchParams, setSearchParams]);

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

  useEffect(() => {
    if (!captureOpen) {
      return;
    }
    return focusCaptureInput();
  }, [captureOpen, focusCaptureInput]);

  useEffect(() => {
    if (!accessToken || !personalProjectId) {
      setPersonalCollections([]);
      return;
    }

    let cancelled = false;
    void listCollections(accessToken, personalProjectId)
      .then((collections) => {
        if (!cancelled) {
          projectCollectionsCacheRef.current[personalProjectId] = collections;
          setPersonalCollections(collections);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonalCollections([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, personalProjectId]);

  useEffect(() => {
    if (!expandedCaptureAssignment) {
      return;
    }
    const stillExists = captures.some((capture) => capture.record_id === expandedCaptureAssignment.recordId);
    if (!stillExists) {
      setExpandedCaptureAssignment(null);
      setCaptureAssignmentError(null);
    }
  }, [captures, expandedCaptureAssignment]);

  useEffect(() => () => {
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
    }
  }, []);

  const onOpenCapture = () => {
    resetCaptureComposer('thought', false, PERSONAL_CAPTURE_TARGET);
    setCaptureOpen(true);
  };

  const onCloseCapture = useCallback(() => {
    setCaptureOpen(false);
    setCaptureSaving(false);
    setExpandedCaptureAssignment(null);
    setCaptureAssignmentError(null);
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    setExpandedHoverCaptureId(null);
    resetCaptureComposer('thought', false, PERSONAL_CAPTURE_TARGET);
  }, [resetCaptureComposer]);

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

    setCaptureNotice(null);
    setCaptureSaving(true);
    void (async () => {
      try {
        if (captureMode === 'thought') {
          const collections = personalCollections.length > 0 ? personalCollections : await loadPersonalCollections();
          const targetCollection = selectPersonalCaptureCollection(collections);
          if (!personalProjectId || !targetCollection) {
            setCaptureError('Personal capture is unavailable right now.');
            return;
          }

          await createRecord(accessToken, personalProjectId, {
            collection_id: targetCollection.collection_id,
            title: trimmed,
          });
          await onCaptureComplete();
          setCaptureNotice('Saved');
          setCaptureText('');
          setCaptureError(null);
          focusCaptureInput();
          return;
        }

        if (captureMode === 'task' && captureTargetProjectId === PERSONAL_CAPTURE_TARGET) {
          await createPersonalTask(accessToken, { title: trimmed });
          await onCaptureComplete();
          setCaptureNotice('Saved');
          setCaptureText('');
          setCaptureError(null);
          focusCaptureInput();
          return;
        }

        if (captureTargetProjectId === PERSONAL_CAPTURE_TARGET) {
          setCaptureError('Choose a project to categorize this capture.');
          return;
        }

        const intent = captureMode === 'calendar' ? 'event' : captureMode === 'task' ? 'project-task' : 'reminder';
        window.sessionStorage.setItem(
          PENDING_CAPTURE_DRAFT_KEY,
          JSON.stringify({
            intent,
            seedText: trimmed,
          }),
        );
        setCaptureText('');
        setCaptureError(null);
        setCaptureOpen(false);
        navigate(`/projects/${captureTargetProjectId}/work?capture=1&intent=${encodeURIComponent(intent)}`);
      } catch (error) {
        setCaptureError(error instanceof Error ? error.message : 'Failed to save capture.');
        focusCaptureInput();
      } finally {
        setCaptureSaving(false);
      }
    })();
  };

  const assignmentProjectOptions = useMemo(
    () => [
      { value: PERSONAL_CAPTURE_TARGET, label: 'Personal Hub', disabled: false },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects],
  );

  const applyCaptureAssignment = useCallback(
    async (capture: HubHomeCapture, nextMode: CaptureMode, nextProjectId: string) => {
      if (!accessToken) {
        setCaptureAssignmentError('An authenticated session is required.');
        return;
      }
      if (captureAssignmentSavingId) {
        return;
      }
      if (nextMode === 'thought' && nextProjectId === PERSONAL_CAPTURE_TARGET) {
        setExpandedCaptureAssignment(null);
        setCaptureAssignmentError(null);
        return;
      }
      if ((nextMode === 'reminder' || nextMode === 'calendar') && nextProjectId === PERSONAL_CAPTURE_TARGET) {
        setCaptureAssignmentError('Choose a project to assign reminders or calendar items.');
        return;
      }
      if (nextMode === 'reminder' || nextMode === 'calendar') {
        setCaptureAssignmentError('Reminder and calendar capture conversion is not supported yet.');
        return;
      }

      setCaptureAssignmentSavingId(capture.record_id);
      setCaptureAssignmentError(null);
      try {
        const targetProjectId = nextProjectId === PERSONAL_CAPTURE_TARGET ? personalProjectId : nextProjectId;
        if (!targetProjectId) {
          throw new Error('A target project is required.');
        }

        let targetCollectionId: string | undefined;
        if (!(nextMode === 'task' && nextProjectId === PERSONAL_CAPTURE_TARGET)) {
          const collections = targetProjectId === personalProjectId ? await loadPersonalCollections() : await loadProjectCollections(targetProjectId);
          const targetCollection = targetProjectId === personalProjectId && nextMode === 'thought'
            ? selectPersonalCaptureCollection(collections)
            : selectProjectCaptureCollection(collections, nextMode);
          if (!targetCollection) {
            throw new Error('No matching collection is available for this assignment.');
          }
          targetCollectionId = targetCollection.collection_id;
        }

        await convertRecord(accessToken, capture.record_id, {
          mode: nextMode,
          target_project_id: targetProjectId,
          ...(targetCollectionId ? { target_collection_id: targetCollectionId } : {}),
        });

        await onCaptureComplete();
        setExpandedCaptureAssignment(null);
        setCaptureAssignmentError(null);
      } catch (error) {
        setCaptureAssignmentError(error instanceof Error ? error.message : 'Failed to assign capture.');
      } finally {
        setCaptureAssignmentSavingId(null);
      }
    },
    [
      accessToken,
      captureAssignmentSavingId,
      loadPersonalCollections,
      loadProjectCollections,
      onCaptureComplete,
      personalProjectId,
    ],
  );

  const onToggleCaptureAssignment = (capture: HubHomeCapture) => {
    setCaptureAssignmentError(null);
    setExpandedCaptureAssignment((current) => {
      if (current?.recordId === capture.record_id) {
        return null;
      }
      return {
        recordId: capture.record_id,
        mode: 'thought',
        projectId: PERSONAL_CAPTURE_TARGET,
      };
    });
  };

  const onCaptureRowMouseEnter = (recordId: string) => {
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
    }
    hoverExpandTimerRef.current = window.setTimeout(() => {
      setExpandedHoverCaptureId(recordId);
      hoverExpandTimerRef.current = null;
    }, 2000);
  };

  const onCaptureRowMouseLeave = () => {
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    setExpandedHoverCaptureId(null);
  };

  const renderAssignmentIcon = (expanded: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {expanded ? (
        <>
          <path d="M18 15 12 9 6 15" />
        </>
      ) : (
        <>
          <path d="M3 7h18" />
          <path d="M6 12h12" />
          <path d="M10 17h4" />
        </>
      )}
    </svg>
  );

  return (
    <>
      <button
        type="button"
        onClick={onOpenCapture}
        ref={captureTriggerRef}
        className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        New Capture
      </button>

      <DialogRoot open={captureOpen} onOpenChange={(nextOpen) => (!nextOpen ? onCloseCapture() : undefined)}>
        <DialogContent
          className="w-full max-w-xl border border-border-muted bg-surface-elevated p-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
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
              <DialogDescription className="sr-only">Type and save. Expand options only if you need to route it.</DialogDescription>
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-primary">Recent Captures</h3>
              <button
                type="button"
                onClick={() => {
                  setCaptureSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
                }}
                className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={captureSortDirection === 'desc' ? 'Sort oldest first' : 'Sort newest first'}
              >
                {captureSortDirection === 'desc' ? 'Newest ↓' : 'Oldest ↑'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={captureInputRef}
                type="text"
                value={captureText}
                onChange={(event) => setCaptureText(event.target.value)}
                placeholder="Capture something..."
                autoComplete="off"
                disabled={captureSaving}
                className="flex-1 rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
              <IconButton
                aria-label={captureOptionsExpanded ? 'Hide capture options' : 'Show capture options'}
                aria-expanded={captureOptionsExpanded}
                aria-controls="quick-capture-options"
                size="sm"
                variant="secondary"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  setCaptureOptionsExpanded((current) => !current);
                }}
              >
                {renderAssignmentIcon(captureOptionsExpanded)}
              </IconButton>
              <button type="submit" className="sr-only">
                Save capture
              </button>
            </div>

            <div className="flex min-h-5 items-center justify-between gap-3">
              <div className="text-xs text-muted" role="status" aria-live="polite">
                {captureSaving ? 'Saving...' : captureNotice || ''}
              </div>
              {!captureOptionsExpanded ? <span className="text-xs text-muted">Enter saves</span> : null}
            </div>

            {captureOptionsExpanded ? (
              <div id="quick-capture-options" className="grid gap-3 rounded-panel border border-border-muted bg-surface p-3 md:grid-cols-2">
                <div className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
                  <span>Type</span>
                  <Select
                    id="quick-capture-type"
                    value={captureMode}
                    onValueChange={(value) => {
                      const nextMode = value as CaptureMode;
                      setCaptureMode(nextMode);
                      if (nextMode === 'thought') {
                        setCaptureTargetProjectId(PERSONAL_CAPTURE_TARGET);
                      } else if (
                        captureTargetProjectId === PERSONAL_CAPTURE_TARGET
                        && (nextMode === 'reminder' || nextMode === 'calendar')
                      ) {
                        setCaptureTargetProjectId(defaultProjectCaptureTarget);
                      }
                    }}
                    options={captureTypeOptions}
                    ariaLabel="Capture type"
                    triggerClassName="w-full min-w-0"
                  />
                </div>

                {captureMode !== 'thought' ? (
                  <div className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
                    <span>Project</span>
                    <Select
                      id="quick-capture-project"
                      value={captureTargetProjectId}
                      onValueChange={setCaptureTargetProjectId}
                      options={captureProjectOptions}
                      ariaLabel="Capture project"
                      triggerClassName="w-full min-w-0"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {captureMode !== 'thought' && captureTargetProjectId === PERSONAL_CAPTURE_TARGET ? (
              <p className="text-xs text-muted">Reminders and calendar items need a project.</p>
            ) : null}

            {captureMode !== 'thought' && projects.length === 0 ? (
              <p className="text-xs text-muted">Create a project to route reminders or calendar captures.</p>
            ) : null}

            {captureError ? (
              <p className="text-sm text-danger" role="alert" aria-live="polite">
                {captureError}
              </p>
            ) : null}

            {sortedCaptures.length > 0 ? (
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-panel border border-border-muted bg-surface p-2">
                {sortedCaptures.map((capture) => {
                  const assignmentExpanded = expandedCaptureAssignment?.recordId === capture.record_id;
                  const assignmentProjectId = expandedCaptureAssignment?.recordId === capture.record_id
                    ? expandedCaptureAssignment.projectId
                    : PERSONAL_CAPTURE_TARGET;
                  const assignmentMode = expandedCaptureAssignment?.recordId === capture.record_id
                    ? expandedCaptureAssignment.mode
                    : 'thought';
                  const rowSaving = captureAssignmentSavingId === capture.record_id;
                  const titleExpanded = expandedHoverCaptureId === capture.record_id;
                  return (
                    <div key={capture.record_id} className="rounded-panel border border-border-muted bg-surface-elevated p-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="min-w-0 flex-1"
                          onMouseEnter={() => onCaptureRowMouseEnter(capture.record_id)}
                          onMouseLeave={onCaptureRowMouseLeave}
                        >
                          <p className={titleExpanded ? 'break-words text-sm text-text' : 'overflow-hidden text-ellipsis whitespace-nowrap text-sm text-text'}>
                            {titleExpanded ? capture.title : truncateCaptureTitle(capture.title)}
                          </p>
                          <p className="mt-1 text-xs text-muted">{formatRelativeDateTime(capture.created_at)}</p>
                        </div>
                        <IconButton
                          aria-label={assignmentExpanded ? 'Hide capture assignment options' : 'Show capture assignment options'}
                          aria-expanded={assignmentExpanded}
                          aria-controls={`quick-capture-item-options-${capture.record_id}`}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            onToggleCaptureAssignment(capture);
                          }}
                          disabled={rowSaving}
                        >
                          {renderAssignmentIcon(assignmentExpanded)}
                        </IconButton>
                      </div>

                      {assignmentExpanded ? (
                        <div
                          id={`quick-capture-item-options-${capture.record_id}`}
                          className="mt-3 space-y-3 rounded-panel border border-border-muted bg-surface p-3"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
                              <span>Type</span>
                              <Select
                                id={`quick-capture-item-type-${capture.record_id}`}
                                value={assignmentMode}
                                onValueChange={(value) => {
                                  const nextMode = value as CaptureMode;
                                  const nextProjectId = nextMode === 'thought'
                                    ? PERSONAL_CAPTURE_TARGET
                                    : assignmentProjectId === PERSONAL_CAPTURE_TARGET && (nextMode === 'reminder' || nextMode === 'calendar')
                                      ? defaultProjectCaptureTarget
                                      : assignmentProjectId;
                                  setExpandedCaptureAssignment({
                                    recordId: capture.record_id,
                                    mode: nextMode,
                                    projectId: nextProjectId,
                                  });
                                  if (nextMode === 'thought' || (nextMode === 'task' && nextProjectId === PERSONAL_CAPTURE_TARGET)) {
                                    void applyCaptureAssignment(capture, nextMode, nextProjectId);
                                  } else if (nextProjectId !== PERSONAL_CAPTURE_TARGET) {
                                    void applyCaptureAssignment(capture, nextMode, nextProjectId);
                                  }
                                }}
                                options={captureAssignmentTypeOptions}
                                ariaLabel="Capture assignment type"
                                triggerClassName="w-full min-w-0"
                              />
                            </div>

                            {assignmentMode !== 'thought' ? (
                              <div className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
                                <span>Project</span>
                                <Select
                                  id={`quick-capture-item-project-${capture.record_id}`}
                                  value={assignmentProjectId}
                                  onValueChange={(value) => {
                                    setExpandedCaptureAssignment({
                                      recordId: capture.record_id,
                                      mode: assignmentMode,
                                      projectId: value,
                                    });
                                    if (value !== PERSONAL_CAPTURE_TARGET || assignmentMode === 'task') {
                                      void applyCaptureAssignment(capture, assignmentMode, value);
                                    }
                                  }}
                                  options={assignmentProjectOptions}
                                  ariaLabel="Capture assignment project"
                                  triggerClassName="w-full min-w-0"
                                />
                              </div>
                            ) : null}
                          </div>

                          {captureAssignmentError ? (
                            <p className="text-sm text-danger" role="alert" aria-live="polite">
                              {captureAssignmentError}
                            </p>
                          ) : null}
                          {rowSaving ? <p className="text-xs text-muted">Assigning...</p> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
