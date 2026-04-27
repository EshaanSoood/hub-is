import { useCallback, useRef, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import { DialogDescription, DialogHeader, DialogTitle } from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import type { HubProjectSummary, HubProjectMember } from '../../../services/hub/types';

type ProjectSpaceProjectSettingsDialogProps = {
  projectId: string;
  activeProject: HubProjectSummary;
  activeProjectCanEdit: boolean;
  activeEditableProjectIndex: number;
  orderedEditableProjects: HubProjectSummary[];
  projectMemberList: HubProjectMember[];
  sessionUserId: string;
  widgetsEnabled: boolean;
  workspaceEnabled: boolean;
  onRequestClose: () => void;
  onTogglePinned: (project: HubProjectSummary) => Promise<void>;
  onMoveProject: (project: HubProjectSummary, direction: 'up' | 'down') => Promise<void>;
  onToggleProjectMember: (project: HubProjectSummary, memberUserId: string) => Promise<void>;
  onDeleteProject: (project: HubProjectSummary) => Promise<void>;
  onUpdateProject: (projectId: string, patch: { name?: string; layout_config?: Record<string, unknown> }) => Promise<void>;
  onToggleActiveProjectRegion: (region: 'widgets_enabled' | 'workspace_enabled') => void;
};

export const ProjectSpaceProjectSettingsDialog = ({
  projectId,
  activeProject,
  activeProjectCanEdit,
  activeEditableProjectIndex,
  orderedEditableProjects,
  projectMemberList,
  sessionUserId,
  widgetsEnabled,
  workspaceEnabled,
  onRequestClose,
  onTogglePinned,
  onMoveProject,
  onToggleProjectMember,
  onDeleteProject,
  onUpdateProject,
  onToggleActiveProjectRegion,
}: ProjectSpaceProjectSettingsDialogProps): ReactElement => {
  const projectSettingsNameInputRef = useRef<HTMLInputElement | null>(null);

  const commitActiveProjectSettingsName = useCallback(() => {
    if (!activeProjectCanEdit) {
      return;
    }
    const nextName = projectSettingsNameInputRef.current?.value.trim();
    if (!nextName) {
      if (projectSettingsNameInputRef.current) {
        projectSettingsNameInputRef.current.value = activeProject.name;
      }
      return;
    }
    if (nextName !== activeProject.name) {
      void onUpdateProject(activeProject.project_id, { name: nextName });
    }
    if (projectSettingsNameInputRef.current) {
      projectSettingsNameInputRef.current.value = nextName;
    }
  }, [activeProject, activeProjectCanEdit, onUpdateProject]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Project Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage settings for project {activeProject.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="project-settings-name">
            Project name
          </label>
          <input
            key={activeProject.project_id}
            ref={projectSettingsNameInputRef}
            id="project-settings-name"
            defaultValue={activeProject.name}
            autoFocus
            disabled={!activeProjectCanEdit}
            className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            aria-label="Project name"
            onBlur={() => commitActiveProjectSettingsName()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitActiveProjectSettingsName();
              }
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={buildProjectWorkHref(projectId, activeProject.project_id)}
            onClick={() => onRequestClose()}
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
          >
            Open project
          </Link>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
            onClick={() => {
              void onTogglePinned(activeProject);
            }}
            disabled={!activeProjectCanEdit}
          >
            {activeProject.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
            onClick={() => {
              void onMoveProject(activeProject, 'up');
            }}
            disabled={!activeProjectCanEdit || activeEditableProjectIndex <= 0}
          >
            Move up
          </button>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
            onClick={() => {
              void onMoveProject(activeProject, 'down');
            }}
            disabled={!activeProjectCanEdit || activeEditableProjectIndex < 0 || activeEditableProjectIndex >= orderedEditableProjects.length - 1}
          >
            Move down
          </button>
          {orderedEditableProjects.length > 1 ? (
            <button
              type="button"
              className="rounded-panel border border-danger px-3 py-1.5 text-sm font-semibold text-danger disabled:opacity-60"
              onClick={() => {
                onRequestClose();
                void onDeleteProject(activeProject);
              }}
              disabled={!activeProjectCanEdit}
            >
              Delete project
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Regions</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
              onClick={() => onToggleActiveProjectRegion('widgets_enabled')}
              disabled={!activeProjectCanEdit}
            >
              {widgetsEnabled ? 'Hide widgets' : 'Show widgets'}
            </button>
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
              onClick={() => onToggleActiveProjectRegion('workspace_enabled')}
              disabled={!activeProjectCanEdit}
            >
              {workspaceEnabled ? 'Hide workspace doc' : 'Show workspace doc'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Project members</p>
          <div className="flex flex-wrap gap-2">
            {projectMemberList
              .filter((member) => String(member.role).toLowerCase() !== 'owner'
                || activeProject.members.some((entry) => entry.user_id === member.user_id))
              .map((member) => {
                const selected = activeProject.members.some((entry) => entry.user_id === member.user_id);
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
                        void onToggleProjectMember(activeProject, member.user_id);
                      }}
                      disabled={!activeProjectCanEdit || member.user_id === sessionUserId}
                    />
                    {member.display_name}
                  </label>
                );
              })}
          </div>
        </div>

        {!activeProjectCanEdit ? <p className="text-xs text-muted">Read-only project.</p> : null}
      </div>
    </>
  );
};
