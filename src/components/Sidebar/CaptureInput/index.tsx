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
import type { HubPaneSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { cn } from '../../../lib/cn';
import { SidebarLabel } from '../motion/SidebarLabel';
import { recordRecentPaneContribution } from '../../../features/recentPlaces/store';
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
  moduleTypesByCaptureKind,
  readQuickThoughtStorageKey,
  readPaneHasModuleType,
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
  currentPaneId: string | null;
  currentProject: ProjectRecord | null;
  currentProjectPanes: HubPaneSummary[];
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
  currentPaneId,
  currentProject,
  currentProjectPanes,
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

  const paneDestinations = useMemo<Record<CaptureKind, CaptureDestination | null>>(() => {
    if (!currentProject) {
      return {
        thought: null,
        task: null,
        event: null,
        reminder: null,
      };
    }
    const activePane = currentPaneId
      ? currentProjectPanes.find((pane) => pane.pane_id === currentPaneId) || null
      : null;
    const resolvePaneDestination = (kind: CaptureKind): CaptureDestination | null => {
      const requiredModuleType = moduleTypesByCaptureKind[kind];
      const matchingPane = activePane && readPaneHasModuleType(activePane, requiredModuleType)
        ? activePane
        : currentProjectPanes.find((pane) => readPaneHasModuleType(pane, requiredModuleType)) || null;
      if (!matchingPane) {
        return null;
      }
      return {
        kind: 'pane',
        label: `${currentProject.name} / ${matchingPane.name}`,
        pane: matchingPane,
        project: currentProject,
      };
    };
    return {
      thought: resolvePaneDestination('thought'),
      task: resolvePaneDestination('task'),
      event: resolvePaneDestination('event'),
      reminder: resolvePaneDestination('reminder'),
    };
  }, [currentPaneId, currentProject, currentProjectPanes]);

  const paneDestination = paneDestinations[captureKind];

  const destinations = useMemo<CaptureDestination[]>(
    () => [
      { kind: 'hub', label: 'Home', project: personalProject, pane: null },
      ...(paneDestination ? [paneDestination] : []),
    ],
    [paneDestination, personalProject],
  );

  const defaultDestinationValue = useMemo<'hub' | 'pane'>(
    () => (currentProject && paneDestination ? 'pane' : 'hub'),
    [currentProject, paneDestination],
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
      ? paneDestinations[resolvedCaptureKind]
      : { kind: 'hub', label: 'Home', project: personalProject, pane: null } satisfies CaptureDestination;
    if (!destination) {
      return false;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (resolvedCaptureKind === 'thought') {
        if (destination.kind === 'pane' && destination.pane) {
          const pane = destination.pane;
          const storageKey = readQuickThoughtStorageKey(pane);
          if (!storageKey) {
            return false;
          }
          createQuickThoughtEntry(storageKey, trimmedDraft);
          if (currentProject) {
            recordRecentPaneContribution({
              paneId: pane.pane_id,
              paneName: pane.name,
              spaceId: pane.project_id,
              spaceName: currentProject.name,
            }, 'quick-thought');
          }
          startTransition(() => {
            navigate(buildProjectWorkHref(pane.project_id, pane.pane_id));
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

        if (destination.kind === 'pane' && destination.pane) {
          const pane = destination.pane;
          const collectionId = await selectCollectionId(accessToken, pane.project_id, ['task', 'todo']);
          if (!collectionId) {
            return false;
          }
          await createRecord(accessToken, pane.project_id, {
            collection_id: collectionId,
            title: normalizedTaskTitle,
            capability_types: ['task'],
            task_state: {
              status: 'todo',
              priority: parsedTask.fields.priority,
              due_at: dueAtDate ? dueAtDate.toISOString() : null,
            },
            source_pane_id: pane.pane_id,
          });
          requestHubHomeRefresh();
          if (currentProject) {
            recordRecentPaneContribution({
              paneId: pane.pane_id,
              paneName: pane.name,
              spaceId: pane.project_id,
              spaceName: currentProject.name,
            }, 'capture-task');
          }
          startTransition(() => {
            navigate(buildProjectWorkHref(pane.project_id, pane.pane_id));
          });
        } else {
          if (!personalProject?.id) {
            return false;
          }
          await createPersonalTask(accessToken, {
            project_id: personalProject.id,
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
          ...(destination.kind === 'pane' && destination.pane
            ? {
                scope: 'project',
                project_id: destination.pane.project_id,
                pane_id: destination.pane.pane_id,
              }
            : {
                scope: 'personal',
              }),
        });
        requestHubHomeRefresh();
        if (destination.kind === 'pane' && destination.pane && currentProject) {
          recordRecentPaneContribution({
            paneId: destination.pane.pane_id,
            paneName: destination.pane.name,
            spaceId: destination.pane.project_id,
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

        const projectId = destination.kind === 'pane' && destination.pane
          ? destination.pane.project_id
          : personalProject?.id;
        if (!projectId) {
          return false;
        }
        await createEventFromNlp(accessToken, projectId, {
          title: eventPreview.title,
          start_dt: startDate.toISOString(),
          end_dt: endDate.toISOString(),
          timezone,
          ...(destination.kind === 'pane' && destination.pane
            ? {
                pane_id: destination.pane.pane_id,
                source_pane_id: destination.pane.pane_id,
              }
            : {}),
        });
        requestHubHomeRefresh();
        if (destination.kind === 'pane' && destination.pane && currentProject) {
          recordRecentPaneContribution({
            paneId: destination.pane.pane_id,
            paneName: destination.pane.name,
            spaceId: destination.pane.project_id,
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
