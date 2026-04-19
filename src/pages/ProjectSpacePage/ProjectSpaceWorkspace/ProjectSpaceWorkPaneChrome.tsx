import { FormEvent, useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { Icon, IconButton, InlineNotice } from '../../../components/primitives';
import { PaneSwitcher } from '../../../components/project-space/PaneSwitcher';
import type { HubPaneSummary, HubProjectMember } from '../../../services/hub/types';
import type { PaneLateralSource } from '../../../components/motion/hubMotion';
import { dialogLayoutIds } from '../../../styles/motion';
import { usePaneControlEffects } from '../hooks/usePaneControlEffects';

export interface ProjectSpacePaneChromeProps {
  projectId: string;
  activePane: HubPaneSummary | null;
  activePaneCanEdit: boolean;
  canWriteProject: boolean;
  openedFromPinned: boolean;
  orderedEditablePanes: HubPaneSummary[];
  readOnlyPanes: HubPaneSummary[];
  projectMemberList: HubProjectMember[];
  sessionUserId: string;
  activeEditablePaneIndex: number;
  modulesEnabled: boolean;
  workspaceEnabled: boolean;
  paneMutationError: string | null;
  onNavigateToPane: (params: {
    paneId: string;
    paneName?: string | null;
    paneSource?: PaneLateralSource;
    query?: string;
    extraState?: unknown;
  }) => void;
  onCreatePane: (name: string) => Promise<HubPaneSummary | null>;
  onMovePane: (pane: HubPaneSummary, direction: 'up' | 'down') => Promise<void>;
  onTogglePinned: (pane: HubPaneSummary) => Promise<void>;
  onTogglePaneMember: (pane: HubPaneSummary, memberUserId: string) => Promise<void>;
  onDeletePane: (pane: HubPaneSummary) => Promise<void>;
  onUpdatePane: (paneId: string, patch: { name?: string; layout_config?: Record<string, unknown> }) => Promise<void>;
  onToggleActivePaneRegion: (region: 'modules_enabled' | 'workspace_enabled') => void;
}

export const ProjectSpaceWorkPaneChrome = ({
  projectId,
  activePane,
  activePaneCanEdit,
  canWriteProject,
  openedFromPinned,
  orderedEditablePanes,
  readOnlyPanes,
  projectMemberList,
  sessionUserId,
  activeEditablePaneIndex,
  modulesEnabled,
  workspaceEnabled,
  paneMutationError,
  onNavigateToPane,
  onCreatePane,
  onMovePane,
  onTogglePinned,
  onTogglePaneMember,
  onDeletePane,
  onUpdatePane,
  onToggleActivePaneRegion,
}: ProjectSpacePaneChromeProps): ReactElement => {
  const prefersReducedMotion = useReducedMotion();
  const [creatingPaneName, setCreatingPaneName] = useState('');
  const [showCreatePaneControl, setShowCreatePaneControl] = useState(false);
  const [showPaneSwitcher, setShowPaneSwitcher] = useState(!openedFromPinned);
  const [showOtherPanes, setShowOtherPanes] = useState(false);
  const [otherPaneQuery, setOtherPaneQuery] = useState('');
  const [paneSettingsOpen, setPaneSettingsOpen] = useState(false);
  const previousOpenedFromPinnedRef = useRef(openedFromPinned);
  const paneSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const paneSettingsNameInputRef = useRef<HTMLInputElement | null>(null);
  const createPaneNameInputRef = useRef<HTMLInputElement | null>(null);

  usePaneControlEffects({
    openedFromPinned,
    previousOpenedFromPinnedRef,
    setShowPaneSwitcher,
    showCreatePaneControl,
    createPaneNameInputRef,
  });

  const filteredReadOnlyPanes = useMemo(() => {
    const query = otherPaneQuery.trim().toLowerCase();
    if (!query) {
      return readOnlyPanes;
    }
    return readOnlyPanes.filter((pane) => pane.name.toLowerCase().includes(query));
  }, [otherPaneQuery, readOnlyPanes]);

  const commitActivePaneSettingsName = useCallback(() => {
    if (!activePane || !activePaneCanEdit) {
      return;
    }
    const nextName = paneSettingsNameInputRef.current?.value.trim();
    if (nextName && nextName !== activePane.name) {
      void onUpdatePane(activePane.pane_id, { name: nextName });
    }
  }, [activePane, activePaneCanEdit, onUpdatePane]);

  const handlePaneSettingsOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        commitActivePaneSettingsName();
      }
      setPaneSettingsOpen(nextOpen);
    },
    [commitActivePaneSettingsName],
  );

  const onCreatePaneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPane = await onCreatePane(creatingPaneName);
    if (!nextPane) {
      return;
    }

    setCreatingPaneName('');
    setShowCreatePaneControl(false);
    onNavigateToPane({
      paneId: nextPane.pane_id,
      paneName: nextPane.name,
      paneSource: 'click',
    });
  };

  return (
    <div className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="heading-3 text-primary">Work Panes</h2>
        <div className="flex flex-wrap gap-2">
          {openedFromPinned ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowPaneSwitcher((current) => !current)}
              aria-label={showPaneSwitcher ? 'Hide pane switcher' : 'Show pane switcher'}
            >
              {showPaneSwitcher ? 'Hide pane switcher' : 'Show pane switcher'}
            </button>
          ) : null}
          {readOnlyPanes.length > 0 ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowOtherPanes((current) => !current)}
            >
              {showOtherPanes ? 'Hide other panes' : `Other panes (${readOnlyPanes.length})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {showPaneSwitcher ? (
            <div className="min-w-0 flex-1 overflow-x-auto">
              <PaneSwitcher
                panes={orderedEditablePanes.map((pane, index) => ({
                  id: pane.pane_id,
                  label: pane.name,
                  shortcutNumber: index + 1,
                }))}
                activePaneId={activePane?.pane_id ?? null}
                onPaneChange={(nextPaneId, source) => {
                  const nextPane = orderedEditablePanes.find((pane) => pane.pane_id === nextPaneId) || null;
                  onNavigateToPane({
                    paneId: nextPaneId,
                    paneName: nextPane?.name,
                    paneSource: source,
                  });
                }}
                onMovePane={(paneIdToMove, direction) => {
                  const pane = orderedEditablePanes.find((entry) => entry.pane_id === paneIdToMove);
                  if (pane) {
                    void onMovePane(pane, direction);
                  }
                }}
              />
            </div>
          ) : openedFromPinned ? (
            <p className="text-xs text-muted">Pane switcher hidden. Use the focusable toggle above to reveal it.</p>
          ) : null}
          {canWriteProject ? (
            <IconButton
              type="button"
              size="sm"
              variant={showCreatePaneControl ? 'secondary' : 'ghost'}
              aria-label={showCreatePaneControl ? 'Collapse create pane' : 'Create pane'}
              aria-expanded={showCreatePaneControl}
              onClick={() => setShowCreatePaneControl((current) => !current)}
            >
              <Icon name="plus" className="text-[14px]" />
            </IconButton>
          ) : null}
          <motion.div
            layoutId={!prefersReducedMotion && paneSettingsOpen ? dialogLayoutIds.paneSettings : undefined}
            className="inline-flex"
          >
            <IconButton
              ref={paneSettingsTriggerRef}
              type="button"
              size="sm"
              variant={paneSettingsOpen ? 'secondary' : 'ghost'}
              aria-label="Pane settings"
              aria-expanded={paneSettingsOpen}
              onClick={() => setPaneSettingsOpen(true)}
              disabled={!activePane}
            >
              <Icon name="settings" className="text-[14px]" />
            </IconButton>
          </motion.div>
        </div>

        {showCreatePaneControl && canWriteProject ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={onCreatePaneSubmit}>
            <input
              ref={createPaneNameInputRef}
              value={creatingPaneName}
              onChange={(event) => setCreatingPaneName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setShowCreatePaneControl(false);
                }
              }}
              className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
              placeholder="New pane name"
              aria-label="New pane name"
            />
            <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
              Create pane
            </button>
          </form>
        ) : null}

        {showOtherPanes ? (
          <div className="rounded-panel border border-border-muted bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Other panes</h3>
              <input
                value={otherPaneQuery}
                onChange={(event) => setOtherPaneQuery(event.target.value)}
                className="rounded-panel border border-border-muted bg-surface-elevated px-2 py-1 text-xs text-text"
                placeholder="Search panes"
                aria-label="Search read-only panes"
              />
            </div>
            <div className="mt-3 space-y-2">
              {filteredReadOnlyPanes.length === 0 ? (
                <p className="text-sm text-muted">No matching read-only panes.</p>
              ) : (
                filteredReadOnlyPanes.map((pane) => (
                  <button
                    key={pane.pane_id}
                    type="button"
                    onClick={() => {
                      onNavigateToPane({
                        paneId: pane.pane_id,
                        paneName: pane.name,
                        paneSource: 'click',
                      });
                    }}
                    className="flex w-full items-center justify-between rounded-panel border border-border-muted px-3 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-text">{pane.name}</span>
                    <span className="text-xs text-muted">Read only</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
      {paneMutationError ? (
        <InlineNotice variant="danger" className="mt-2" title="Pane update failed">
          {paneMutationError}
        </InlineNotice>
      ) : null}

      {activePane ? (
        <Dialog open={paneSettingsOpen} onOpenChange={handlePaneSettingsOpenChange}>
          <DialogContent
            open={paneSettingsOpen}
            animated
            layoutId={dialogLayoutIds.paneSettings}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              paneSettingsTriggerRef.current?.focus();
            }}
          >
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
                  onClick={() => handlePaneSettingsOpenChange(false)}
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
                      setPaneSettingsOpen(false);
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
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};
