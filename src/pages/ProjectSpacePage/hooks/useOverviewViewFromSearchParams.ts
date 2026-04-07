import { type Dispatch, type SetStateAction, useEffect } from 'react';

interface UseOverviewViewFromSearchParamsParams<TOverviewView extends string> {
  searchParams: URLSearchParams;
  readOverviewView: (searchParams: URLSearchParams) => TOverviewView;
  setOverviewView: Dispatch<SetStateAction<TOverviewView>>;
}

export const useOverviewViewFromSearchParams = <TOverviewView extends string>({
  searchParams,
  readOverviewView,
  setOverviewView,
}: UseOverviewViewFromSearchParamsParams<TOverviewView>): void => {
  useEffect(() => {
    setOverviewView(readOverviewView(searchParams));
  }, [readOverviewView, searchParams, setOverviewView]);
};
