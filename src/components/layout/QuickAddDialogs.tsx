import type { FC, FormEvent, RefObject } from 'react';
import type { CalendarNLFormPreview, CalendarParseResult } from '../../hooks/useCalendarNLDraft';
import type { ReminderParseResult } from '../../lib/nlp/reminder-parser';
import { Dialog } from '../primitives';
import { hasMeaningfulReminderPreview } from './appShellUtils';

const formatDateTimePreview = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const QuickAddEventDialog: FC<{
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  layoutId?: string;
  projectOptions: Array<{ value: string; label: string }>;
  selectedProjectId: string;
  onSelectedProjectIdChange: (id: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  nlDraft: string;
  onNlDraftChange: (v: string) => void;
  nlPreview: CalendarParseResult;
  nlFormPreview: CalendarNLFormPreview;
  nlHasMeaningfulPreview: boolean;
  nlError: string | null;
  nlInputRef: RefObject<HTMLInputElement | null>;
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
  layoutId,
  projectOptions,
  selectedProjectId,
  onSelectedProjectIdChange,
  onSubmit,
  nlDraft,
  onNlDraftChange,
  nlPreview,
  nlFormPreview,
  nlHasMeaningfulPreview,
  nlError,
  nlInputRef,
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
    layoutId={layoutId}
    title="New Calendar Event"
    description="Create a calendar event."
    panelClassName="overflow-visible"
    contentClassName="overflow-visible"
  >
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-nl-input">
          Describe event
        </label>
        <input
          id="quick-add-event-nl-input"
          ref={nlInputRef}
          type="text"
          value={nlDraft}
          onChange={(event) => onNlDraftChange(event.target.value)}
          placeholder="Lunch with Sam tomorrow at 1pm"
          className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
        />
      </div>

      {nlDraft.trim() ? (
        <div className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-xs text-text-secondary">
          {nlHasMeaningfulPreview ? (
            <div className="space-y-1">
              {nlFormPreview.title ? (
                <p>
                  <span className="font-semibold text-text">Title:</span> {nlFormPreview.title}
                </p>
              ) : null}
              {nlFormPreview.startAt ? (
                <p>
                  <span className="font-semibold text-text">Start:</span> {formatDateTimePreview(nlFormPreview.startAt)}
                </p>
              ) : null}
              {nlFormPreview.endAt ? (
                <p>
                  <span className="font-semibold text-text">End:</span> {formatDateTimePreview(nlFormPreview.endAt)}
                </p>
              ) : null}
            </div>
          ) : (
            <p>Try adding a date and time to auto-fill the event fields.</p>
          )}
          {import.meta.env.DEV ? (
            <details className="mt-2">
              <summary className="cursor-pointer select-none">Calendar Parser Debug</summary>
              <pre className="mt-1 whitespace-pre-wrap text-[11px]">
                {nlPreview.meta.debugSteps.map((step) => `${step.pass} | ${step.ruleId} | ${step.note}`).join('\n') || 'No steps'}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {nlError ? <p role="alert" aria-live="assertive" className="text-xs text-danger">{nlError}</p> : null}

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
  layoutId?: string;
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
  layoutId,
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
    layoutId={layoutId}
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
  layoutId?: string;
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
  layoutId,
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
    layoutId={layoutId}
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
