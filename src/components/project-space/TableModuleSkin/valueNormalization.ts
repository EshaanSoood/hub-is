import type { ColumnDef } from '@tanstack/react-table';
import { formatShortDate } from '../taskAdapter';
import type { TableField, TableOption, TableRowData } from './types';

export const DATE_FILTER_OPTIONS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This week' },
] as const;

export const readRecordValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidates = [record.name, record.display_name, record.label, record.value, record.id];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return '';
};

export const readFieldOptions = (config: Record<string, unknown> | undefined): TableOption[] => {
  if (!config || !Array.isArray(config.options)) {
    return [];
  }

  const parsed = config.options
    .map((entry): TableOption | null => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return trimmed ? { id: trimmed, label: trimmed } : null;
      }

      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        const id = readRecordValue(record.id ?? record.value ?? record.key ?? record.name ?? record.label);
        if (!id) {
          return null;
        }
        const label = readRecordValue(record.label ?? record.name ?? id) || id;
        return { id, label };
      }

      return null;
    })
    .filter((option): option is TableOption => Boolean(option));

  const seen = new Set<string>();
  return parsed.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }
    seen.add(option.id);
    return true;
  });
};

export const normalizeDateInputValue = (value: unknown): string => {
  const raw = readRecordValue(value);
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

export const normalizeDateTimeInputValue = (value: unknown): string => {
  const raw = readRecordValue(value);
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

export const toComparable = (value: unknown, type: string): number | string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (type === 'number') {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? '' : parsed;
  }

  if (type === 'date' || type === 'datetime') {
    const timestamp = new Date(readRecordValue(value) || String(value)).getTime();
    return Number.isNaN(timestamp) ? '' : timestamp;
  }

  return readRecordValue(value).toLocaleLowerCase();
};

export const formatDisplayValue = (field: TableField | null, value: unknown): string => {
  if (!field) {
    return readRecordValue(value);
  }

  const rawValue = readRecordValue(value);
  if (!rawValue) {
    return '';
  }

  if (field.type === 'select') {
    return readFieldOptions(field.config).find((option) => option.id === rawValue)?.label ?? rawValue;
  }

  if (field.type === 'date' || field.type === 'datetime') {
    return formatShortDate(rawValue) ?? rawValue;
  }

  return rawValue;
};

export const isFreeformTextField = (field: TableField | null): boolean => field?.type === 'text' || field?.type === 'longText';

export const isNotesField = (field: TableField): boolean => {
  const normalized = `${field.field_id} ${field.name}`.toLocaleLowerCase();
  return normalized.includes('notes');
};

export const getFieldColumnSizing = (
  field: TableField,
  sizeTier: 'S' | 'M' | 'L',
): Pick<ColumnDef<TableRowData>, 'size' | 'minSize' | 'maxSize'> => {
  if (sizeTier === 'L' && isNotesField(field)) {
    return {
      size: 200,
      minSize: 160,
      maxSize: 220,
    };
  }

  return {
    size: 160,
    minSize: 120,
  };
};

export const getEditableFieldValue = (field: TableField | null, value: unknown): string => {
  if (!field) {
    return readRecordValue(value);
  }
  if (field.type === 'date') {
    return normalizeDateInputValue(value);
  }
  if (field.type === 'datetime') {
    return normalizeDateTimeInputValue(value);
  }
  return readRecordValue(value);
};

export const buildFieldUpdateValue = (field: TableField | null, value: string): unknown => {
  if (!field) {
    return value;
  }

  if (field.type === 'date' || field.type === 'select') {
    return value || null;
  }

  if (field.type === 'datetime') {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  if (field.type === 'number') {
    if (!value.trim()) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return value;
};

export const getEditableInputType = (field: TableField | null): 'date' | 'datetime-local' | 'number' | 'text' => {
  if (field?.type === 'date') {
    return 'date';
  }
  if (field?.type === 'datetime') {
    return 'datetime-local';
  }
  if (field?.type === 'number') {
    return 'number';
  }
  return 'text';
};

const toDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const matchesDatePreset = (value: unknown, preset: string): boolean => {
  if (!preset) {
    return true;
  }

  const normalized = normalizeDateInputValue(value);
  if (!normalized) {
    return false;
  }

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  const todayKey = toDayKey(today);
  const dateKey = toDayKey(date);

  if (preset === 'overdue') {
    return dateKey < todayKey;
  }

  if (preset === 'today') {
    return dateKey === todayKey;
  }

  if (preset === 'this-week') {
    const startOfWeek = new Date(today);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startKey = toDayKey(startOfWeek);
    const endOfWeek = new Date(today);
    endOfWeek.setHours(0, 0, 0, 0);
    const daysUntilSaturday = (6 - endOfWeek.getDay() + 7) % 7;
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSaturday);
    const endKey = toDayKey(endOfWeek);
    return dateKey >= startKey && dateKey <= endKey;
  }

  return true;
};
