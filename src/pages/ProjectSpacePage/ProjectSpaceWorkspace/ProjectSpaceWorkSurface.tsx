import type { ComponentProps, ReactElement } from 'react';
import { AccessDeniedView } from '../../../components/auth/AccessDeniedView';
import { WorkspaceDocSurface } from '../../../components/project-space/WorkspaceDocSurface';
import { InlineNotice } from '../../../components/primitives';
import { WorkView } from '../../../components/project-space/WorkView';
import type { HubProjectSummary } from '../../../services/hub/types';
import { ProjectSpaceFocusedViewSection } from './ProjectSpaceFocusedViewSection';
import { ProjectSpaceWorkProjectChrome } from './ProjectSpaceWorkProjectChrome';

type ProjectChromeProps = ComponentProps<typeof ProjectSpaceWorkProjectChrome>;
type FocusedViewProps = ComponentProps<typeof ProjectSpaceFocusedViewSection>;
type WorkViewProps = ComponentProps<typeof WorkView>;
type WorkspaceDocProps = ComponentProps<typeof WorkspaceDocSurface>;

export interface ProjectSpaceWorkSurfaceProps {
  projectId?: string;
  hasRequestedProject: boolean;
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  widgetsEnabled: boolean;
  workLayoutId?: string;
  recordsError: string | null;
  projectChromeProps: ProjectChromeProps;
  focusedViewProps: FocusedViewProps;
  workViewProps: Omit<WorkViewProps, 'layoutId' | 'project' | 'canEditProject' | 'widgetsEnabled' | 'showWorkspaceDocPlaceholder'>;
  workspaceDocProps: WorkspaceDocProps;
}

export const ProjectSpaceWorkSurface = ({
  projectId,
  hasRequestedProject,
  activeProject,
  activeProjectCanEdit,
  widgetsEnabled,
  workLayoutId,
  recordsError,
  projectChromeProps,
  focusedViewProps,
  workViewProps,
  workspaceDocProps,
}: ProjectSpaceWorkSurfaceProps): ReactElement => (
  <section className="space-y-4">
    <ProjectSpaceWorkProjectChrome {...projectChromeProps} />

    {projectId && !hasRequestedProject ? (
      <AccessDeniedView message="Project not found in this space." />
    ) : (
      <>
        <ProjectSpaceFocusedViewSection {...focusedViewProps} />

        <WorkView
          {...workViewProps}
          layoutId={workLayoutId}
          project={activeProject}
          canEditProject={activeProjectCanEdit}
          widgetsEnabled={widgetsEnabled}
          showWorkspaceDocPlaceholder={false}
        />

        {recordsError ? (
          <InlineNotice variant="danger" title="Views and records unavailable">
            {recordsError}
          </InlineNotice>
        ) : null}

        <WorkspaceDocSurface {...workspaceDocProps} />
      </>
    )}
  </section>
);
