import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { HubProjectSummary, HubProject, HubProjectMember } from '../../../services/hub/types';
import { useShellHeader } from '../../../components/layout/AppShell/ShellHeaderContext';
import {
  Dialog,
  DialogContent,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { updateSpace } from '../../../services/hub/spaces';
import { dialogLayoutIds } from '../../../styles/motion';
import { buildProjectOverviewHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
import { ProjectSpaceInspectorOverlay } from './ProjectSpaceInspectorOverlay';
import { ProjectSpaceOverviewSurface } from './ProjectSpaceOverviewSurface';
import { ProjectSpaceWorkSurface } from './ProjectSpaceWorkSurface';
import { ProjectSpaceProjectSettingsDialog } from './ProjectSpaceProjectSettingsDialog';
import { projectSurfaceTabs, type ProjectSurfaceId } from '../../../components/project-space/ProjectSurfaces';
import { useProjectSpacePageRuntime } from './hooks/useProjectSpacePageRuntime';
import { PROJECT_SPACE_PRIMARY_SURFACES, type TimelineEvent, type TopLevelProjectTab } from './types';

export type { TopLevelProjectTab } from './types';

const primarySurfaceLabels: Record<TopLevelProjectTab, string> = {
  overview: 'Overview',
  work: 'Work',
};

export const ProjectSpaceWorkspace = ({
  activeTab,
  project,
  projects,
  setProjects,
  projectMembers,
  accessToken,
  sessionUserId,
  refreshProjectData,
  timeline,
  setTimeline,
}: {
  activeTab: TopLevelProjectTab;
  project: HubProject;
  projects: HubProjectSummary[];
  setProjects: React.Dispatch<React.SetStateAction<HubProjectSummary[]>>;
  projectMembers: HubProjectMember[];
  accessToken: string;
  sessionUserId: string;
  refreshProjectData: () => Promise<void>;
  timeline: TimelineEvent[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
}): ReactElement => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [activeProjectSurface, setActiveProjectSurface] = useState<ProjectSurfaceId>('hub');
  const {
    projectLayoutId,
    navigatorProps,
    overviewProps,
    workProps,
    recordInspectorOverlayProps,
  } = useProjectSpacePageRuntime({
    activeTab,
    project,
    projects,
    setProjects,
    projectMembers,
    accessToken,
    sessionUserId,
    refreshProjectData,
    timeline,
    setTimeline,
    prefersReducedMotion,
  });
  const activeWorkProject = workProps.projectChromeProps.activeProject;
  const activeWorkProjectCanEdit = workProps.projectChromeProps.activeProjectCanEdit;
  const activeWorkProjectWidgetsEnabled = workProps.projectChromeProps.widgetsEnabled;
  const activeWorkProjectWorkspaceEnabled = workProps.projectChromeProps.workspaceEnabled;
  const moveWorkProject = workProps.projectChromeProps.onMoveProject;
  const toggleActiveWorkProjectPinned = workProps.projectChromeProps.onTogglePinned;
  const toggleActiveWorkProjectRegion = workProps.projectChromeProps.onToggleActiveProjectRegion;
  const updateWorkProject = workProps.projectChromeProps.onUpdateProject;
  const canAccessOverview = project.membership_role !== 'viewer' && project.membership_role !== 'guest';
  const primarySurfaces = useMemo(
    () => (canAccessOverview
      ? PROJECT_SPACE_PRIMARY_SURFACES
      : PROJECT_SPACE_PRIMARY_SURFACES.filter((surface) => surface !== 'overview')),
    [canAccessOverview],
  );
  const {
    activeTab: navigatorActiveTab,
    currentProjectId: navigatorCurrentProjectId,
    openedFromPinned: navigatorOpenedFromPinned,
    pinnedProjects: navigatorPinnedProjects,
    projectId: navigatorProjectId,
    projectName: navigatorProjectName,
  } = navigatorProps;
  const renamePlace = useCallback(
    async (name: string) => {
      if (activeTab === 'work' && activeWorkProject) {
        await updateWorkProject(activeWorkProject.project_id, { name });
        return;
      }
      await updateSpace(accessToken, project.space_id, { name });
      await refreshProjectData();
    },
    [accessToken, activeTab, activeWorkProject, project.space_id, refreshProjectData, updateWorkProject],
  );
  const shellHeaderConfig = useMemo(() => {
    const projectSurfaceNavItems = projectSurfaceTabs.map((surface) => ({
      id: surface.id,
      label: surface.label,
      selected: activeTab === 'work' && activeProjectSurface === surface.id,
      onSelect: () => setActiveProjectSurface(surface.id),
    }));
    const spaceNavItems = primarySurfaces.map((surface) => {
      const selected = surface === 'work'
        ? navigatorActiveTab === 'work' && !navigatorOpenedFromPinned
        : navigatorActiveTab === surface;

      return {
        id: `space-${surface}`,
        label: primarySurfaceLabels[surface],
        selected,
        href: surface === 'overview'
          ? buildProjectOverviewHref(project.space_id)
          : buildProjectWorkHref(project.space_id, activeWorkProject?.project_id),
        state: {
          hubProjectName: surface === 'overview'
            ? navigatorProjectName
            : activeWorkProject?.name ?? navigatorProjectName,
          hubProjectSource: 'click',
          ...(surface === 'overview' ? { hubAnnouncement: `Back to ${navigatorProjectName}` } : {}),
        },
      };
    });
    const pinnedNavItems = navigatorPinnedProjects.map((project) => ({
      id: `pinned-${project.project_id}`,
      label: project.name,
      selected: navigatorCurrentProjectId === project.project_id && navigatorOpenedFromPinned,
      href: `${buildProjectWorkHref(navigatorProjectId, project.project_id)}?pinned=1`,
      state: {
        hubProjectName: project.name,
        hubProjectSource: 'click',
      },
      ariaLabel: `Open pinned project ${project.name}`,
    }));
    const variableNavItems = activeTab === 'work'
      ? projectSurfaceNavItems
      : [...spaceNavItems, ...pinnedNavItems];
    const placeTitle = activeTab === 'work'
      ? activeWorkProject?.name ?? navigatorProjectName
      : navigatorProjectName;
    const placeActions = activeTab === 'work' && activeWorkProject
      ? [
          {
            id: 'project-settings',
            label: 'Project settings',
            onSelect: () => setProjectSettingsOpen(true),
          },
          {
            id: 'toggle-pinned',
            label: activeWorkProject.pinned ? 'Unpin project' : 'Pin project',
            onSelect: () => {
              void toggleActiveWorkProjectPinned(activeWorkProject);
            },
          },
          {
            id: 'move-up',
            label: 'Move project left',
            onSelect: () => {
              void moveWorkProject(activeWorkProject, 'up');
            },
          },
          {
            id: 'move-down',
            label: 'Move project right',
            onSelect: () => {
              void moveWorkProject(activeWorkProject, 'down');
            },
          },
          {
            id: 'toggle-widgets',
            label: activeWorkProjectWidgetsEnabled ? 'Hide widgets' : 'Show widgets',
            disabled: !activeWorkProjectCanEdit,
            onSelect: () => toggleActiveWorkProjectRegion('widgets_enabled'),
          },
          {
            id: 'toggle-workspace',
            label: activeWorkProjectWorkspaceEnabled ? 'Hide workspace' : 'Show workspace',
            disabled: !activeWorkProjectCanEdit,
            onSelect: () => toggleActiveWorkProjectRegion('workspace_enabled'),
          },
        ]
      : [];

    return {
      backAction: activeTab === 'work'
        ? {
            label: `Back to ${navigatorProjectName}`,
            href: buildProjectOverviewHref(project.space_id),
            state: {
              hubAnnouncement: `Back to ${navigatorProjectName}`,
              hubProjectName: navigatorProjectName,
              hubProjectSource: 'click',
            },
          }
        : {
            label: 'Back to Home',
            href: '/projects',
            state: {
              hubAnnouncement: 'Back to Home',
            },
          },
      navItems: variableNavItems,
      placeTitle,
      placeKind: activeTab === 'work' ? 'project' as const : 'space' as const,
      onRenamePlace: renamePlace,
      placeActions,
    };
  }, [
    activeProjectSurface,
    activeWorkProject,
    activeWorkProjectCanEdit,
    activeWorkProjectWidgetsEnabled,
    activeWorkProjectWorkspaceEnabled,
    activeTab,
    moveWorkProject,
    navigatorActiveTab,
    navigatorCurrentProjectId,
    navigatorOpenedFromPinned,
    navigatorPinnedProjects,
    navigatorProjectId,
    navigatorProjectName,
    primarySurfaces,
    project.space_id,
    renamePlace,
    setProjectSettingsOpen,
    toggleActiveWorkProjectPinned,
    toggleActiveWorkProjectRegion,
  ]);

  useShellHeader(shellHeaderConfig);

  return (
    <motion.div layoutId={projectLayoutId} className="space-y-4">
      {activeTab === 'overview' ? <ProjectSpaceOverviewSurface {...overviewProps} /> : null}
      {activeTab === 'work' ? (
        <ProjectSpaceWorkSurface
          {...workProps}
          activeProjectSurface={activeProjectSurface}
        />
      ) : null}

      <ProjectSpaceInspectorOverlay {...recordInspectorOverlayProps} />
      {workProps.projectChromeProps.activeProject ? (
        <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
          <DialogContent
            open={projectSettingsOpen}
            animated
            layoutId={!prefersReducedMotion ? dialogLayoutIds.projectSettings : undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
            }}
          >
            <ProjectSpaceProjectSettingsDialog
              projectId={workProps.projectChromeProps.projectId}
              activeProject={workProps.projectChromeProps.activeProject}
              activeProjectCanEdit={workProps.projectChromeProps.activeProjectCanEdit}
              activeEditableProjectIndex={workProps.projectChromeProps.activeEditableProjectIndex}
              orderedEditableProjects={workProps.projectChromeProps.orderedEditableProjects}
              projectMemberList={workProps.projectChromeProps.projectMemberList}
              sessionUserId={workProps.projectChromeProps.sessionUserId}
              widgetsEnabled={workProps.projectChromeProps.widgetsEnabled}
              workspaceEnabled={workProps.projectChromeProps.workspaceEnabled}
              onRequestClose={() => setProjectSettingsOpen(false)}
              onTogglePinned={workProps.projectChromeProps.onTogglePinned}
              onMoveProject={workProps.projectChromeProps.onMoveProject}
              onToggleProjectMember={workProps.projectChromeProps.onToggleProjectMember}
              onDeleteProject={workProps.projectChromeProps.onDeleteProject}
              onUpdateProject={workProps.projectChromeProps.onUpdateProject}
              onToggleActiveProjectRegion={workProps.projectChromeProps.onToggleActiveProjectRegion}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </motion.div>
  );
};
