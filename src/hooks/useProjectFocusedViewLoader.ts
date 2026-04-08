import { useEffect, useState } from 'react';

import type { HubView } from '../services/hub/types';
import { loadCompleteViewQuery, type TableViewRuntimeState, type ViewQueryResult } from './projectViewsRuntime/shared';

interface UseProjectFocusedViewLoaderParams {
  accessToken: string;
  activeTab: 'overview' | 'work' | 'tools';
  focusedWorkViewId: string;
  focusedWorkView: HubView | null;
  tableViewDataById: Record<string, TableViewRuntimeState>;
}

export const useProjectFocusedViewLoader = ({
  accessToken,
  activeTab,
  focusedWorkViewId,
  focusedWorkView,
  tableViewDataById,
}: UseProjectFocusedViewLoaderParams) => {
  const [focusedWorkViewData, setFocusedWorkViewData] = useState<ViewQueryResult | null>(null);
  const [focusedWorkViewLoading, setFocusedWorkViewLoading] = useState(false);
  const [focusedWorkViewError, setFocusedWorkViewError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'work' || !focusedWorkViewId || !focusedWorkView) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        setFocusedWorkViewData(null);
        setFocusedWorkViewError(null);
        setFocusedWorkViewLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    if (focusedWorkView.type === 'kanban') {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        setFocusedWorkViewData(null);
        setFocusedWorkViewError(null);
        setFocusedWorkViewLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    const cachedTableView = tableViewDataById[focusedWorkViewId];
    if (focusedWorkView.type === 'table' && cachedTableView) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        setFocusedWorkViewData({
          view: focusedWorkView,
          schema: cachedTableView.schema,
          records: cachedTableView.records,
          next_cursor: null,
        });
        setFocusedWorkViewError(cachedTableView.error ?? null);
        setFocusedWorkViewLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setFocusedWorkViewLoading(true);
      setFocusedWorkViewError(null);
    });
    void loadCompleteViewQuery(accessToken, focusedWorkViewId)
      .then((result) => {
        if (!cancelled) {
          setFocusedWorkViewData(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFocusedWorkViewData(null);
          setFocusedWorkViewError(error instanceof Error ? error.message : 'Failed to load the selected view.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFocusedWorkViewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, focusedWorkView, focusedWorkViewId, tableViewDataById]);

  return {
    focusedWorkViewData,
    focusedWorkViewLoading,
    focusedWorkViewError,
  };
};
