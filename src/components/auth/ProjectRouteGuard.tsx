import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { AccessDeniedView } from './AccessDeniedView';

export const ProjectRouteGuard = ({ children }: { children: ReactNode }) => {
  const { projectId = '' } = useParams();
  const { authReady, signedIn, canProject, refreshSession } = useAuthz();
  const { initialized, refreshProjects } = useProjects();
  const [refreshAttemptedProjectId, setRefreshAttemptedProjectId] = useState('');
  const [refreshingProjectId, setRefreshingProjectId] = useState('');
  const activeRefreshRef = useRef<{ cancelled: boolean; projectId: string } | null>(null);
  const hasProjectAccess = Boolean(projectId) && canProject(projectId, 'project.view');
  const isRefreshingProjectAccess = refreshingProjectId === projectId;
  const shouldRefreshAccess =
    authReady
    && signedIn
    && initialized
    && Boolean(projectId)
    && !hasProjectAccess
    && refreshAttemptedProjectId !== projectId;

  useEffect(() => {
    const activeRefresh = activeRefreshRef.current;
    if (activeRefresh && activeRefresh.projectId !== projectId) {
      activeRefresh.cancelled = true;
      activeRefreshRef.current = null;
      setRefreshingProjectId((current) => (current === activeRefresh.projectId ? '' : current));
    }
  }, [projectId]);

  useEffect(() => {
    if (!shouldRefreshAccess || activeRefreshRef.current?.projectId === projectId) {
      return;
    }

    const activeRefresh = { cancelled: false, projectId };
    activeRefreshRef.current = activeRefresh;
    queueMicrotask(() => {
      if (activeRefresh.cancelled || activeRefreshRef.current !== activeRefresh) {
        return;
      }
      setRefreshingProjectId(projectId);
      void Promise.allSettled([refreshSession(), refreshProjects()]).finally(() => {
        if (activeRefresh.cancelled || activeRefreshRef.current !== activeRefresh) {
          return;
        }
        activeRefreshRef.current = null;
        setRefreshingProjectId((current) => (current === projectId ? '' : current));
        setRefreshAttemptedProjectId(projectId);
      });
    });
  }, [projectId, refreshProjects, refreshSession, shouldRefreshAccess]);

  useEffect(() => () => {
    if (activeRefreshRef.current) {
      activeRefreshRef.current.cancelled = true;
      activeRefreshRef.current = null;
    }
  }, []);

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

  if (!initialized || shouldRefreshAccess || isRefreshingProjectAccess) {
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
