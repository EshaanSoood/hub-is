import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthz } from './AuthzContext';
import { listHubProjects } from '../services/projectsService';
import type { ProjectRecord } from '../types/domain';

interface ProjectsContextValue {
  projects: ProjectRecord[];
  loading: boolean;
  initialized: boolean;
  error?: string;
  refreshProjects: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export const ProjectsProvider = ({ children }: { children: React.ReactNode }) => {
  const { signedIn, accessToken } = useAuthz();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const hasInitializedRef = useRef(false);

  const refreshProjects = useCallback(async () => {
    if (!signedIn || !accessToken) {
      setProjects([]);
      setError(undefined);
      hasInitializedRef.current = false;
      setLoading(false);
      setInitialized(false);
      return;
    }

    if (!hasInitializedRef.current) {
      setInitialized(false);
    }
    setLoading(true);
    try {
      const result = await listHubProjects(accessToken);
      if (result.error || !result.data) {
        setProjects([]);
        setError(result.error || 'Unable to load projects');
        return;
      }

      setProjects(result.data);
      setError(undefined);
    } finally {
      setLoading(false);
      hasInitializedRef.current = true;
      setInitialized(true);
    }
  }, [accessToken, signedIn]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      loading,
      initialized,
      error,
      refreshProjects,
    }),
    [error, initialized, loading, projects, refreshProjects],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};

export const useProjects = (): ProjectsContextValue => {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used inside ProjectsProvider');
  }
  return context;
};
