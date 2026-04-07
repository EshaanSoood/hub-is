import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';
import { listCollections } from '../../../services/hub/collections';
import type { HubCollection } from '../../../services/hub/types';

interface UsePersonalCollectionsEffectParams {
  accessToken: string | null;
  personalProjectId: string | null;
  setPersonalCollections: Dispatch<SetStateAction<HubCollection[]>>;
  projectCollectionsCacheRef: MutableRefObject<Record<string, HubCollection[]>>;
}

export const usePersonalCollectionsEffect = ({
  accessToken,
  personalProjectId,
  setPersonalCollections,
  projectCollectionsCacheRef,
}: UsePersonalCollectionsEffectParams): void => {
  useEffect(() => {
    if (!accessToken || !personalProjectId) {
      setPersonalCollections([]);
      return;
    }

    let cancelled = false;
    void listCollections(accessToken, personalProjectId)
      .then((collections) => {
        if (!cancelled) {
          projectCollectionsCacheRef.current[personalProjectId] = collections;
          setPersonalCollections(collections);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonalCollections([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, personalProjectId]);
};
