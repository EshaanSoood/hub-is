import { asDateLabel, fromLocalDateKey } from './utils';

interface CalendarCreatePanelProps {
  draftDay: string | null;
  hasCreateHandler: boolean;
  draftTitle: string;
  draftStartTime: string;
  draftEndTime: string;
  isCreatingEvent: boolean;
  createError: string | null;
  onDraftTitleChange: (value: string) => void;
  onDraftStartTimeChange: (value: string) => void;
  onDraftEndTimeChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}

export const CalendarCreatePanel = ({
  draftDay,
  hasCreateHandler,
  draftTitle,
  draftStartTime,
  draftEndTime,
  isCreatingEvent,
  createError,
  onDraftTitleChange,
  onDraftStartTimeChange,
  onDraftEndTimeChange,
  onCancel,
  onSubmit,
}: CalendarCreatePanelProps) => {
  if (!draftDay || !hasCreateHandler) {
    return null;
  }

  return (
    <form
      className="space-y-3 rounded-panel border border-subtle bg-surface-elevated p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">{asDateLabel(fromLocalDateKey(draftDay))}</h3>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Event title
        <input
          autoFocus
          type="text"
          value={draftTitle}
          onChange={(event) => onDraftTitleChange(event.target.value)}
          disabled={isCreatingEvent}
          className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          placeholder="New event"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Start time
          <input
            type="time"
            value={draftStartTime}
            onChange={(event) => onDraftStartTimeChange(event.target.value)}
            disabled={isCreatingEvent}
            className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          End time
          <input
            type="time"
            value={draftEndTime}
            onChange={(event) => onDraftEndTimeChange(event.target.value)}
            disabled={isCreatingEvent}
            className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </label>
      </div>
      <div aria-live="polite" className="min-h-5 text-xs text-danger">
        {createError || ''}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreatingEvent}
          className="rounded-control border border-border-muted px-3 py-1.5 text-sm text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={draftTitle.trim().length === 0 || isCreatingEvent}
          className="interactive interactive-fold rounded-control border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreatingEvent ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
};
