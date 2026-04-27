import { motion, useReducedMotion } from 'framer-motion';
import type { ReactElement } from 'react';
import type { HubProjectSummary, HubProject, HubProjectMember } from '../../../services/hub/types';
import { ProjectSpaceInspectorOverlay } from './ProjectSpaceInspectorOverlay';
import { ProjectSpaceOverviewSurface } from './ProjectSpaceOverviewSurface';
import { ProjectSpaceWorkSurface } from './ProjectSpaceWorkSurface';
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
  const primarySurfaceHandlers: Record<TopLevelProjectTab, () => void> = {
    overview: navigatorProps.onNavigateOverview,
    work: navigatorProps.onNavigateWork,
  };

  return (
    <motion.div layoutId={projectLayoutId} className="space-y-4">
      <div className="rounded-panel border border-subtle bg-elevated p-3">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Space</p>
          <h1
            className="mt-1 line-clamp-2 text-base font-bold text-text"
            title={navigatorProps.projectName}
          >
            {navigatorProps.projectName}
          </h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Space navigation">
          {PROJECT_SPACE_PRIMARY_SURFACES.map((surface) => {
            const selected = surface === 'work'
              ? navigatorProps.activeTab === 'work' && !navigatorProps.openedFromPinned
              : navigatorProps.activeTab === surface;

            return (
              <button
                key={surface}
                type="button"
                onClick={primarySurfaceHandlers[surface]}
                className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  selected ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
                }`}
                aria-current={selected ? 'page' : undefined}
              >
                {primarySurfaceLabels[surface]}
              </button>
            );
          })}

          {navigatorProps.pinnedProjects.map((project) => {
            const selected = navigatorProps.currentProjectId === project.project_id && navigatorProps.openedFromPinned;
            return (
              <button
                key={project.project_id}
                type="button"
                onClick={() => navigatorProps.onNavigatePinnedProject(project)}
                className={`cursor-pointer rounded-panel border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  selected
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-muted bg-surface text-primary hover:border-primary hover:bg-primary/10'
                }`}
                aria-current={selected ? 'page' : undefined}
                aria-label={`Open pinned project ${project.name}`}
              >
                <span className="flex flex-col items-center leading-tight">
                  <span>{project.name}</span>
                  <span className={selected ? 'mt-1 h-1 w-1 rounded-full bg-on-primary' : 'mt-1 h-1 w-1 rounded-full bg-muted'} aria-hidden="true" />
                </span>
              </button>
              );
          })}
        </nav>
      </div>

      {activeTab === 'overview' ? <ProjectSpaceOverviewSurface {...overviewProps} /> : null}
      {activeTab === 'work' ? <ProjectSpaceWorkSurface {...workProps} /> : null}

      <ProjectSpaceInspectorOverlay {...recordInspectorOverlayProps} />
    </motion.div>
  );
};
