import { motion, useReducedMotion } from 'framer-motion';
import type { ReactElement } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjectBootstrap } from '../../hooks/useProjectBootstrap';
import { InlineNotice } from '../../components/primitives';
import { buildProjectWorkHref } from '../../lib/hubRoutes';
import { ProjectSpaceWorkspace, type TopLevelProjectTab } from './ProjectSpaceWorkspace';

interface ProjectSpacePageProps {
  activeTab: TopLevelProjectTab;
}

export const ProjectSpacePage = ({ activeTab }: ProjectSpacePageProps): ReactElement => {
  const prefersReducedMotion = useReducedMotion();
  const { projectId = '' } = useParams();
  const location = useLocation();
  const { accessToken, sessionSummary } = useAuthz();
  const resolvedActiveTab: TopLevelProjectTab = location.pathname.includes('/overview') ? 'overview' : activeTab;
  const { error, loading, projects, project, projectMembers, refreshProjectData, setProjects, setTimeline, timeline } =
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
      <motion.section
        layoutId={!prefersReducedMotion ? `project-${projectId}` : undefined}
        className="space-y-4"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-panel border border-subtle bg-elevated p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Space</p>
          <h1 className="mt-1 text-base font-bold text-text">Loading space {projectId}</h1>
        </div>
        <div className="rounded-panel border border-subtle bg-elevated p-4">
          <p className="text-sm text-muted">Loading space...</p>
          <div className="mt-3 h-2 w-3/4 animate-pulse rounded-control bg-muted/30 motion-reduce:animate-none" aria-hidden="true" />
          <div className="mt-2 h-2 w-1/2 animate-pulse rounded-control bg-muted/20 motion-reduce:animate-none" aria-hidden="true" />
        </div>
      </motion.section>
    );
  }

  if (error || !project) {
    return (
      <InlineNotice variant="danger" title="Space load failed">
        {error || 'Space not found.'}
        <p className="mt-2 text-sm text-muted">
          <Link to="/projects" className="font-semibold text-primary underline">
            Return to spaces
          </Link>
        </p>
      </InlineNotice>
    );
  }

  if (resolvedActiveTab === 'overview' && (project.membership_role === 'viewer' || project.membership_role === 'guest')) {
    return <Navigate to={buildProjectWorkHref(project.space_id)} replace />;
  }

  return (
    <ProjectSpaceWorkspace
      activeTab={resolvedActiveTab}
      project={project}
      projects={projects}
      setProjects={setProjects}
      projectMembers={projectMembers}
      accessToken={accessToken}
      sessionUserId={sessionSummary.userId}
      refreshProjectData={refreshProjectData}
      timeline={timeline}
      setTimeline={setTimeline}
    />
  );
};
