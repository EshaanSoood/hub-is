import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { AccessDeniedView } from './AccessDeniedView';

export const ProjectRouteGuard = ({ children }: { children: ReactNode }) => {
  const { projectId = '' } = useParams();
  const { authReady, signedIn, canProject } = useAuthz();
  const { projects, initialized } = useProjects();
  const project = projects.find((entry) => entry.id === projectId) || null;

  if (!authReady) {
    return (
      <div className="p-4" role="status" aria-live="polite">
        <p className="text-sm text-muted">Initializing session...</p>
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/" replace />;
  }

  if (!initialized) {
    return (
      <div className="p-4" role="status" aria-live="polite">
        <p className="text-sm text-muted">Loading project...</p>
      </div>
    );
  }

  if (project?.isPersonal) {
    return <Navigate to="/projects" replace />;
  }

  if (!projectId || !canProject(projectId, 'project.view')) {
    return <AccessDeniedView message={`You do not have project.view access for ${projectId || 'this project'}.`} />;
  }

  return <>{children}</>;
};
