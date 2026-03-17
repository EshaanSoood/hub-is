import type { ReactNode } from 'react';

export type NoteSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type NoteConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'locked';

interface EditorShellProps {
  title: string;
  saveStatus: NoteSaveStatus;
  connectionStatus: NoteConnectionStatus;
  connectionDetail?: string;
  editorsActive: number;
  editorNames: string[];
  updatedSinceLastViewed: boolean;
  readOnly: boolean;
  lockingRequiredReload: boolean;
  onNotifyUpdate?: () => void;
  notifyPending?: boolean;
  onMarkAsRead?: () => void;
  onReload?: () => void;
  children: ReactNode;
}

const saveStatusLabel: Record<NoteSaveStatus, string> = {
  idle: 'Idle',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
};

const connectionStatusLabel: Record<NoteConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Reconnecting... edits pending',
  locked: 'Locked',
};

export const EditorShell = ({
  title,
  saveStatus,
  connectionStatus,
  connectionDetail,
  editorsActive,
  editorNames,
  updatedSinceLastViewed,
  readOnly,
  lockingRequiredReload,
  onNotifyUpdate,
  notifyPending = false,
  onMarkAsRead,
  onReload,
  children,
}: EditorShellProps) => {
  const presenceLabel =
    editorsActive === 1 ? '1 editor active' : `${String(editorsActive)} editors active`;

  return (
    <section className="rounded-panel border border-border-muted bg-surface p-3" aria-label="Collaborative note editor">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-muted pb-3">
        <div>
          <h3 className="heading-4 text-primary">{title}</h3>
          <p className="mt-1 text-xs text-muted">{presenceLabel}</p>
          {editorNames.length > 0 ? (
            <p className="text-xs text-muted">Active: {editorNames.join(', ')}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
          {updatedSinceLastViewed ? (
            <span className="rounded-panel bg-info-subtle px-2 py-1 text-xs font-semibold text-primary">
              Updated
            </span>
          ) : null}
          <span className="rounded-panel bg-muted-subtle px-2 py-1 text-xs font-semibold text-primary">
            {saveStatusLabel[saveStatus]}
          </span>
          <span
            className={
              connectionStatus === 'connected'
                ? 'rounded-panel bg-success-subtle px-2 py-1 text-xs font-semibold text-primary'
                : connectionStatus === 'locked'
                  ? 'rounded-panel bg-danger-subtle px-2 py-1 text-xs font-semibold text-danger'
                  : 'rounded-panel bg-info-subtle px-2 py-1 text-xs font-semibold text-primary'
            }
          >
            {connectionStatusLabel[connectionStatus]}
          </span>
        </div>
      </div>

      {connectionDetail ? <p className="mt-2 text-xs text-muted">{connectionDetail}</p> : null}
      {readOnly ? <p className="mt-2 text-xs text-muted">Read-only: an active authenticated session is required.</p> : null}

      <div className="mt-3">{children}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onNotifyUpdate ? (
          <button
            type="button"
            onClick={onNotifyUpdate}
            disabled={notifyPending || readOnly || lockingRequiredReload}
            className="rounded-panel border border-border-muted px-3 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notifyPending ? 'Notifying...' : 'Notify collaborators'}
          </button>
        ) : null}

        {updatedSinceLastViewed && onMarkAsRead ? (
          <button
            type="button"
            onClick={onMarkAsRead}
            className="rounded-panel border border-border-muted px-3 py-2 text-sm font-semibold text-primary"
          >
            Mark as read
          </button>
        ) : null}

        {lockingRequiredReload && onReload ? (
          <button
            type="button"
            onClick={onReload}
            className="rounded-panel border border-danger px-3 py-2 text-sm font-semibold text-danger"
          >
            Reload note
          </button>
        ) : null}
      </div>
    </section>
  );
};
