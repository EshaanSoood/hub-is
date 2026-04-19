import { Icon, IconButton, Select } from '../../components/primitives';
import { formatRelativeDateTime, truncateCaptureTitle } from './model';
import type { CaptureMode } from './types';
import type { HubHomeCapture } from '../../services/hub/types';

interface QuickCaptureCaptureRowProps {
  capture: HubHomeCapture;
  captureSourceLabel: string;
  assignmentExpanded: boolean;
  assignmentProjectId: string;
  assignmentMode: CaptureMode;
  rowSaving: boolean;
  titleExpanded: boolean;
  captureAssignmentError: string | null;
  captureAssignmentTypeOptions: Array<{ value: string; label: string }>;
  assignmentProjectOptions: Array<{ value: string; label: string; disabled?: boolean }>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleAssignment: () => void;
  onAssignmentModeChange: (value: string) => void;
  onAssignmentProjectChange: (value: string) => void;
}

export const QuickCaptureCaptureRow = ({
  capture,
  captureSourceLabel,
  assignmentExpanded,
  assignmentProjectId,
  assignmentMode,
  rowSaving,
  titleExpanded,
  captureAssignmentError,
  captureAssignmentTypeOptions,
  assignmentProjectOptions,
  onMouseEnter,
  onMouseLeave,
  onToggleAssignment,
  onAssignmentModeChange,
  onAssignmentProjectChange,
}: QuickCaptureCaptureRowProps) => (
  <div className="rounded-panel border border-border-muted bg-surface-elevated p-3">
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-control border border-border-muted bg-surface px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {captureSourceLabel}
          </span>
          <span className="text-xs text-muted">{formatRelativeDateTime(capture.created_at)}</span>
        </div>
        <p className={titleExpanded ? 'mt-2 break-words text-sm text-text' : 'mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-text'}>
          {titleExpanded ? capture.title : truncateCaptureTitle(capture.title)}
        </p>
      </div>
      <IconButton
        aria-label={assignmentExpanded ? 'Hide capture assignment options' : 'Show capture assignment options'}
        aria-expanded={assignmentExpanded}
        aria-controls={`quick-capture-item-options-${capture.record_id}`}
        size="sm"
        variant="secondary"
        onClick={onToggleAssignment}
        disabled={rowSaving}
      >
        <Icon
          name={assignmentExpanded ? 'chevron-down' : 'more'}
          className={assignmentExpanded ? 'rotate-180 text-[14px] transition-transform' : 'text-[14px]'}
        />
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
              onValueChange={onAssignmentModeChange}
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
                onValueChange={onAssignmentProjectChange}
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
