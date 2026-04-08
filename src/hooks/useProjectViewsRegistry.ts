import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listViews } from '../services/hub/views';
import type { HubView } from '../services/hub/types';

interface UseProjectViewsRegistryParams {
  accessToken: string;
  projectId: string;
  activeTab: 'overview' | 'work' | 'tools';
}

export const useProjectViewsRegistry = ({ accessToken, projectId, activeTab }: UseProjectViewsRegistryParams) => {
  const [searchParams] = useSearchParams();
  const [views, setViews] = useState<HubView[]>([]);
  const [selectedEmbedViewId, setSelectedEmbedViewId] = useState('');

  const focusedWorkViewId = activeTab === 'work' ? searchParams.get('view_id') || '' : '';
  const focusedWorkView = useMemo(
    () => (focusedWorkViewId ? views.find((view) => view.view_id === focusedWorkViewId) || null : null),
    [focusedWorkViewId, views],
  );

  const refreshViews = useCallback(async () => {
    const nextViews = await listViews(accessToken, projectId);
    setViews(nextViews);
    setSelectedEmbedViewId((current) => {
      if (current && nextViews.some((view) => view.view_id === current)) {
        return current;
      }
      return nextViews[0]?.view_id || '';
    });

    return nextViews;
  }, [accessToken, projectId]);

  return {
    views,
    selectedEmbedViewId,
    setSelectedEmbedViewId,
    focusedWorkViewId,
    focusedWorkView,
    refreshViews,
  };
};
