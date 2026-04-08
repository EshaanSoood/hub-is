import type { HubRecordSummary } from '../../../services/hub/types';

export interface TableField {
  field_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface TableSchema {
  collection_id: string;
  name: string;
  fields: TableField[];
}

export interface TableViewOption {
  view_id: string;
  name: string;
}

export interface TableModuleSkinProps {
  sizeTier?: 'S' | 'M' | 'L';
  schema: TableSchema | null;
  records: HubRecordSummary[];
  loading: boolean;
  readOnly?: boolean;
  availableViews?: TableViewOption[];
  onOpenRecord: (recordId: string) => void;
  onCreateRecord?: (payload: { title: string; fields: Record<string, unknown> }) => Promise<void>;
  onSelectView?: (viewId: string) => void;
  onCreateView?: () => void;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecords?: (recordIds: string[]) => Promise<void>;
  onBulkUpdateRecords?: (recordIds: string[], fields: Record<string, unknown>) => Promise<void>;
}

export interface TableRowData {
  recordId: string;
  title: string;
  fields: Record<string, unknown>;
}

export interface EditableCellState {
  recordId: string;
  fieldId: string;
  value: string;
  baseline: string;
  error: string | null;
}

export interface CreateRowState {
  title: string;
  fields: Record<string, string>;
  error: string | null;
  isSubmitting: boolean;
}

export interface TableOption {
  id: string;
  label: string;
}
