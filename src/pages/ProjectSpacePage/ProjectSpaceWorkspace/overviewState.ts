import type { OverviewSubView } from './types';

export const readOverviewView = (searchParams: URLSearchParams): OverviewSubView => {
  const value = searchParams.get('view');
  if (value === 'calendar' || value === 'tasks' || value === 'kanban') {
    return value;
  }
  return 'timeline';
};
