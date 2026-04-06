import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { AccessDeniedView } from './AccessDeniedView';

export const ProjectRouteGuard = ({ children }: { children: ReactNode }) => {
  const { projectId = '' } = useParams();
  const { authReady, signedIn, canProject, refreshSession } = useAuthz();
  const { initialized, refreshProjects } = useProjects();
  const [refreshAttemptedProjectId, setRefreshAttemptedProjectId] = useState('');
  const hasProjectAccess = Boolean(projectId) && canProject(projectId, 'project.view');
  const shouldRefreshAccess =
    authReady
    && signedIn
    && initialized
    && Boolean(projectId)
    && !hasProjectAccess
    && refreshAttemptedProjectId !== projectId;

  useEffect(() => {
    if (!shouldRefreshAccess) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setRefreshAttemptedProjectId(projectId);
      void Promise.allSettled([refreshSession(), refreshProjects()]);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshProjects, refreshSession, shouldRefreshAccess]);

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

  if (!initialized || shouldRefreshAccess) {
    return (
      <div className="p-4" role="status" aria-live="polite">
        <p className="text-sm text-muted">Loading project...</p>
      </div>
    );
  }

  if (!hasProjectAccess) {
    return <AccessDeniedView message={`You do not have project.view access for ${projectId || 'this project'}.`} />;
  }

  return <>{children}</>;
};
