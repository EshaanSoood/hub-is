import { useState } from 'react';
import type { SortingState } from '@tanstack/react-table';

interface UseTableSortingResult {
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
}

export const useTableSorting = (): UseTableSortingResult => {
  const [sorting, setSorting] = useState<SortingState>([]);
  return { sorting, setSorting };
};
