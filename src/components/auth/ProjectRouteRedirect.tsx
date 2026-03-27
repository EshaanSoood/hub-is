import { Navigate, useParams } from 'react-router-dom';

export const ProjectRouteRedirect = () => {
  const { projectId = '' } = useParams();

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  return <Navigate to={`/projects/${encodeURIComponent(projectId)}/overview`} replace />;
};
