import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { AccessDeniedView } from './AccessDeniedView';

export const ProjectRouteGuard = ({ children }: { children: ReactNode }) => {
  const { projectId = '' } = useParams();
  const { canProject } = useAuthz();

  if (!projectId || !canProject(projectId, 'project.view')) {
    return <AccessDeniedView message={`You do not have project.view access for ${projectId || 'this project'}.`} />;
  }

  return <>{children}</>;
};
