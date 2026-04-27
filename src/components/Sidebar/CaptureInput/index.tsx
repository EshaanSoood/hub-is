import { motion, useReducedMotion } from 'framer-motion';
import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildReminderCreatePayload } from '../../../hooks/useReminderNLDraft';
import { calendarPreviewToFormPreview, type CalendarParseResult } from '../../../hooks/useCalendarNLDraft';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import { classifyIntent } from '../../../lib/nlp/intent';
import { parseReminderInput } from '../../../lib/nlp/reminder-parser';
import { parseTaskInput } from '../../../lib/nlp/task-parser';
import { createEventFromNlp, createPersonalTask, createRecord } from '../../../services/hub/records';
import { createReminder } from '../../../services/hub/reminders';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { cn } from '../../../lib/cn';
import { SidebarLabel } from '../motion/SidebarLabel';
import { recordRecentProjectContribution } from '../../../features/recentPlaces/store';
import {
  sidebarCaptureFocusVariants,
  sidebarMotionLayoutIds,
} from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import {
  type CaptureDestination,
  type CaptureKind,
  type SidebarCaptureSurface,
  captureKindBySidebarSurface,
  createQuickThoughtEntry,
  widgetTypesByCaptureKind,
  readQuickThoughtStorageKey,
  readProjectHasWidgetType,
  selectCollectionId,
} from './shared';

const importCaptureDialog = () => import('./CaptureDialog');
const CaptureDialog = lazy(async () => {
  const module = await importCaptureDialog();
  return { default: module.CaptureDialog };
});

interface CaptureInputProps {
  accessToken: string | null | undefined;
  autoFocusKey: number;
  currentProjectId: string | null;
  currentProject: ProjectRecord | null;
  currentProjectProjects: HubProjectSummary[];
  currentSurface: SidebarCaptureSurface;
  currentSurfaceLabel: string | null;
  isCollapsed: boolean;
  onOpenCapture: () => void;
  placeholder?: string;
  personalProject: ProjectRecord | null;
  showLabels: boolean;
  variant?: 'sidebar' | 'command-bar';
}

const resolveCaptureKind = (draft: string, currentSurface: SidebarCaptureSurface): CaptureKind => {
  if (currentSurface) {
    return captureKindBySidebarSurface[currentSurface];
  }
  const intent = classifyIntent(draft);
  if (intent.intent === 'task') {
    return 'task';
  }
  if (intent.intent === 'event') {
    return 'event';
  }
  if (intent.intent === 'reminder') {
    return 'reminder';
  }
  return 'thought';
};

const parseEventPreview = async (
  draft: string,
  timezone: string,
): Promise<ReturnType<typeof calendarPreviewToFormPreview> | null> => {
  type WorkerResponse = {
    requestId: number;
    preview: CalendarParseResult;
    error: string | null;
  };

  return new Promise((resolve) => {
    const worker = new Worker(new URL('../../../workers/calendarNlpWorker.js', import.meta.url), { type: 'module' });
    const requestId = Date.now();
    let settled = false;
    let timeoutId: number | null = null;

    const finish = (preview: ReturnType<typeof calendarPreviewToFormPreview> | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      worker.terminate();
      resolve(preview);
    };

    timeoutId = window.setTimeout(() => {
      finish(null);
    }, 5000);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data?.requestId !== requestId) {
        return;
      }
      finish(event.data.error ? null : calendarPreviewToFormPreview(event.data.preview));
    };

    worker.onerror = () => {
      finish(null);
    };

    worker.postMessage({ requestId, draft, timezone });
  });
};

export const CaptureInput = ({
  accessToken,
  autoFocusKey,
  currentProjectId,
  currentProject,
  currentProjectProjects,
  currentSurface,
  currentSurfaceLabel,
  isCollapsed,
  onOpenCapture,
  placeholder,
  personalProject,
  showLabels,
  variant = 'sidebar',
}: CaptureInputProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [draft, setDraft] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasOpenedDialog, setHasOpenedDialog] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captureKind, setCaptureKind] = useState<CaptureKind>('thought');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const projectDestinations = useMemo<Record<CaptureKind, CaptureDestination | null>>(() => {
    if (!currentProject) {
      return {
        thought: null,
        task: null,
        event: null,
        reminder: null,
      };
    }
    const activeProject = currentProjectId
      ? currentProjectProjects.find((project) => project.project_id === currentProjectId) || null
      : null;
    const resolveProjectDestination = (kind: CaptureKind): CaptureDestination | null => {
      if (kind === 'thought') {
        const scratchPadProject = activeProject || currentProjectProjects[0] || null;
        if (!scratchPadProject) {
          return null;
        }
        return {
          kind: 'project',
          label: `${currentProject.name} / ${scratchPadProject.name}`,
          project: scratchPadProject,
          space: currentProject,
        };
      }
      const requiredWidgetType = widgetTypesByCaptureKind[kind];
      const matchingProject = activeProject && readProjectHasWidgetType(activeProject, requiredWidgetType)
        ? activeProject
        : currentProjectProjects.find((project) => readProjectHasWidgetType(project, requiredWidgetType)) || null;
      if (!matchingProject) {
        return null;
      }
      return {
        kind: 'project',
        label: `${currentProject.name} / ${matchingProject.name}`,
        project: matchingProject,
        space: currentProject,
      };
    };
    return {
      thought: resolveProjectDestination('thought'),
      task: resolveProjectDestination('task'),
      event: resolveProjectDestination('event'),
      reminder: resolveProjectDestination('reminder'),
    };
  }, [currentProjectId, currentProject, currentProjectProjects]);

  const projectDestination = projectDestinations[captureKind];

  const destinations = useMemo<CaptureDestination[]>(
    () => [
      { kind: 'hub', label: 'Home', space: personalProject, project: null },
      ...(projectDestination ? [projectDestination] : []),
    ],
    [projectDestination, personalProject],
  );

  const defaultDestinationValue = useMemo<'hub' | 'project'>(
    () => (currentProject && projectDestination ? 'project' : 'hub'),
    [currentProject, projectDestination],
  );
  const isCommandBarVariant = variant === 'command-bar';
  const resolvedPlaceholder = placeholder ?? (currentSurfaceLabel ? `Capture for ${currentSurfaceLabel.toLowerCase()}…` : 'Capture anything…');

  useEffect(() => {
    if (autoFocusKey > 0) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [autoFocusKey]);

  const openDialog = () => {
    if (isSubmittingRef.current || !draft.trim()) {
      inputRef.current?.focus();
      return;
    }
    setHasOpenedDialog(true);
    setCaptureKind(resolveCaptureKind(draft, currentSurface));
    setDialogOpen(true);
  };

  const submitDirectCapture = async (resolvedCaptureKind: CaptureKind): Promise<boolean> => {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || !accessToken) {
      return false;
    }
    if (isSubmittingRef.current) {
      return true;
    }

    const destination = currentProject
      ? projectDestinations[resolvedCaptureKind]
      : { kind: 'hub', label: 'Home', space: personalProject, project: null } satisfies CaptureDestination;
    if (!destination) {
      return false;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (resolvedCaptureKind === 'thought') {
        if (destination.kind === 'project' && destination.project) {
          const project = destination.project;
          const storageKey = readQuickThoughtStorageKey(project);
          if (!storageKey) {
            return false;
          }
          createQuickThoughtEntry(storageKey, trimmedDraft);
          if (currentProject) {
            recordRecentProjectContribution({
              projectId: project.project_id,
              projectName: project.name,
              spaceId: project.space_id,
              spaceName: currentProject.name,
            }, 'quick-thought');
          }
          startTransition(() => {
            navigate(buildProjectWorkHref(project.space_id, project.project_id));
          });
        } else {
          if (!personalProject?.id) {
            return false;
          }
          const collectionId = await selectCollectionId(accessToken, personalProject.id, ['inbox', 'capture', 'note', 'journal']);
          if (!collectionId) {
            return false;
          }
          await createRecord(accessToken, personalProject.id, {
            collection_id: collectionId,
            title: trimmedDraft,
          });
          requestHubHomeRefresh();
        }
      }

      if (resolvedCaptureKind === 'task') {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const parsedTask = parseTaskInput(trimmedDraft, { timezone });
        const normalizedTaskTitle = parsedTask.fields.title.trim();
        const dueAtDate = parsedTask.fields.due_at ? new Date(parsedTask.fields.due_at) : null;
        if (!normalizedTaskTitle || (dueAtDate && Number.isNaN(dueAtDate.getTime()))) {
          return false;
        }

        if (destination.kind === 'project' && destination.project) {
          const project = destination.project;
          const collectionId = await selectCollectionId(accessToken, project.space_id, ['task', 'todo']);
          if (!collectionId) {
            return false;
          }
          await createRecord(accessToken, project.space_id, {
            collection_id: collectionId,
            title: normalizedTaskTitle,
            capability_types: ['task'],
            task_state: {
              status: 'todo',
              priority: parsedTask.fields.priority,
              due_at: dueAtDate ? dueAtDate.toISOString() : null,
            },
            source_project_id: project.project_id,
          });
          requestHubHomeRefresh();
          if (currentProject) {
            recordRecentProjectContribution({
              projectId: project.project_id,
              projectName: project.name,
              spaceId: project.space_id,
              spaceName: currentProject.name,
            }, 'capture-task');
          }
          startTransition(() => {
            navigate(buildProjectWorkHref(project.space_id, project.project_id));
          });
        } else {
          if (!personalProject?.id) {
            return false;
          }
          await createPersonalTask(accessToken, {
            space_id: personalProject.id,
            title: normalizedTaskTitle,
            priority: parsedTask.fields.priority,
            due_at: dueAtDate ? dueAtDate.toISOString() : null,
          });
          requestHubHomeRefresh();
        }
      }

      if (resolvedCaptureKind === 'reminder') {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const parsedReminder = parseReminderInput(trimmedDraft, { timezone });
        const reminderPayload = buildReminderCreatePayload({
          preview: parsedReminder,
          draft: trimmedDraft,
          fallbackTitleFromDraft: true,
        });
        if (!reminderPayload.payload) {
          return false;
        }
        await createReminder(accessToken, {
          ...reminderPayload.payload,
          ...(destination.kind === 'project' && destination.project
              ? {
                  scope: 'project',
                  space_id: destination.project.space_id,
                  project_id: destination.project.project_id,
                }
            : {
                scope: 'personal',
              }),
        });
        requestHubHomeRefresh();
        if (destination.kind === 'project' && destination.project && currentProject) {
          recordRecentProjectContribution({
            projectId: destination.project.project_id,
            projectName: destination.project.name,
            spaceId: destination.project.space_id,
            spaceName: currentProject.name,
          }, 'capture-reminder');
        }
      }

      if (resolvedCaptureKind === 'event') {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const eventPreview = await parseEventPreview(trimmedDraft, timezone);
        if (!eventPreview) {
          return false;
        }
        const startDate = eventPreview.startAt ? new Date(eventPreview.startAt) : null;
        const endDate = eventPreview.endAt ? new Date(eventPreview.endAt) : null;
        if (!eventPreview.title || !startDate || !endDate) {
          return false;
        }
        if (
          Number.isNaN(startDate.getTime())
          || Number.isNaN(endDate.getTime())
          || endDate.getTime() <= startDate.getTime()
        ) {
          return false;
        }

        const projectId = destination.kind === 'project' && destination.project
          ? destination.project.space_id
          : personalProject?.id;
        if (!projectId) {
          return false;
        }
        await createEventFromNlp(accessToken, projectId, {
          title: eventPreview.title,
          start_dt: startDate.toISOString(),
          end_dt: endDate.toISOString(),
          timezone,
          ...(destination.kind === 'project' && destination.project
              ? {
                  project_id: destination.project.project_id,
                  source_project_id: destination.project.project_id,
                }
            : {}),
        });
        requestHubHomeRefresh();
        if (destination.kind === 'project' && destination.project && currentProject) {
          recordRecentProjectContribution({
            projectId: destination.project.project_id,
            projectName: destination.project.name,
            spaceId: destination.project.space_id,
            spaceName: currentProject.name,
          }, 'capture-event');
        }
      }

      setDraft('');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return true;
    } catch {
      return false;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open capture"
        className="interactive interactive-subtle sidebar-row sidebar-row-button h-10 w-10 justify-center bg-surface text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onOpenCapture}
      >
        <Icon name="edit" size={16} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', isCommandBarVariant && 'min-w-0 flex-1')}>
      <motion.div
        initial={false}
        animate={isFocused || dialogOpen ? 'focused' : 'rest'}
        variants={sidebarCaptureFocusVariants(prefersReducedMotion)}
        className={cn(
          'relative',
          isCommandBarVariant
            ? 'rounded-control border border-border-muted bg-surface px-4 py-3 shadow-soft-subtle'
            : 'sidebar-row-button rounded-panel bg-surface px-3 py-2',
        )}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => {
          requestAnimationFrame(() => {
            setIsFocused(containerRef.current?.contains(document.activeElement) ?? false);
          });
        }}
      >
        {!dialogOpen ? (
          <motion.div
            aria-hidden="true"
            layoutId={prefersReducedMotion ? undefined : sidebarMotionLayoutIds.captureSurface}
            className={cn(
              'pointer-events-none absolute inset-0',
              isCommandBarVariant ? 'rounded-control' : 'rounded-panel',
              isCommandBarVariant ? 'bg-transparent' : 'sidebar-row-button bg-surface',
            )}
          />
        ) : null}
        <div className={cn('relative z-[1] flex items-center', isCommandBarVariant ? 'gap-3' : 'gap-2')}>
          <span
            aria-hidden="true"
            className={cn(
              'flex shrink-0 items-center justify-center text-text-secondary',
              'rounded-control',
              isCommandBarVariant ? 'h-10 w-10 bg-surface-low' : 'h-8 w-8 bg-surface-low',
            )}
          >
            <Icon name="edit" size={16} />
          </span>
          {isCommandBarVariant ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                aria-busy={isSubmitting}
                onFocus={() => {
                  void importCaptureDialog();
                }}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  void importCaptureDialog();
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (isSubmittingRef.current) {
                      return;
                    }
                    const resolvedCaptureKind = resolveCaptureKind(draft, currentSurface);
                    void submitDirectCapture(resolvedCaptureKind).then((didSubmit) => {
                      if (!didSubmit) {
                        openDialog();
                      }
                    });
                  }
                }}
                placeholder={resolvedPlaceholder}
                className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm font-medium leading-none text-text outline-none placeholder:text-text-secondary"
              />
              <button
                ref={triggerRef}
                type="button"
                disabled={isSubmitting}
                aria-label="Open capture confirmation"
                className="interactive interactive-subtle ghost-button flex h-10 w-10 shrink-0 items-center justify-center bg-surface-low text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onMouseEnter={() => {
                  void importCaptureDialog();
                }}
                onClick={openDialog}
              >
                <Icon name="plus" size={14} />
              </button>
            </>
          ) : (
            <SidebarLabel show={showLabels} className="min-w-0 flex flex-1 items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                aria-busy={isSubmitting}
                onFocus={() => {
                  void importCaptureDialog();
                }}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  void importCaptureDialog();
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (isSubmittingRef.current) {
                      return;
                    }
                    const resolvedCaptureKind = resolveCaptureKind(draft, currentSurface);
                    void submitDirectCapture(resolvedCaptureKind).then((didSubmit) => {
                      if (!didSubmit) {
                        openDialog();
                      }
                    });
                  }
                }}
                placeholder={resolvedPlaceholder}
                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-sm leading-none text-text outline-none placeholder:text-text-secondary"
              />
              <button
                ref={triggerRef}
                type="button"
                disabled={isSubmitting}
                aria-label="Open capture confirmation"
                className="interactive interactive-subtle ghost-button flex h-8 w-8 shrink-0 items-center justify-center bg-surface-low text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onMouseEnter={() => {
                  void importCaptureDialog();
                }}
                onClick={openDialog}
              >
                <Icon name="plus" size={14} />
              </button>
            </SidebarLabel>
          )}
        </div>
      </motion.div>

      {hasOpenedDialog && !isCollapsed ? (
        <Suspense fallback={null}>
          <CaptureDialog
            accessToken={accessToken}
            captureKind={captureKind}
            containerRef={containerRef}
            defaultDestinationValue={defaultDestinationValue}
            destinations={destinations}
            draft={draft}
            open={dialogOpen}
            personalProject={personalProject}
            setDraft={setDraft}
            triggerRef={triggerRef}
            onClose={() => setDialogOpen(false)}
            onSaved={() => {
              setDraft('');
              setDialogOpen(false);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
};
