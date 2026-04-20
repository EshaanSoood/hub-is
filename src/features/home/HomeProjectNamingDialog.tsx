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
      title="Name your Home project"
      description="Choose the name you want to use for your personal project."
      onClose={() => {}}
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
            Home is your personal project. Give it a name you want to see across the app.
          </p>
          <label htmlFor="home-project-name" className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Project name
          </label>
          <input
            ref={inputRef}
            id="home-project-name"
            type="text"
            value={projectName}
            onChange={(event) => onValueChange(event.target.value)}
            className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-base text-text"
            placeholder="Personal project"
            maxLength={120}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            loadingLabel="Saving project name"
            disabled={projectName.trim().length === 0}
          >
            Save name
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
