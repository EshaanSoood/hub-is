import { FormEvent, useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { Icon, InlineNotice } from '../../../components/primitives';
import { ProjectSwitcher } from '../../../components/project-space/ProjectSwitcher';
import type { HubProjectSummary, HubProjectMember } from '../../../services/hub/types';
import type { ProjectLateralSource } from '../../../components/motion/hubMotion';
import { dialogLayoutIds } from '../../../styles/motion';
import { useProjectControlEffects } from '../hooks/useProjectControlEffects';
import { ProjectSpaceProjectSettingsDialog } from './ProjectSpaceProjectSettingsDialog';

const projectToolbarButtonClassName =
  'interactive interactive-fold card-folded inline-flex h-8 items-center justify-center bg-surface-low px-3 text-xs font-semibold text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const projectToolbarIconButtonClassName = `${projectToolbarButtonClassName} w-8 px-0`;

export interface ProjectSpaceProjectChromeProps {
  projectId: string;
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  canWriteProject: boolean;
  openedFromPinned: boolean;
  orderedEditableProjects: HubProjectSummary[];
  readOnlyProjects: HubProjectSummary[];
  projectMemberList: HubProjectMember[];
  sessionUserId: string;
  activeEditableProjectIndex: number;
  widgetsEnabled: boolean;
  workspaceEnabled: boolean;
  projectMutationError: string | null;
  onNavigateToProject: (params: {
    projectId: string;
    projectName?: string | null;
    projectSource?: ProjectLateralSource;
    query?: string;
    extraState?: unknown;
  }) => void;
  onCreateProject: (name: string) => Promise<HubProjectSummary | null>;
  onMoveProject: (project: HubProjectSummary, direction: 'up' | 'down') => Promise<void>;
  onTogglePinned: (project: HubProjectSummary) => Promise<void>;
  onToggleProjectMember: (project: HubProjectSummary, memberUserId: string) => Promise<void>;
  onDeleteProject: (project: HubProjectSummary) => Promise<void>;
  onUpdateProject: (projectId: string, patch: { name?: string; layout_config?: Record<string, unknown> }) => Promise<void>;
  onToggleActiveProjectRegion: (region: 'widgets_enabled' | 'workspace_enabled') => void;
}

export const ProjectSpaceWorkProjectChrome = ({
  projectId,
  activeProject,
  activeProjectCanEdit,
  canWriteProject,
  openedFromPinned,
  orderedEditableProjects,
  readOnlyProjects,
  projectMemberList,
  sessionUserId,
  activeEditableProjectIndex,
  widgetsEnabled,
  workspaceEnabled,
  projectMutationError,
  onNavigateToProject,
  onCreateProject,
  onMoveProject,
  onTogglePinned,
  onToggleProjectMember,
  onDeleteProject,
  onUpdateProject,
  onToggleActiveProjectRegion,
}: ProjectSpaceProjectChromeProps): ReactElement => {
  const prefersReducedMotion = useReducedMotion();
  const [creatingProjectName, setCreatingProjectName] = useState('');
  const [showCreateProjectControl, setShowCreateProjectControl] = useState(false);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(!openedFromPinned);
  const [showOtherProjects, setShowOtherProjects] = useState(false);
  const [otherProjectQuery, setOtherProjectQuery] = useState('');
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const previousOpenedFromPinnedRef = useRef(openedFromPinned);
  const createProjectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const projectSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createProjectNameInputRef = useRef<HTMLInputElement | null>(null);

  useProjectControlEffects({
    openedFromPinned,
    previousOpenedFromPinnedRef,
    setShowProjectSwitcher,
    showCreateProjectControl,
    createProjectNameInputRef,
  });

  const filteredReadOnlyProjects = useMemo(() => {
    const query = otherProjectQuery.trim().toLowerCase();
    if (!query) {
      return readOnlyProjects;
    }
    return readOnlyProjects.filter((project) => project.name.toLowerCase().includes(query));
  }, [otherProjectQuery, readOnlyProjects]);

  const handleProjectSettingsOpenChange = useCallback(
    (nextOpen: boolean) => {
      setProjectSettingsOpen(nextOpen);
    },
    [],
  );

  const onCreateProjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = creatingProjectName.trim();
    if (!trimmedName) {
      return;
    }
    const nextProject = await onCreateProject(trimmedName);
    if (!nextProject) {
      return;
    }

    setCreatingProjectName('');
    setShowCreateProjectControl(false);
    createProjectTriggerRef.current?.focus();
    onNavigateToProject({
      projectId: nextProject.space_id,
      projectName: nextProject.name,
      projectSource: 'click',
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
              onClick={() => setShowProjectSwitcher((current) => !current)}
              aria-expanded={showProjectSwitcher}
              aria-label={showProjectSwitcher ? 'Hide project switcher' : 'Show project switcher'}
            >
              {showProjectSwitcher ? 'Hide project switcher' : 'Show project switcher'}
            </button>
          ) : null}
          {readOnlyProjects.length > 0 ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowOtherProjects((current) => !current)}
              aria-expanded={showOtherProjects}
            >
              {showOtherProjects ? 'Hide other projects' : `Other projects (${readOnlyProjects.length})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {showProjectSwitcher ? (
            <div className="min-w-0 flex-1 overflow-x-auto">
              <ProjectSwitcher
                projects={orderedEditableProjects.map((project, index) => ({
                  id: project.project_id,
                  label: project.name,
                  shortcutNumber: index + 1,
                }))}
                activeProjectId={activeProject?.project_id ?? null}
                onProjectChange={(nextProjectId, source) => {
                  const nextProject = orderedEditableProjects.find((project) => project.project_id === nextProjectId) || null;
                  onNavigateToProject({
                    projectId: nextProjectId,
                    projectName: nextProject?.name,
                    projectSource: source,
                  });
                }}
                onMoveProject={(projectIdToMove, direction) => {
                  const project = orderedEditableProjects.find((entry) => entry.project_id === projectIdToMove);
                  if (project) {
                    void onMoveProject(project, direction);
                  }
                }}
              />
            </div>
          ) : openedFromPinned ? (
            <p className="text-xs text-muted">Project switcher hidden. Use the focusable toggle above to reveal it.</p>
          ) : null}
          {canWriteProject ? (
            <button
              ref={createProjectTriggerRef}
              type="button"
              className={projectToolbarButtonClassName}
              aria-expanded={showCreateProjectControl}
              onClick={() => setShowCreateProjectControl((current) => !current)}
            >
              New project
            </button>
          ) : null}
          <motion.div
            layoutId={!prefersReducedMotion && projectSettingsOpen ? dialogLayoutIds.projectSettings : undefined}
            className="inline-flex"
          >
            <button
              ref={projectSettingsTriggerRef}
              type="button"
              className={projectToolbarIconButtonClassName}
              aria-label="Project settings"
              aria-expanded={projectSettingsOpen}
              onClick={() => setProjectSettingsOpen(true)}
              disabled={!activeProject}
            >
              <Icon name="settings" className="text-[14px]" />
            </button>
          </motion.div>
        </div>

        {showCreateProjectControl && canWriteProject ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={onCreateProjectSubmit}>
            <input
              ref={createProjectNameInputRef}
              value={creatingProjectName}
              onChange={(event) => setCreatingProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setShowCreateProjectControl(false);
                  createProjectTriggerRef.current?.focus();
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

        {showOtherProjects ? (
          <div className="rounded-panel border border-border-muted bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Other projects</h3>
              <input
                value={otherProjectQuery}
                onChange={(event) => setOtherProjectQuery(event.target.value)}
                className="rounded-panel border border-border-muted bg-surface-elevated px-2 py-1 text-xs text-text"
                placeholder="Search projects"
                aria-label="Search read-only projects"
              />
            </div>
            <div className="mt-3 space-y-2">
              {filteredReadOnlyProjects.length === 0 ? (
                <p className="text-sm text-muted">No matching read-only projects.</p>
              ) : (
                filteredReadOnlyProjects.map((project) => (
                  <button
                    key={project.project_id}
                    type="button"
                    onClick={() => {
                      onNavigateToProject({
                        projectId: project.project_id,
                        projectName: project.name,
                        projectSource: 'click',
                      });
                    }}
                    className="flex w-full items-center justify-between rounded-panel border border-border-muted px-3 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-text">{project.name}</span>
                    <span className="text-xs text-muted">Read only</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
      {projectMutationError ? (
        <InlineNotice variant="danger" className="mt-2" title="Project update failed">
          {projectMutationError}
        </InlineNotice>
      ) : null}

      {activeProject ? (
        <Dialog open={projectSettingsOpen} onOpenChange={handleProjectSettingsOpenChange}>
          <DialogContent
            open={projectSettingsOpen}
            animated
            layoutId={dialogLayoutIds.projectSettings}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              projectSettingsTriggerRef.current?.focus();
            }}
          >
            <ProjectSpaceProjectSettingsDialog
              projectId={projectId}
              activeProject={activeProject}
              activeProjectCanEdit={activeProjectCanEdit}
              activeEditableProjectIndex={activeEditableProjectIndex}
              orderedEditableProjects={orderedEditableProjects}
              projectMemberList={projectMemberList}
              sessionUserId={sessionUserId}
              widgetsEnabled={widgetsEnabled}
              workspaceEnabled={workspaceEnabled}
              onRequestClose={() => handleProjectSettingsOpenChange(false)}
              onTogglePinned={onTogglePinned}
              onMoveProject={onMoveProject}
              onToggleProjectMember={onToggleProjectMember}
              onDeleteProject={onDeleteProject}
              onUpdateProject={onUpdateProject}
              onToggleActiveProjectRegion={onToggleActiveProjectRegion}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};
