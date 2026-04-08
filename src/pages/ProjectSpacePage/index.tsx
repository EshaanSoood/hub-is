import type { ReactElement } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjectBootstrap } from '../../hooks/useProjectBootstrap';
import { InlineNotice } from '../../components/primitives';
import { ProjectSpaceWorkspace, type TopLevelProjectTab } from './ProjectSpaceWorkspace';

interface ProjectSpacePageProps {
  activeTab: TopLevelProjectTab;
}

export const ProjectSpacePage = ({ activeTab }: ProjectSpacePageProps): ReactElement => {
  const { projectId = '' } = useParams();
  const { accessToken, sessionSummary } = useAuthz();
  const { error, loading, panes, project, projectMembers, refreshProjectData, setPanes, setTimeline, timeline } =
    useProjectBootstrap({
      accessToken,
      projectId,
    });

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (!accessToken) {
    return (
      <InlineNotice variant="danger" title="Authentication required">
        Authentication token is missing. Re-authenticate and retry.
      </InlineNotice>
    );
  }

  if (loading) {
    return (
      <div className="rounded-panel border border-subtle bg-elevated p-4" role="status" aria-live="polite">
        <p className="text-sm text-muted">Loading project space...</p>
        <div className="mt-3 h-2 w-3/4 animate-pulse rounded-control bg-muted/30 motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <InlineNotice variant="danger" title="Project load failed">
        {error || 'Project not found.'}
        <p className="mt-2 text-sm text-muted">
          <Link to="/projects" className="font-semibold text-primary underline">
            Return to projects
          </Link>
        </p>
      </InlineNotice>
    );
  }

  return (
    <ProjectSpaceWorkspace
      activeTab={activeTab}
      project={project}
      panes={panes}
      setPanes={setPanes}
      projectMembers={projectMembers}
      accessToken={accessToken}
      sessionUserId={sessionSummary.userId}
      refreshProjectData={refreshProjectData}
      timeline={timeline}
      setTimeline={setTimeline}
    />
  );
};
