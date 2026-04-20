import { useMemo } from 'react';
import type { ProjectRecord } from '../../types/domain';

export interface HomeSurfaceIdentity {
  backingProject: ProjectRecord | null;
  backingProjectId: string | null;
  label: 'Home';
  surfaceId: 'home';
}

interface UseHomeSurfaceIdentityParams {
  backendPersonalProjectId: string | null;
  projects: ProjectRecord[];
}

export const useHomeSurfaceIdentity = ({
  backendPersonalProjectId,
  projects,
}: UseHomeSurfaceIdentityParams): HomeSurfaceIdentity => useMemo(() => {
  const backingProject = (
    (backendPersonalProjectId
      ? projects.find((project) => project.id === backendPersonalProjectId) || null
      : null)
    ?? projects.find((project) => project.isPersonal)
    ?? null
  );

  return {
    backingProject,
    backingProjectId: backingProject?.id ?? backendPersonalProjectId,
    label: 'Home',
    surfaceId: 'home',
  };
}, [backendPersonalProjectId, projects]);
