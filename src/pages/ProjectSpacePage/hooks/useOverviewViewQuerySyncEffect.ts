import { useEffect } from 'react';
import { type SetURLSearchParams } from 'react-router-dom';

interface UseOverviewViewQuerySyncEffectParams {
  activeTab: string;
  overviewView: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export const useOverviewViewQuerySyncEffect = ({
  activeTab,
  overviewView,
  searchParams,
  setSearchParams,
}: UseOverviewViewQuerySyncEffectParams): void => {
  useEffect(() => {
    if (activeTab === 'overview') {
      const currentView = searchParams.get('view');
      const hasKanbanViewId = searchParams.has('kanban_view_id');
      if (currentView === overviewView && !hasKanbanViewId) {
        return;
      }
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('view', overviewView);
        next.delete('kanban_view_id');
        return next;
      }, { replace: true });
    }
  }, [activeTab, overviewView, searchParams, setSearchParams]);
};
