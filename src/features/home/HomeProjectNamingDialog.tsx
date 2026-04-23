import { useEffect, useRef } from 'react';
import { Button, Dialog } from '../../components/primitives';

interface HomeProjectNamingDialogProps {
  error: string | null;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  open: boolean;
  projectName: string;
  saving: boolean;
}

export const HomeProjectNamingDialog = ({
  error,
  onSubmit,
  onValueChange,
  open,
  projectName,
  saving,
}: HomeProjectNamingDialogProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorId = error ? 'home-project-name-error' : undefined;

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      title="Name your Home space"
      description="Choose the name you want to use for your personal space."
      onClose={() => {
        // Intentional: block dismissal until the required Home name is saved.
      }}
      panelClassName="max-w-xl"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Home is your personal space. Give it a name you want to see across the app.
          </p>
          <label htmlFor="home-project-name" className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Space name
          </label>
          <input
            ref={inputRef}
            id="home-project-name"
            type="text"
            value={projectName}
            onChange={(event) => onValueChange(event.target.value)}
            aria-describedby={errorId}
            aria-invalid={Boolean(error)}
            className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-base text-text"
            placeholder="Personal space"
            maxLength={120}
          />
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            loadingLabel="Saving space name"
            disabled={projectName.trim().length === 0}
          >
            Save name
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
