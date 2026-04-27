import { useCallback, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from 'react';

interface UseTableKeyboardGridArgs {
  modelRowsLength: number;
  rowRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  scrollToIndex: (index: number) => void;
  onOpenRecord: (recordId: string) => void;
}

interface UseTableKeyboardGridResult {
  handleRowKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>, index: number, recordId: string) => void;
}

export const useTableKeyboardGrid = ({
  modelRowsLength,
  rowRefs,
  scrollToIndex,
  onOpenRecord,
}: UseTableKeyboardGridArgs): UseTableKeyboardGridResult => {
  const focusRowByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= modelRowsLength) {
        return;
      }
      scrollToIndex(index);
      window.requestAnimationFrame(() => {
        rowRefs.current[index]?.focus();
      });
    },
    [modelRowsLength, rowRefs, scrollToIndex],
  );

  const handleRowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, index: number, recordId: string) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusRowByIndex(index + 1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusRowByIndex(index - 1);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        focusRowByIndex(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        focusRowByIndex(modelRowsLength - 1);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpenRecord(recordId);
      }
    },
    [focusRowByIndex, modelRowsLength, onOpenRecord],
  );

  return { handleRowKeyDown };
};
