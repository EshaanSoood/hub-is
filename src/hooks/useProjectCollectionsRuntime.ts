import { useCallback, useState } from 'react';

import { listCollectionFields, listCollections } from '../services/hub/collections';
import type { HubCollection } from '../services/hub/types';

interface UseProjectCollectionsRuntimeParams {
  accessToken: string;
  projectId: string;
}

export const useProjectCollectionsRuntime = ({ accessToken, projectId }: UseProjectCollectionsRuntimeParams) => {
  const [collections, setCollections] = useState<HubCollection[]>([]);

  const refreshCollections = useCallback(async () => {
    const nextCollections = await listCollections(accessToken, projectId);
    setCollections(nextCollections);

    // Intentional cache warm-up: field results are discarded.
    await Promise.all(nextCollections.map((collection) => listCollectionFields(accessToken, collection.collection_id)));

    return nextCollections;
  }, [accessToken, projectId]);

  return {
    collections,
    refreshCollections,
  };
};
