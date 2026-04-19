import { useCallback, useRef, useState } from 'react';
import { listCollections } from '../../../services/hub/collections';
import type { HubCollection } from '../../../services/hub/types';
import { usePersonalCollectionsEffect } from './usePersonalCollectionsEffect';

interface UseQuickCaptureCollectionsParams {
  accessToken: string | null;
  personalProjectId: string | null;
}

export const useQuickCaptureCollections = ({
  accessToken,
  personalProjectId,
}: UseQuickCaptureCollectionsParams) => {
  const [personalCollections, setPersonalCollections] = useState<HubCollection[]>([]);
  const projectCollectionsCacheRef = useRef<Record<string, HubCollection[]>>({});

  usePersonalCollectionsEffect({
    accessToken,
    personalProjectId,
    setPersonalCollections,
    projectCollectionsCacheRef,
  });

  const loadPersonalCollections = useCallback(async () => {
    if (!accessToken || !personalProjectId) {
      return [];
    }
    const cached = projectCollectionsCacheRef.current[personalProjectId];
    if (cached) {
      setPersonalCollections(cached);
      return cached;
    }
    const collections = await listCollections(accessToken, personalProjectId);
    projectCollectionsCacheRef.current[personalProjectId] = collections;
    setPersonalCollections(collections);
    return collections;
  }, [accessToken, personalProjectId]);

  const loadProjectCollections = useCallback(
    async (projectId: string) => {
      if (!accessToken) {
        return [];
      }
      const cached = projectCollectionsCacheRef.current[projectId];
      if (cached) {
        return cached;
      }
      const collections = await listCollections(accessToken, projectId);
      projectCollectionsCacheRef.current[projectId] = collections;
      if (projectId === personalProjectId) {
        setPersonalCollections(collections);
      }
      return collections;
    },
    [accessToken, personalProjectId],
  );

  return {
    personalCollections,
    loadPersonalCollections,
    loadProjectCollections,
  };
};
