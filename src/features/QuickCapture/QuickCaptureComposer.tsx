import type { RefObject } from 'react';
import { Icon, IconButton, Select } from '../../components/primitives';
import type { CaptureMode } from './types';

interface QuickCaptureComposerProps {
  captureInputRef: RefObject<HTMLInputElement | null>;
  captureText: string;
  captureSaving: boolean;
  captureOptionsExpanded: boolean;
  captureNotice: string | null;
  captureMode: CaptureMode;
  captureTargetProjectId: string;
  captureTypeOptions: Array<{ value: string; label: string }>;
  captureProjectOptions: Array<{ value: string; label: string; disabled?: boolean }>;
  visibleProjectCount: number;
  captureError: string | null;
  onCaptureTextChange: (value: string) => void;
  onToggleCaptureOptions: () => void;
  onCaptureModeChange: (value: string) => void;
  onCaptureProjectChange: (value: string) => void;
}

export const QuickCaptureComposer = ({
  captureInputRef,
  captureText,
  captureSaving,
  captureOptionsExpanded,
  captureNotice,
  captureMode,
  captureTargetProjectId,
  captureTypeOptions,
  captureProjectOptions,
  visibleProjectCount,
  captureError,
  onCaptureTextChange,
  onToggleCaptureOptions,
  onCaptureModeChange,
  onCaptureProjectChange,
}: QuickCaptureComposerProps) => (
  <div className="rounded-panel border border-border-muted bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          ref={captureInputRef}
          type="text"
          value={captureText}
          onChange={(event) => onCaptureTextChange(event.target.value)}
          placeholder="Capture something..."
          autoComplete="off"
          disabled={captureSaving}
          aria-label="Capture text"
          className="flex-1 rounded-panel border border-border-muted bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
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
          onClick={onToggleCaptureOptions}
        >
          <Icon
            name={captureOptionsExpanded ? 'chevron-down' : 'more'}
            className={captureOptionsExpanded ? 'rotate-180 text-[14px] transition-transform' : 'text-[14px]'}
          />
        </IconButton>
        <button type="submit" className="sr-only">
          Save capture
        </button>
      </div>

      <div className="mt-3 flex min-h-5 items-center justify-between gap-3">
        <div className="text-xs text-muted" role="status" aria-live="polite">
          {captureSaving ? 'Saving...' : captureNotice || ''}
        </div>
        {!captureOptionsExpanded ? <span className="text-xs text-muted">Press Enter to save quickly</span> : null}
      </div>

      {captureOptionsExpanded ? (
        <div id="quick-capture-options" className="mt-3 grid gap-3 rounded-panel border border-border-muted bg-surface-elevated p-3 md:grid-cols-2">
          <div className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
            <span>Type</span>
            <Select
              id="quick-capture-type"
              value={captureMode}
              onValueChange={onCaptureModeChange}
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
                onValueChange={onCaptureProjectChange}
                options={captureProjectOptions}
                ariaLabel="Capture project"
                triggerClassName="w-full min-w-0"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {captureMode !== 'thought' && captureTargetProjectId === '__personal__' ? (
        <p className="mt-3 text-xs text-muted">Reminders and calendar items need a project.</p>
      ) : null}

      {captureMode !== 'thought' && visibleProjectCount === 0 ? (
        <p className="mt-3 text-xs text-muted">Create a project to route reminders or calendar captures.</p>
      ) : null}

      {captureError ? (
        <p className="mt-3 text-sm text-danger" role="alert" aria-live="polite">
          {captureError}
        </p>
      ) : null}
  </div>
);
