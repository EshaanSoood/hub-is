import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TableField, TableRowData } from '../types';

interface UseTableBulkActionsArgs {
  filteredRows: TableRowData[];
  statusField: TableField | null;
  onDeleteRecords?: (recordIds: string[]) => Promise<void>;
  onBulkUpdateRecords?: (recordIds: string[], fields: Record<string, unknown>) => Promise<void>;
}

interface UseTableBulkActionsResult {
  selectedRecordIds: Set<string>;
  setSelectedRecordIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelectedRecord: (recordId: string, checked: boolean) => void;
  allVisibleSelected: boolean;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  bulkActionError: string | null;
  setBulkActionError: React.Dispatch<React.SetStateAction<string | null>>;
  bulkActionPending: boolean;
  clearSelection: () => void;
  runBulkDelete: () => Promise<void>;
  runBulkStatusUpdate: (value: string) => Promise<void>;
}

export const useTableBulkActions = ({
  filteredRows,
  statusField,
  onDeleteRecords,
  onBulkUpdateRecords,
}: UseTableBulkActionsArgs): UseTableBulkActionsResult => {
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const [bulkActionPending, setBulkActionPending] = useState(false);

  const visibleRowIds = useMemo(() => new Set(filteredRows.map((row) => row.recordId)), [filteredRows]);

  useEffect(() => {
    setSelectedRecordIds((current) => {
      const next = new Set<string>();
      for (const id of current) {
        if (visibleRowIds.has(id)) {
          next.add(id);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, [visibleRowIds]);

  const toggleSelectedRecord = useCallback((recordId: string, checked: boolean) => {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(recordId);
      } else {
        next.delete(recordId);
      }
      return next;
    });
  }, []);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedRecordIds.has(row.recordId));

  const clearSelection = useCallback(() => {
    setSelectedRecordIds(new Set());
    setBulkDeleteConfirm(false);
    setBulkActionError(null);
  }, []);

  const runBulkDelete = useCallback(async () => {
    if (!onDeleteRecords || bulkActionPending || selectedRecordIds.size === 0) {
      return;
    }

    setBulkActionPending(true);
    setBulkActionError(null);

    try {
      await onDeleteRecords([...selectedRecordIds]);
      clearSelection();
    } catch (error) {
      setBulkActionError(error instanceof Error ? error.message : 'Unable to delete selected records.');
    } finally {
      setBulkActionPending(false);
    }
  }, [bulkActionPending, clearSelection, onDeleteRecords, selectedRecordIds]);

  const runBulkStatusUpdate = useCallback(
    async (value: string) => {
      if (!onBulkUpdateRecords || !statusField || bulkActionPending || selectedRecordIds.size === 0 || !value) {
        return;
      }

      setBulkActionPending(true);
      setBulkActionError(null);

      try {
        await onBulkUpdateRecords([...selectedRecordIds], { [statusField.field_id]: value });
        clearSelection();
      } catch (error) {
        setBulkActionError(error instanceof Error ? error.message : 'Unable to update selected records.');
      } finally {
        setBulkActionPending(false);
      }
    },
    [bulkActionPending, clearSelection, onBulkUpdateRecords, selectedRecordIds, statusField],
  );

  return {
    selectedRecordIds,
    setSelectedRecordIds,
    toggleSelectedRecord,
    allVisibleSelected,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    bulkActionError,
    setBulkActionError,
    bulkActionPending,
    clearSelection,
    runBulkDelete,
    runBulkStatusUpdate,
  };
};
