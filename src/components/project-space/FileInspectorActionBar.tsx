import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
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
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  expanded?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) => (
  <button
    ref={buttonRef}
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
  const moveTriggerRef = useRef<HTMLButtonElement | null>(null);
  const renameTriggerRef = useRef<HTMLButtonElement | null>(null);
  const removeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const renameRef = useRef<HTMLFormElement | null>(null);
  const moveWasOpenRef = useRef(false);
  const renameWasOpenRef = useRef(false);
  const moveRestoreFocusRef = useRef(false);
  const renameRestoreFocusRef = useRef(false);

  const closeMove = useCallback((options?: { restoreFocus?: boolean }) => {
    moveRestoreFocusRef.current = options?.restoreFocus ?? false;
    setMoveOpen(false);
  }, []);

  const closeRename = useCallback((options?: { restoreFocus?: boolean; resetValue?: boolean }) => {
    renameRestoreFocusRef.current = options?.restoreFocus ?? false;
    if (options?.resetValue !== false) {
      setRenameValue(fileName);
      setRenameError(null);
    }
    setRenameOpen(false);
  }, [fileName]);

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
        closeMove({ restoreFocus: false });
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [closeMove, moveOpen]);

  useEffect(() => {
    if (!renameOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      if (
        renameRef.current
        && !renameRef.current.contains(event.target as Node)
        && !renameTriggerRef.current?.contains(event.target as Node)
      ) {
        closeRename({ restoreFocus: false });
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRename({ restoreFocus: true });
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeRename, renameOpen]);

  useEffect(() => {
    if (!moveOpen && moveWasOpenRef.current && moveRestoreFocusRef.current) {
      window.setTimeout(() => {
        if (moveTriggerRef.current?.isConnected) {
          moveTriggerRef.current.focus();
        }
      }, 0);
    }
    if (!moveOpen) {
      moveRestoreFocusRef.current = false;
    }
    moveWasOpenRef.current = moveOpen;
  }, [moveOpen]);

  useEffect(() => {
    if (!renameOpen && renameWasOpenRef.current && renameRestoreFocusRef.current) {
      window.setTimeout(() => {
        if (renameTriggerRef.current?.isConnected) {
          renameTriggerRef.current.focus();
        }
      }, 0);
    }
    if (!renameOpen) {
      renameRestoreFocusRef.current = false;
    }
    renameWasOpenRef.current = renameOpen;
  }, [renameOpen]);

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
              <ActionButton
                buttonRef={moveTriggerRef}
                label="Move"
                onClick={() => {
                  if (moveOpen) {
                    closeMove({ restoreFocus: false });
                    return;
                  }
                  setMoveOpen(true);
                }}
                expanded={moveOpen}
              />
              {moveOpen ? (
                <FileMovePopover
                  panes={panes}
                  currentFileName={fileName}
                  onSelect={(paneId) => {
                    onMove(paneId);
                    closeMove({ restoreFocus: true });
                  }}
                  onClose={(options) => closeMove(options)}
                />
              ) : null}
            </div>
            <div className="relative">
              <ActionButton
                buttonRef={renameTriggerRef}
                label="Rename"
                onClick={() => {
                  setRenameError(null);
                  if (renameOpen) {
                    closeRename({ restoreFocus: false });
                    return;
                  }
                  setRenameOpen(true);
                }}
                expanded={renameOpen}
              />
              {renameOpen ? (
                <form
                  ref={renameRef}
                  className="absolute left-0 top-[calc(100%+4px)] z-[200] min-w-[220px] space-y-xs rounded-panel border border-border-muted bg-surface-elevated p-xs shadow-soft"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const trimmed = renameValue.trim();
                    if (!trimmed || trimmed === fileName) {
                      setRenameError(null);
                      closeRename({ restoreFocus: true, resetValue: false });
                      return;
                    }
                    setRenameError(null);
                    setRenaming(true);
                    try {
                      await onRename(trimmed);
                      closeRename({ restoreFocus: true, resetValue: false });
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
                      onClick={() => closeRename({ restoreFocus: true })}
                      className="flex-1 rounded-control border border-border-muted px-sm py-xs text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
            <ActionButton buttonRef={removeTriggerRef} label="Remove" onClick={() => setRemoveOpen(true)} danger />
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
        triggerRef={removeTriggerRef}
      />
    </>
  );
};
