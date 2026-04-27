import { useMemo, useState } from 'react';
import type { TableField, TableRowData, TableSchema, TableOption } from '../types';
import { matchesDatePreset, readFieldOptions, readRecordValue } from '../valueNormalization';

const readSelectFilterValue = (value: unknown): string => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return readRecordValue(record.id ?? record.value ?? record.key ?? record.name ?? record.label);
  }
  return readRecordValue(value);
};

interface UseTableFilteringResult {
  activeFilters: Record<string, string>;
  setActiveFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  filtersOpen: boolean;
  setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filteredRows: TableRowData[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  filterableFields: TableField[];
  statusField: TableField | null;
  statusOptions: TableOption[];
}

export const useTableFiltering = (schema: TableSchema | null, rows: TableRowData[]): UseTableFilteringResult => {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredRows = useMemo<TableRowData[]>(() => {
    if (!schema) {
      return rows;
    }

    return rows.filter((row) =>
      schema.fields.every((field) => {
        const filterValue = activeFilters[field.field_id];
        if (!filterValue) {
          return true;
        }

        const rawValue = row.fields[field.field_id];
        if (field.type === 'date' || field.type === 'datetime') {
          return matchesDatePreset(rawValue, filterValue);
        }

        if (field.type === 'select') {
          return readSelectFilterValue(rawValue) === filterValue;
        }

        return true;
      }),
    );
  }, [activeFilters, rows, schema]);

  const hasActiveFilters = useMemo(() => Object.values(activeFilters).some(Boolean), [activeFilters]);
  const activeFilterCount = useMemo(() => Object.values(activeFilters).filter(Boolean).length, [activeFilters]);

  const filterableFields = useMemo(
    () => (schema?.fields ?? []).filter((field) => field.type === 'select' || field.type === 'date' || field.type === 'datetime'),
    [schema?.fields],
  );

  const statusField = useMemo(
    () =>
      (schema?.fields ?? []).find((field) => {
        if (field.type !== 'select') {
          return false;
        }
        const normalized = `${field.field_id} ${field.name}`.toLocaleLowerCase();
        return normalized.includes('status');
      }) ?? null,
    [schema?.fields],
  );

  const statusOptions = useMemo(() => (statusField ? readFieldOptions(statusField.config) : []), [statusField]);

  return {
    activeFilters,
    setActiveFilters,
    filtersOpen,
    setFiltersOpen,
    filteredRows,
    hasActiveFilters,
    activeFilterCount,
    filterableFields,
    statusField,
    statusOptions,
  };
};
