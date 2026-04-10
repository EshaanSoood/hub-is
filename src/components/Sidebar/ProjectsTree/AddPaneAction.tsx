import { startTransition, useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import { buildDefaultPaneCreatePayload } from '../../../lib/paneTemplates';
import { createPane } from '../../../services/hub/panes';
import type { HubPaneSummary } from '../../../services/hub/types';
import { Dialog, Icon } from '../../primitives';

interface AddPaneActionProps {
  panes: HubPaneSummary[];
  projectId: string;
  onPaneCreated: (pane: HubPaneSummary) => void;
}

export const AddPaneAction = ({
  panes,
  projectId,
  onPaneCreated,
}: AddPaneActionProps) => {
  const navigate = useNavigate();
  const { accessToken, sessionSummary } = useAuthz();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputId = useId();
  const errorId = `${nameInputId}-error`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setError('An authenticated session is required.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Pane name is required.');
      nameInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const pane = await createPane(
        accessToken,
        projectId,
        buildDefaultPaneCreatePayload({
          existingPanes: panes,
          name: trimmedName,
          sessionUserId: sessionSummary.userId,
        }),
      );
      onPaneCreated(pane);
      setName('');
      setOpen(false);
      startTransition(() => {
        navigate(buildProjectWorkHref(projectId, pane.pane_id));
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Pane creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="interactive interactive-subtle flex w-full items-center gap-2 rounded-control border border-dashed border-subtle px-3 py-2 text-left text-sm font-medium text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="plus" size={14} />
        <span>Add pane</span>
      </button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        triggerRef={triggerRef}
        title="Create Pane"
        description="Create a new pane in this project."
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Pane name</span>
            <input
              id={nameInputId}
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New pane"
              aria-describedby={error ? errorId : undefined}
              aria-errormessage={error ? errorId : undefined}
              aria-invalid={error ? 'true' : undefined}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            />
          </label>

          {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="interactive interactive-subtle rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-text"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="interactive rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
