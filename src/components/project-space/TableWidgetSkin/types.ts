import type { HubRecordSummary } from '../../../services/hub/types';

export interface TableField {
  field_id: string;
  collection_id?: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface TableOption {
  id: string;
  label: string;
}

export interface TableRowData {
  recordId: string;
  title: string;
  fields: Record<string, unknown>;
}

export interface TableSchema {
  collection_id: string;
  name: string;
  fields: TableField[];
}

export interface TableWidgetSkinProps {
  schema: TableSchema | null;
  records: HubRecordSummary[];
  loading: boolean;
  onOpenRecord?: (recordId: string) => void;
}
