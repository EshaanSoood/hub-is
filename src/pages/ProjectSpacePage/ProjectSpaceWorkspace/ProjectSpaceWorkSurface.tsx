import type { ComponentProps, ReactElement } from 'react';
import { AccessDeniedView } from '../../../components/auth/AccessDeniedView';
import { InlineNotice } from '../../../components/primitives';
import { WorkView } from '../../../components/project-space/WorkView';
import type { HubPaneSummary } from '../../../services/hub/types';
import { ProjectSpaceFocusedViewSection } from './ProjectSpaceFocusedViewSection';
import { ProjectSpaceWorkPaneChrome } from './ProjectSpaceWorkPaneChrome';
import { ProjectSpaceWorkspaceDocSection } from './ProjectSpaceWorkspaceDocSection';

type PaneChromeProps = ComponentProps<typeof ProjectSpaceWorkPaneChrome>;
type FocusedViewProps = ComponentProps<typeof ProjectSpaceFocusedViewSection>;
type WorkViewProps = ComponentProps<typeof WorkView>;
type WorkspaceDocProps = ComponentProps<typeof ProjectSpaceWorkspaceDocSection>;

export interface ProjectSpaceWorkSurfaceProps {
  paneId?: string;
  hasRequestedPane: boolean;
  activePane: HubPaneSummary | null;
  activePaneCanEdit: boolean;
  modulesEnabled: boolean;
  workLayoutId?: string;
  recordsError: string | null;
  paneChromeProps: PaneChromeProps;
  focusedViewProps: FocusedViewProps;
  workViewProps: Omit<WorkViewProps, 'layoutId' | 'pane' | 'canEditPane' | 'modulesEnabled' | 'showWorkspaceDocPlaceholder'>;
  workspaceDocProps: WorkspaceDocProps;
}

export const ProjectSpaceWorkSurface = ({
  paneId,
  hasRequestedPane,
  activePane,
  activePaneCanEdit,
  modulesEnabled,
  workLayoutId,
  recordsError,
  paneChromeProps,
  focusedViewProps,
  workViewProps,
  workspaceDocProps,
}: ProjectSpaceWorkSurfaceProps): ReactElement => (
  <section className="space-y-4">
    <ProjectSpaceWorkPaneChrome {...paneChromeProps} />

    {paneId && !hasRequestedPane ? (
      <AccessDeniedView message="Pane not found in this project." />
    ) : (
      <>
        <ProjectSpaceFocusedViewSection {...focusedViewProps} />

        <WorkView
          {...workViewProps}
          layoutId={workLayoutId}
          pane={activePane}
          canEditPane={activePaneCanEdit}
          modulesEnabled={modulesEnabled}
          showWorkspaceDocPlaceholder={false}
        />

        {recordsError ? (
          <InlineNotice variant="danger" title="Views and records unavailable">
            {recordsError}
          </InlineNotice>
        ) : null}

        <ProjectSpaceWorkspaceDocSection {...workspaceDocProps} />
      </>
    )}
  </section>
);
