import { useMemo, useState } from 'react';
import type { KanbanModuleGroup } from '../types';

interface UseKanbanGroupingParams {
  groups: KanbanModuleGroup[];
  onConfigureGrouping?: (fieldId: string) => void;
}

export const useKanbanGrouping = ({
  groups,
  onConfigureGrouping,
}: UseKanbanGroupingParams) => {
  const [groupingFieldSelection, setGroupingFieldSelection] = useState('');

  const recordGroupById = useMemo(() => {
    const map = new Map<string, string>();

    for (const group of groups) {
      for (const record of group.records) {
        map.set(record.record_id, group.id);
      }
    }

    return map;
  }, [groups]);

  const handleGroupingFieldChange = (fieldId: string) => {
    setGroupingFieldSelection(fieldId);
    if (fieldId) {
      onConfigureGrouping?.(fieldId);
      setGroupingFieldSelection('');
    }
  };

  return {
    groupingFieldSelection,
    recordGroupById,
    handleGroupingFieldChange,
  };
};
