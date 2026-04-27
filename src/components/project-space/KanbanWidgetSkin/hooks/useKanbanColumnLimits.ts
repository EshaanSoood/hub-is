import { useMemo } from 'react';
import type { KanbanWidgetGroup } from '../types';

interface UseKanbanColumnLimitsParams {
  groups: KanbanWidgetGroup[];
  wipLimits?: Record<string, number>;
}

interface KanbanColumnLimitState {
  wipLimit?: number;
  overLimit: boolean;
}

export const useKanbanColumnLimits = ({
  groups,
  wipLimits,
}: UseKanbanColumnLimitsParams) => {
  return useMemo<Record<string, KanbanColumnLimitState>>(() => {
    const states: Record<string, KanbanColumnLimitState> = {};

    for (const group of groups) {
      const wipLimit = wipLimits?.[group.id];
      const count = group.records.length;
      states[group.id] = {
        wipLimit,
        overLimit: typeof wipLimit === 'number' && count > wipLimit,
      };
    }

    return states;
  }, [groups, wipLimits]);
};
