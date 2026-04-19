import { useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useOverviewViewFromSearchParams } from '../../hooks/useOverviewViewFromSearchParams';
import { useOverviewViewQuerySyncEffect } from '../../hooks/useOverviewViewQuerySyncEffect';
import type { OverviewSubView, TopLevelProjectTab } from '../types';
import { readOverviewView } from '../utils';

interface UseProjectSpaceOverviewStateParams {
  activeTab: TopLevelProjectTab;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

interface ProjectSpaceOverviewState {
  overviewView: OverviewSubView;
  setOverviewView: React.Dispatch<React.SetStateAction<OverviewSubView>>;
}

export const useProjectSpaceOverviewState = ({
  activeTab,
  searchParams,
  setSearchParams,
}: UseProjectSpaceOverviewStateParams): ProjectSpaceOverviewState => {
  const [overviewView, setOverviewView] = useState<OverviewSubView>(() => readOverviewView(searchParams));

  useOverviewViewFromSearchParams({
    searchParams,
    readOverviewView,
    setOverviewView,
  });

  useOverviewViewQuerySyncEffect({
    activeTab,
    overviewView,
    searchParams,
    setSearchParams,
  });

  return {
    overviewView,
    setOverviewView,
  };
};
