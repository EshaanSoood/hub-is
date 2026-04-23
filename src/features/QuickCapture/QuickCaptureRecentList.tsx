import { QuickCaptureCaptureRow } from './QuickCaptureCaptureRow';
import { PERSONAL_CAPTURE_TARGET } from './model';
import type { CaptureMode, ExpandedCaptureAssignment } from './types';
import type { HubHomeCapture } from '../../services/hub/types';
import type { ProjectRecord } from '../../types/domain';

interface QuickCaptureRecentListProps {
  capturesLoading: boolean;
  sortedCaptures: HubHomeCapture[];
  captureSortDirection: 'desc' | 'asc';
  personalProjectId: string | null;
  visibleProjects: ProjectRecord[];
  expandedCaptureAssignment: ExpandedCaptureAssignment | null;
  captureAssignmentSavingId: string | null;
  captureAssignmentError: string | null;
  expandedHoverCaptureId: string | null;
  captureAssignmentTypeOptions: Array<{ value: string; label: string }>;
  assignmentProjectOptions: Array<{ value: string; label: string; disabled?: boolean }>;
  onToggleSortDirection: () => void;
  onToggleCaptureAssignment: (capture: HubHomeCapture) => void;
  onCaptureRowMouseEnter: (recordId: string) => void;
  onCaptureRowMouseLeave: () => void;
  onAssignmentModeChange: (capture: HubHomeCapture, assignmentProjectId: string, nextMode: CaptureMode) => void;
  onAssignmentProjectChange: (capture: HubHomeCapture, assignmentMode: CaptureMode, projectId: string) => void;
}

export const QuickCaptureRecentList = ({
  capturesLoading,
  sortedCaptures,
  captureSortDirection,
  personalProjectId,
  visibleProjects,
  expandedCaptureAssignment,
  captureAssignmentSavingId,
  captureAssignmentError,
  expandedHoverCaptureId,
  captureAssignmentTypeOptions,
  assignmentProjectOptions,
  onToggleSortDirection,
  onToggleCaptureAssignment,
  onCaptureRowMouseEnter,
  onCaptureRowMouseLeave,
  onAssignmentModeChange,
  onAssignmentProjectChange,
}: QuickCaptureRecentListProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-primary">Recent Captures</h3>
        <p className="text-xs text-muted">Recent uncategorized notes waiting to be sorted into real work.</p>
      </div>
      {sortedCaptures.length > 0 ? (
        <button
          type="button"
          onClick={onToggleSortDirection}
          className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label={captureSortDirection === 'desc' ? 'Sort oldest first' : 'Sort newest first'}
        >
          {captureSortDirection === 'desc' ? 'Newest ↓' : 'Oldest ↑'}
        </button>
      ) : null}
    </div>

    {capturesLoading ? (
      <div className="rounded-panel border border-border-muted bg-surface px-3 py-4 text-sm text-muted" role="status" aria-live="polite">
        Loading recent captures...
      </div>
    ) : sortedCaptures.length > 0 ? (
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-panel border border-border-muted bg-surface p-2">
        {sortedCaptures.map((capture) => {
          const assignmentExpanded = expandedCaptureAssignment?.recordId === capture.record_id;
          const assignmentProjectId = assignmentExpanded ? expandedCaptureAssignment.projectId : PERSONAL_CAPTURE_TARGET;
          const assignmentMode = assignmentExpanded ? expandedCaptureAssignment.mode : 'thought';
          const assignmentInteractionDisabled = captureAssignmentSavingId !== null;
          const titleExpanded = expandedHoverCaptureId === capture.record_id;
          const captureSourceLabel = capture.project_id === personalProjectId
            ? 'Home'
            : visibleProjects.find((project) => project.id === capture.project_id)?.name || 'Space';

          return (
            <QuickCaptureCaptureRow
              key={capture.record_id}
              capture={capture}
              captureSourceLabel={captureSourceLabel}
              assignmentExpanded={assignmentExpanded}
              assignmentProjectId={assignmentProjectId}
              assignmentMode={assignmentMode}
              assignmentInteractionDisabled={assignmentInteractionDisabled}
              titleExpanded={titleExpanded}
              captureAssignmentError={captureAssignmentError}
              captureAssignmentTypeOptions={captureAssignmentTypeOptions}
              assignmentProjectOptions={assignmentProjectOptions}
              onMouseEnter={() => onCaptureRowMouseEnter(capture.record_id)}
              onMouseLeave={onCaptureRowMouseLeave}
              onToggleAssignment={() => onToggleCaptureAssignment(capture)}
              onAssignmentModeChange={(value) => onAssignmentModeChange(capture, assignmentProjectId, value as CaptureMode)}
              onAssignmentProjectChange={(value) => onAssignmentProjectChange(capture, assignmentMode, value)}
            />
          );
        })}
      </div>
    ) : (
      <div className="rounded-panel border border-border-muted bg-surface px-3 py-4 text-sm text-muted">
        No recent captures yet.
      </div>
    )}
  </div>
);
