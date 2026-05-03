import { useMemo, useState } from 'react';
import { matchesDatePreset, readFieldOptions } from '../valueNormalization';
import type { TableRowData, TableSchema } from '../types';

export const useTableFiltering = (schema: TableSchema | null, rows: TableRowData[]) => {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const statusField = schema?.fields.find((field) => field.type === 'select') ?? null;
  const statusOptions = useMemo(() => readFieldOptions(statusField?.config), [statusField?.config]);
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        Object.entries(activeFilters).every(([fieldId, filterValue]) => {
          if (!filterValue) {
            return true;
          }
          const field = schema?.fields.find((entry) => entry.field_id === fieldId) ?? null;
          if (!field) {
            return true;
          }
          const value = row.fields[fieldId];
          if (field.type === 'date' || field.type === 'datetime') {
            return matchesDatePreset(value, filterValue);
          }
          return String(value ?? '') === filterValue;
        }),
      ),
    [activeFilters, rows, schema?.fields],
  );

  return {
    activeFilterCount,
    activeFilters,
    filteredRows,
    setActiveFilters,
    statusOptions,
  };
};
