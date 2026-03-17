import { useEffect, useRef, useState } from 'react';
import { AlertDialog } from '../primitives';
import { FileMovePopover } from './FileMovePopover';

interface FileInspectorActionBarProps {
  fileName: string;
  downloadUrl: string;
  shareableLink: string;
  panes: Array<{ id: string; name: string }>;
  readOnly?: boolean;
  onRename: (nextName: string) => void | Promise<void>;
  onMove: (destinationPaneId: string) => void;
  onRemove: () => void;
}

const ActionButton = ({
  label,
  onClick,
  danger = false,
  expanded,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  expanded?: boolean;
}) => (
  <button
    type="button"
    aria-expanded={expanded}
    onClick={onClick}
    className="rounded-control border px-xs py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    style={{
      borderColor: danger ? 'color-mix(in srgb, var(--color-danger) 40%, transparent)' : 'var(--color-border-muted)',
      color: danger ? 'var(--color-danger)' : 'var(--color-text)',
    }}
  >
    {label}
  </button>
);

export const FileInspectorActionBar = ({
  fileName,
  downloadUrl,
  shareableLink,
  panes,
  readOnly = false,
  onRename,
  onMove,
  onRemove,
}: FileInspectorActionBarProps) => {
  const [copyLabel, setCopyLabel] = useState('Copy link');
  const [moveOpen, setMoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(fileName);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const moveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRenameValue(fileName);
    setRenameError(null);
    setRenaming(false);
  }, [fileName]);

  useEffect(() => {
    if (!moveOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      if (moveRef.current && !moveRef.current.contains(event.target as Node)) {
        setMoveOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [moveOpen]);

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy link'), 2000);
    } catch {
      setCopyLabel('Copy failed');
      window.setTimeout(() => setCopyLabel('Copy link'), 2000);
    }
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label="File actions"
        className="relative mb-sm flex flex-wrap items-center gap-xs border-b border-border-muted pb-xs"
      >
        <ActionButton
          label="Download"
          onClick={() => {
            window.open(downloadUrl, '_blank', 'noopener');
          }}
        />
        <ActionButton label={copyLabel} onClick={() => void onCopyLink()} />
        {!readOnly ? (
          <>
            <div className="relative" ref={moveRef}>
              <ActionButton label="Move" onClick={() => setMoveOpen((current) => !current)} expanded={moveOpen} />
              {moveOpen ? (
                <FileMovePopover
                  panes={panes}
                  currentFileName={fileName}
                  onSelect={(paneId) => {
                    onMove(paneId);
                    setMoveOpen(false);
                  }}
                  onClose={() => setMoveOpen(false)}
                />
              ) : null}
            </div>
            <div className="relative">
              <ActionButton
                label="Rename"
                onClick={() => {
                  setRenameError(null);
                  setRenameOpen((current) => !current);
                }}
                expanded={renameOpen}
              />
              {renameOpen ? (
                <form
                  className="absolute left-0 top-[calc(100%+4px)] z-[200] min-w-[220px] space-y-xs rounded-panel border border-border-muted bg-surface-elevated p-xs shadow-soft"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const trimmed = renameValue.trim();
                    if (!trimmed || trimmed === fileName) {
                      setRenameError(null);
                      setRenameOpen(false);
                      return;
                    }
                    setRenameError(null);
                    setRenaming(true);
                    try {
                      await onRename(trimmed);
                      setRenameOpen(false);
                    } catch (error) {
                      setRenameError(error instanceof Error ? error.message : 'Failed to rename file.');
                    } finally {
                      setRenaming(false);
                    }
                  }}
                >
                  <label className="flex flex-col gap-[2px] text-[11px] text-muted">
                    New filename
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      className="rounded-control border border-border-muted bg-surface px-sm py-[6px] text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    />
                  </label>
                  {renameError ? (
                    <p className="text-[11px] text-danger" role="alert" aria-live="polite">
                      {renameError}
                    </p>
                  ) : null}
                  <div className="flex gap-xs">
                    <button
                      type="submit"
                      disabled={renaming}
                      className="flex-1 rounded-control bg-primary px-sm py-xs text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {renaming ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={renaming}
                      onClick={() => {
                        setRenameValue(fileName);
                        setRenameError(null);
                        setRenameOpen(false);
                      }}
                      className="flex-1 rounded-control border border-border-muted px-sm py-xs text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
            <ActionButton label="Remove" onClick={() => setRemoveOpen(true)} danger />
          </>
        ) : null}
      </div>

      <AlertDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove "${fileName}"?`}
        description="This file will be detached from the record."
        confirmLabel="Remove file"
        onConfirm={onRemove}
      />
    </>
  );
};
