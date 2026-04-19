import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/primitives';
import { requestHubHomeRefresh } from '../../lib/hubHomeRefresh';
import { createPersonalTask, createRecord } from '../../services/hub/records';
import { QuickCaptureComposer } from './QuickCaptureComposer';
import { QuickCaptureRecentList } from './QuickCaptureRecentList';
import { useQuickCaptureAssignment } from './hooks/useQuickCaptureAssignment';
import { useQuickCaptureCollections } from './hooks/useQuickCaptureCollections';
import { useQuickCaptureComposerState } from './hooks/useQuickCaptureComposerState';
import {
  PENDING_CAPTURE_DRAFT_KEY,
  PERSONAL_CAPTURE_TARGET,
  safeGetLastProjectId,
  selectPersonalCaptureCollection,
  sortCaptures,
} from './model';
import type { CaptureSortDirection, QuickCapturePanelProps } from './types';

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
  const [captureSortDirection, setCaptureSortDirection] = useState<CaptureSortDirection>('desc');

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
  const {
    captureInputRef,
    captureText,
    setCaptureText,
    captureMode,
    captureTargetProjectId,
    setCaptureTargetProjectId,
    captureOptionsExpanded,
    setCaptureOptionsExpanded,
    captureSaving,
    setCaptureSaving,
    captureError,
    setCaptureError,
    captureNotice,
    setCaptureNotice,
    focusCaptureInput,
    resetCaptureComposer,
    onComposerModeChange,
  } = useQuickCaptureComposerState({
    defaultProjectCaptureTarget,
    activationKey,
    initialIntent,
  });
  const {
    personalCollections,
    loadPersonalCollections,
    loadProjectCollections,
  } = useQuickCaptureCollections({
    accessToken,
    personalProjectId,
  });

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
  const {
    expandedCaptureAssignment,
    captureAssignmentSavingId,
    captureAssignmentError,
    expandedHoverCaptureId,
    resetAssignmentRuntime,
    onToggleCaptureAssignment,
    onCaptureRowMouseEnter,
    onCaptureRowMouseLeave,
    onAssignmentModeChange,
    onAssignmentProjectChange,
  } = useQuickCaptureAssignment({
    accessToken,
    captures,
    defaultProjectCaptureTarget,
    personalProjectId,
    onCaptureComplete,
    loadPersonalCollections,
    loadProjectCollections,
  });

  const onCloseCapture = useCallback(() => {
    setCaptureSaving(false);
    resetAssignmentRuntime();
    resetCaptureComposer('thought', false, PERSONAL_CAPTURE_TARGET);
    onRequestClose();
  }, [onRequestClose, resetAssignmentRuntime, resetCaptureComposer, setCaptureSaving]);

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
