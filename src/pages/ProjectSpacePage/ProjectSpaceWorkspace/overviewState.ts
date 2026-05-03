import type { OverviewSubView } from './types';

export const readOverviewView = (searchParams: URLSearchParams): OverviewSubView => {
  const value = searchParams.get('view');
  if (value === 'hub' || value === 'timeline' || value === 'calendar' || value === 'tasks') {
    return value;
  }
  return 'hub';
};
