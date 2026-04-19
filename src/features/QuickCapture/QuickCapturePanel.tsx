import { FormEvent, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/primitives';
import { focusWhenReady } from '../../lib/focusWhenReady';
import { requestHubHomeRefresh } from '../../lib/hubHomeRefresh';
import { listCollections } from '../../services/hub/collections';
import { convertRecord, createPersonalTask, createRecord } from '../../services/hub/records';
import type { HubCollection, HubHomeCapture } from '../../services/hub/types';
import { QuickCaptureComposer } from './QuickCaptureComposer';
import { QuickCaptureRecentList } from './QuickCaptureRecentList';
import { useCaptureListEffects } from './hooks/useCaptureListEffects';
import { usePersonalCollectionsEffect } from './hooks/usePersonalCollectionsEffect';
import { useQuickCaptureComposerEffects } from './hooks/useQuickCaptureComposerEffects';
import {
  captureModeFromIntent,
  PENDING_CAPTURE_DRAFT_KEY,
  PERSONAL_CAPTURE_TARGET,
  resolveTargetProjectForMode,
  safeGetLastProjectId,
  selectPersonalCaptureCollection,
  selectProjectCaptureCollection,
  sortCaptures,
} from './model';
import type {
  CaptureMode,
  CaptureSortDirection,
  ExpandedCaptureAssignment,
  QuickCapturePanelProps,
} from './types';

export const QuickCapturePanel = ({
  accessToken,
  projects,
  personalProjectId,
  captures,
  capturesLoading = false,
  onCaptureComplete,
  preferredProjectId = null,
  initialIntent = null,
  activationKey = 0,
  onRequestClose,
}: QuickCapturePanelProps) => {
  const navigate = useNavigate();
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
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);
  const projectCollectionsCacheRef = useRef<Record<string, HubCollection[]>>({});
  const defaultProjectCaptureTargetRef = useRef(PERSONAL_CAPTURE_TARGET);

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.isPersonal),
    [projects],
  );
  const lastOpenedProjectId = safeGetLastProjectId();
  const lastOpenedProject = useMemo(
    () => visibleProjects.find((project) => project.id === lastOpenedProjectId) || null,
    [lastOpenedProjectId, visibleProjects],
  );
  const preferredProject = useMemo(
    () => (preferredProjectId ? visibleProjects.find((project) => project.id === preferredProjectId) || null : null),
    [preferredProjectId, visibleProjects],
  );
  const defaultProjectCaptureTarget = preferredProject?.id ?? lastOpenedProject?.id ?? visibleProjects[0]?.id ?? PERSONAL_CAPTURE_TARGET;

  const captureProjectOptions = useMemo(
    () => [
      { value: PERSONAL_CAPTURE_TARGET, label: 'Home', disabled: captureMode === 'reminder' || captureMode === 'calendar' },
      ...visibleProjects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [captureMode, visibleProjects],
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
  const sortedCaptures = useMemo(() => sortCaptures(captures, captureSortDirection), [captureSortDirection, captures]);

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

  useQuickCaptureComposerEffects({
    defaultProjectCaptureTarget,
    defaultProjectCaptureTargetRef,
    activationKey,
    initialIntent,
    captureModeFromIntent,
    personalCaptureTarget: PERSONAL_CAPTURE_TARGET,
    resetCaptureComposer,
    focusCaptureInput,
    captureNotice,
    setCaptureNotice,
  });

  usePersonalCollectionsEffect({
    accessToken,
    personalProjectId,
    setPersonalCollections,
    projectCollectionsCacheRef,
  });

  useCaptureListEffects({
    captures,
    expandedCaptureAssignment,
    setExpandedCaptureAssignment,
    setCaptureAssignmentError,
    hoverExpandTimerRef,
  });

  const onCloseCapture = useCallback(() => {
    setCaptureSaving(false);
    setExpandedCaptureAssignment(null);
    setCaptureAssignmentError(null);
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    setExpandedHoverCaptureId(null);
    resetCaptureComposer('thought', false, PERSONAL_CAPTURE_TARGET);
    onRequestClose();
  }, [onRequestClose, resetCaptureComposer]);

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
          if (!personalProjectId) {
            setCaptureError('Personal capture is unavailable right now.');
            return;
          }
          await createPersonalTask(accessToken, { project_id: personalProjectId, title: trimmed });
          requestHubHomeRefresh();
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
        onRequestClose({ restoreFocus: false });
        navigate(`/projects/${encodeURIComponent(captureTargetProjectId)}/work?capture=1&intent=${encodeURIComponent(intent)}`);
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
      { value: PERSONAL_CAPTURE_TARGET, label: 'Home', disabled: false },
      ...visibleProjects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [visibleProjects],
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

  const onComposerModeChange = (value: string) => {
    const nextMode = value as CaptureMode;
    setCaptureMode(nextMode);
    setCaptureTargetProjectId(
      resolveTargetProjectForMode(nextMode, captureTargetProjectId, defaultProjectCaptureTarget),
    );
  };

  const onAssignmentModeChange = (capture: HubHomeCapture, assignmentProjectId: string, nextMode: CaptureMode) => {
    const nextProjectId = resolveTargetProjectForMode(nextMode, assignmentProjectId, defaultProjectCaptureTarget);
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
  };

  const onAssignmentProjectChange = (capture: HubHomeCapture, assignmentMode: CaptureMode, value: string) => {
    setExpandedCaptureAssignment({
      recordId: capture.record_id,
      mode: assignmentMode,
      projectId: value,
    });
    if (value !== PERSONAL_CAPTURE_TARGET || assignmentMode === 'task') {
      void applyCaptureAssignment(capture, assignmentMode, value);
    }
  };

  return (
    <section className="space-y-4" aria-label="Thought Pile">
      <div className="flex items-start justify-between gap-3 border-b border-border-muted pb-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-primary">Thought Pile</h2>
          <p className="text-sm text-muted">Drop a thought. It lands in your pile.</p>
        </div>
        <button
          type="button"
          onClick={onCloseCapture}
          className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Icon name="close" className="text-[12px]" />
          Close
        </button>
      </div>

      <form className="space-y-4" onSubmit={onSaveCapture}>
        <QuickCaptureComposer
          captureInputRef={captureInputRef}
          captureText={captureText}
          captureSaving={captureSaving}
          captureOptionsExpanded={captureOptionsExpanded}
          captureNotice={captureNotice}
          captureMode={captureMode}
          captureTargetProjectId={captureTargetProjectId}
          captureTypeOptions={captureTypeOptions}
          captureProjectOptions={captureProjectOptions}
          visibleProjectCount={visibleProjects.length}
          captureError={captureError}
          onCaptureTextChange={setCaptureText}
          onToggleCaptureOptions={() => {
            setCaptureOptionsExpanded((current) => !current);
          }}
          onCaptureModeChange={onComposerModeChange}
          onCaptureProjectChange={setCaptureTargetProjectId}
        />

        <QuickCaptureRecentList
          capturesLoading={capturesLoading}
          sortedCaptures={sortedCaptures}
          captureSortDirection={captureSortDirection}
          personalProjectId={personalProjectId}
          visibleProjects={visibleProjects}
          expandedCaptureAssignment={expandedCaptureAssignment}
          captureAssignmentSavingId={captureAssignmentSavingId}
          captureAssignmentError={captureAssignmentError}
          expandedHoverCaptureId={expandedHoverCaptureId}
          captureAssignmentTypeOptions={captureAssignmentTypeOptions}
          assignmentProjectOptions={assignmentProjectOptions}
          onToggleSortDirection={() => {
            setCaptureSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
          }}
          onToggleCaptureAssignment={onToggleCaptureAssignment}
          onCaptureRowMouseEnter={onCaptureRowMouseEnter}
          onCaptureRowMouseLeave={onCaptureRowMouseLeave}
          onAssignmentModeChange={onAssignmentModeChange}
          onAssignmentProjectChange={onAssignmentProjectChange}
        />
      </form>
    </section>
  );
};
