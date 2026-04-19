import { motion, useReducedMotion } from 'framer-motion';
import type { ReactElement } from 'react';
import type { HubPaneSummary, HubProject, HubProjectMember } from '../../../services/hub/types';
import { ProjectSpaceInspectorOverlay } from './ProjectSpaceInspectorOverlay';
import { ProjectSpaceOverviewSurface } from './ProjectSpaceOverviewSurface';
import { ProjectSpaceToolsSurface } from './ProjectSpaceToolsSurface';
import { ProjectSpaceWorkSurface } from './ProjectSpaceWorkSurface';
import { useProjectSpacePageRuntime } from './hooks/useProjectSpacePageRuntime';
import type { TimelineEvent, TopLevelProjectTab } from './types';

export type { TopLevelProjectTab } from './types';

export const ProjectSpaceWorkspace = ({
  activeTab,
  project,
  panes,
  setPanes,
  projectMembers,
  accessToken,
  sessionUserId,
  refreshProjectData,
  timeline,
  setTimeline,
}: {
  activeTab: TopLevelProjectTab;
  project: HubProject;
  panes: HubPaneSummary[];
  setPanes: React.Dispatch<React.SetStateAction<HubPaneSummary[]>>;
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
    toolsProps,
    inspectorProps,
  } = useProjectSpacePageRuntime({
    activeTab,
    project,
    panes,
    setPanes,
    projectMembers,
    accessToken,
    sessionUserId,
    refreshProjectData,
    timeline,
    setTimeline,
    prefersReducedMotion,
  });

  return (
    <motion.div layoutId={projectLayoutId} className="space-y-4">
      <div className="rounded-panel border border-subtle bg-elevated p-3">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Project Space</p>
          <h1
            className="mt-1 text-base font-bold text-text"
            title={navigatorProps.projectName}
            style={{
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {navigatorProps.projectName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Project space tabs">
          <button
            type="button"
            onClick={navigatorProps.onNavigateOverview}
            className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              navigatorProps.activeTab === 'overview' ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
            }`}
            role="tab"
            aria-selected={navigatorProps.activeTab === 'overview'}
            aria-current={navigatorProps.activeTab === 'overview' ? 'page' : undefined}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={navigatorProps.onNavigateWork}
            className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              navigatorProps.activeTab === 'work' && !navigatorProps.openedFromPinned
                ? 'bg-primary text-on-primary'
                : 'border border-border-muted text-primary'
            }`}
            role="tab"
            aria-selected={navigatorProps.activeTab === 'work' && !navigatorProps.openedFromPinned}
            aria-current={navigatorProps.activeTab === 'work' && !navigatorProps.openedFromPinned ? 'page' : undefined}
          >
            Work
          </button>

          {navigatorProps.pinnedPanes.map((pane) => {
            const selected = navigatorProps.currentPaneId === pane.pane_id && navigatorProps.openedFromPinned;
            return (
              <button
                key={pane.pane_id}
                type="button"
                onClick={() => navigatorProps.onNavigatePinnedPane(pane)}
                className={`cursor-pointer rounded-panel border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  selected
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-muted bg-surface text-primary hover:border-primary hover:bg-primary/10'
                }`}
                role="tab"
                aria-selected={selected}
                aria-current={selected ? 'page' : undefined}
                aria-label={`Open pinned pane ${pane.name}`}
              >
                <span className="flex flex-col items-center leading-tight">
                  <span>{pane.name}</span>
                  <span className={selected ? 'mt-1 h-1 w-1 rounded-full bg-on-primary' : 'mt-1 h-1 w-1 rounded-full bg-muted'} aria-hidden="true" />
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={navigatorProps.onNavigateTools}
            className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              navigatorProps.activeTab === 'tools' ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
            }`}
            role="tab"
            aria-selected={navigatorProps.activeTab === 'tools'}
            aria-current={navigatorProps.activeTab === 'tools' ? 'page' : undefined}
          >
            Tools
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? <ProjectSpaceOverviewSurface {...overviewProps} /> : null}
      {activeTab === 'work' ? <ProjectSpaceWorkSurface {...workProps} /> : null}
      {activeTab === 'tools' ? <ProjectSpaceToolsSurface {...toolsProps} /> : null}

      <ProjectSpaceInspectorOverlay {...inspectorProps} />
    </motion.div>
  );
};
