import { useCallback, useRef, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import { DialogDescription, DialogHeader, DialogTitle } from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import type { HubPaneSummary, HubProjectMember } from '../../../services/hub/types';

type ProjectSpacePaneSettingsDialogProps = {
  projectId: string;
  activePane: HubPaneSummary;
  activePaneCanEdit: boolean;
  activeEditablePaneIndex: number;
  orderedEditablePanes: HubPaneSummary[];
  projectMemberList: HubProjectMember[];
  sessionUserId: string;
  modulesEnabled: boolean;
  workspaceEnabled: boolean;
  onRequestClose: () => void;
  onTogglePinned: (pane: HubPaneSummary) => Promise<void>;
  onMovePane: (pane: HubPaneSummary, direction: 'up' | 'down') => Promise<void>;
  onTogglePaneMember: (pane: HubPaneSummary, memberUserId: string) => Promise<void>;
  onDeletePane: (pane: HubPaneSummary) => Promise<void>;
  onUpdatePane: (paneId: string, patch: { name?: string; layout_config?: Record<string, unknown> }) => Promise<void>;
  onToggleActivePaneRegion: (region: 'modules_enabled' | 'workspace_enabled') => void;
};

export const ProjectSpacePaneSettingsDialog = ({
  projectId,
  activePane,
  activePaneCanEdit,
  activeEditablePaneIndex,
  orderedEditablePanes,
  projectMemberList,
  sessionUserId,
  modulesEnabled,
  workspaceEnabled,
  onRequestClose,
  onTogglePinned,
  onMovePane,
  onTogglePaneMember,
  onDeletePane,
  onUpdatePane,
  onToggleActivePaneRegion,
}: ProjectSpacePaneSettingsDialogProps): ReactElement => {
  const paneSettingsNameInputRef = useRef<HTMLInputElement | null>(null);

  const commitActivePaneSettingsName = useCallback(() => {
    if (!activePaneCanEdit) {
      return;
    }
    const nextName = paneSettingsNameInputRef.current?.value.trim();
    if (nextName && nextName !== activePane.name) {
      void onUpdatePane(activePane.pane_id, { name: nextName });
    }
  }, [activePane, activePaneCanEdit, onUpdatePane]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pane Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage settings for pane {activePane.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="pane-settings-name">
            Pane name
          </label>
          <input
            key={activePane.pane_id}
            ref={paneSettingsNameInputRef}
            id="pane-settings-name"
            defaultValue={activePane.name}
            autoFocus
            disabled={!activePaneCanEdit}
            className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            aria-label="Pane name"
            onBlur={() => commitActivePaneSettingsName()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitActivePaneSettingsName();
              }
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={buildProjectWorkHref(projectId, activePane.pane_id)}
            onClick={() => onRequestClose()}
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
          >
            Open pane route
          </Link>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
            onClick={() => {
              void onTogglePinned(activePane);
            }}
            disabled={!activePaneCanEdit}
          >
            {activePane.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
            onClick={() => {
              void onMovePane(activePane, 'up');
            }}
            disabled={!activePaneCanEdit || activeEditablePaneIndex <= 0}
          >
            Move up
          </button>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
            onClick={() => {
              void onMovePane(activePane, 'down');
            }}
            disabled={!activePaneCanEdit || activeEditablePaneIndex < 0 || activeEditablePaneIndex >= orderedEditablePanes.length - 1}
          >
            Move down
          </button>
          {orderedEditablePanes.length > 1 ? (
            <button
              type="button"
              className="rounded-panel border border-danger px-3 py-1.5 text-sm font-semibold text-danger disabled:opacity-60"
              onClick={() => {
                onRequestClose();
                void onDeletePane(activePane);
              }}
              disabled={!activePaneCanEdit}
            >
              Delete pane
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Regions</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
              onClick={() => onToggleActivePaneRegion('modules_enabled')}
              disabled={!activePaneCanEdit}
            >
              {modulesEnabled ? 'Hide modules' : 'Show modules'}
            </button>
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
              onClick={() => onToggleActivePaneRegion('workspace_enabled')}
              disabled={!activePaneCanEdit}
            >
              {workspaceEnabled ? 'Hide workspace doc' : 'Show workspace doc'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pane members</p>
          <div className="flex flex-wrap gap-2">
            {projectMemberList
              .filter((member) => String(member.role).toLowerCase() !== 'owner'
                || activePane.members.some((entry) => entry.user_id === member.user_id))
              .map((member) => {
                const selected = activePane.members.some((entry) => entry.user_id === member.user_id);
                return (
                  <label
                    key={member.user_id}
                    className={`rounded-panel border px-2 py-1 text-xs ${
                      selected ? 'border-primary text-primary' : 'border-border-muted text-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={selected}
                      onChange={() => {
                        void onTogglePaneMember(activePane, member.user_id);
                      }}
                      disabled={!activePaneCanEdit || member.user_id === sessionUserId}
                    />
                    {member.display_name}
                  </label>
                );
              })}
          </div>
        </div>

        {!activePaneCanEdit ? <p className="text-xs text-muted">Read-only pane.</p> : null}
      </div>
    </>
  );
};
