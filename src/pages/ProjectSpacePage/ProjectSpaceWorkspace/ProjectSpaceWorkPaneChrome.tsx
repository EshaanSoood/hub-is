import { FormEvent, useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { Icon, IconButton, InlineNotice } from '../../../components/primitives';
import { PaneSwitcher } from '../../../components/project-space/PaneSwitcher';
import type { HubPaneSummary, HubProjectMember } from '../../../services/hub/types';
import type { PaneLateralSource } from '../../../components/motion/hubMotion';
import { dialogLayoutIds } from '../../../styles/motion';
import { usePaneControlEffects } from '../hooks/usePaneControlEffects';
import { ProjectSpacePaneSettingsDialog } from './ProjectSpacePaneSettingsDialog';

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
  const createPaneTriggerRef = useRef<HTMLButtonElement | null>(null);
  const paneSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
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

  const handlePaneSettingsOpenChange = useCallback(
    (nextOpen: boolean) => {
      setPaneSettingsOpen(nextOpen);
    },
    [],
  );

  const onCreatePaneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = creatingPaneName.trim();
    if (!trimmedName) {
      return;
    }
    const nextPane = await onCreatePane(trimmedName);
    if (!nextPane) {
      return;
    }

    setCreatingPaneName('');
    setShowCreatePaneControl(false);
    createPaneTriggerRef.current?.focus();
    onNavigateToPane({
      paneId: nextPane.pane_id,
      paneName: nextPane.name,
      paneSource: 'click',
    });
  };

  return (
    <div className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="heading-3 text-primary">Projects</h2>
        <div className="flex flex-wrap gap-2">
          {openedFromPinned ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowPaneSwitcher((current) => !current)}
              aria-expanded={showPaneSwitcher}
              aria-label={showPaneSwitcher ? 'Hide project switcher' : 'Show project switcher'}
            >
              {showPaneSwitcher ? 'Hide project switcher' : 'Show project switcher'}
            </button>
          ) : null}
          {readOnlyPanes.length > 0 ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowOtherPanes((current) => !current)}
              aria-expanded={showOtherPanes}
            >
              {showOtherPanes ? 'Hide other projects' : `Other projects (${readOnlyPanes.length})`}
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
            <p className="text-xs text-muted">Project switcher hidden. Use the focusable toggle above to reveal it.</p>
          ) : null}
          {canWriteProject ? (
            <IconButton
              ref={createPaneTriggerRef}
              type="button"
              size="sm"
              variant={showCreatePaneControl ? 'secondary' : 'ghost'}
              aria-label={showCreatePaneControl ? 'Collapse create project' : 'Create project'}
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
              aria-label="Project settings"
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
                  createPaneTriggerRef.current?.focus();
                }
              }}
              className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
              placeholder="New project name"
              aria-label="New project name"
            />
            <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
              Create project
            </button>
          </form>
        ) : null}

        {showOtherPanes ? (
          <div className="rounded-panel border border-border-muted bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Other projects</h3>
              <input
                value={otherPaneQuery}
                onChange={(event) => setOtherPaneQuery(event.target.value)}
                className="rounded-panel border border-border-muted bg-surface-elevated px-2 py-1 text-xs text-text"
                placeholder="Search projects"
                aria-label="Search read-only projects"
              />
            </div>
            <div className="mt-3 space-y-2">
              {filteredReadOnlyPanes.length === 0 ? (
                <p className="text-sm text-muted">No matching read-only projects.</p>
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
        <InlineNotice variant="danger" className="mt-2" title="Project update failed">
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
            <ProjectSpacePaneSettingsDialog
              projectId={projectId}
              activePane={activePane}
              activePaneCanEdit={activePaneCanEdit}
              activeEditablePaneIndex={activeEditablePaneIndex}
              orderedEditablePanes={orderedEditablePanes}
              projectMemberList={projectMemberList}
              sessionUserId={sessionUserId}
              modulesEnabled={modulesEnabled}
              workspaceEnabled={workspaceEnabled}
              onRequestClose={() => handlePaneSettingsOpenChange(false)}
              onTogglePinned={onTogglePinned}
              onMovePane={onMovePane}
              onTogglePaneMember={onTogglePaneMember}
              onDeletePane={onDeletePane}
              onUpdatePane={onUpdatePane}
              onToggleActivePaneRegion={onToggleActivePaneRegion}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};
