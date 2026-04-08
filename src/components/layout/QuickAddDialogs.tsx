import type { FC, FormEvent, RefObject } from 'react';
import type { ReminderParseResult } from '../../lib/nlp/reminder-parser';
import { Dialog } from '../primitives';
import { hasMeaningfulReminderPreview } from './appShellUtils';

export const QuickAddEventDialog: FC<{
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  projectOptions: Array<{ value: string; label: string }>;
  selectedProjectId: string;
  onSelectedProjectIdChange: (id: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  title: string;
  onTitleChange: (v: string) => void;
  startAt: string;
  onStartAtChange: (v: string) => void;
  endAt: string;
  onEndAtChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
}> = ({
  open,
  onClose,
  triggerRef,
  projectOptions,
  selectedProjectId,
  onSelectedProjectIdChange,
  onSubmit,
  title,
  onTitleChange,
  startAt,
  onStartAtChange,
  endAt,
  onEndAtChange,
  submitting,
  error,
  titleInputRef,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    triggerRef={triggerRef}
    title="New Calendar Event"
    description="Create a calendar event."
    panelClassName="overflow-visible"
    contentClassName="overflow-visible"
  >
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-project">
          Project
        </label>
        <select
          id="quick-add-event-project"
          value={selectedProjectId}
          onChange={(event) => onSelectedProjectIdChange(event.target.value)}
          className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
        >
          {projectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-title">
          Event title
        </label>
        <input
          id="quick-add-event-title"
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
          placeholder="New event"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-start">
            Start
          </label>
          <input
            id="quick-add-event-start"
            type="datetime-local"
            value={startAt}
            onChange={(event) => onStartAtChange(event.target.value)}
            className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-end">
            End
          </label>
          <input
            id="quick-add-event-end"
            type="datetime-local"
            value={endAt}
            onChange={(event) => onEndAtChange(event.target.value)}
            className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  </Dialog>
);

export const QuickAddReminderDialog: FC<{
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  draft: string;
  onDraftChange: (v: string) => void;
  preview: ReminderParseResult;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
  onClearError: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  personalProjectLabel: string;
}> = ({
  open,
  onClose,
  triggerRef,
  draft,
  onDraftChange,
  preview,
  onSubmit,
  submitting,
  error,
  onClearError,
  inputRef,
  personalProjectLabel,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    triggerRef={triggerRef}
    title="New Reminder"
    description="Create a reminder from natural language."
  >
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-xs text-text-secondary">
        Reminders are saved to your {personalProjectLabel} project.
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-reminder-input">
          Reminder
        </label>
        <input
          id="quick-add-reminder-input"
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
            if (error) {
              onClearError();
            }
          }}
          placeholder="Add a reminder…"
          className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
        />
      </div>

      {hasMeaningfulReminderPreview(preview) ? (
        <div className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-xs text-text-secondary">
          {preview.fields.title ? <p><span className="font-semibold text-text">Title:</span> {preview.fields.title}</p> : null}
          {preview.fields.remind_at ? <p><span className="font-semibold text-text">When:</span> {preview.fields.context_hint || preview.fields.remind_at}</p> : null}
          {preview.fields.recurrence ? <p><span className="font-semibold text-text">Recurs:</span> {preview.fields.recurrence.frequency}</p> : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  </Dialog>
);

export const QuickAddProjectDialog: FC<{
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  name: string;
  onNameChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
  nameInputRef: RefObject<HTMLInputElement | null>;
}> = ({
  open,
  onClose,
  triggerRef,
  name,
  onNameChange,
  onSubmit,
  submitting,
  error,
  nameInputRef,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    triggerRef={triggerRef}
    title="Create Project"
    description="Create a new project."
  >
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-project-name">
          Project name
        </label>
        <input
          id="quick-add-project-name"
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
          placeholder="New project"
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  </Dialog>
);
