import type { HubRecordSummary } from '../../../services/hub/types';
import type { WidgetInsertState } from '../hooks/useWidgetInsertState';

export const UNASSIGNED_ID = '__unassigned__';

export interface KanbanWidgetGroup {
  id: string;
  label: string;
  records: HubRecordSummary[];
}

export interface KanbanGroupOption {
  id: string;
  label: string;
}

export interface KanbanGroupableField {
  field_id: string;
  name: string;
}

export interface KanbanMetadataFieldIds {
  priority?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
}

export interface KanbanWidgetSkinProps {
  sizeTier?: 'S' | 'M' | 'L';
  groups: KanbanWidgetGroup[];
  groupOptions: KanbanGroupOption[];
  loading: boolean;
  groupingConfigured: boolean;
  readOnly?: boolean;
  previewMode?: boolean;
  groupingMessage?: string;
  metadataFieldIds?: KanbanMetadataFieldIds;
  groupableFields?: KanbanGroupableField[];
  wipLimits?: Record<string, number>;
  onOpenRecord: (recordId: string) => void;
  onMoveRecord: (recordId: string, nextGroup: string) => void;
  onCreateRecord?: (payload: { title: string; groupFieldValue: string }) => Promise<void>;
  onConfigureGrouping?: (fieldId: string) => void;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface EditableCardFields {
  title: string;
  priority: string;
  assignee: string;
  dueDate: string;
}

export interface KanbanInsertHandlers {
  activeItemId: WidgetInsertState['activeItemId'];
  activeItemType: WidgetInsertState['activeItemType'];
  setActiveItem: WidgetInsertState['setActiveItem'];
  clearActiveItem: WidgetInsertState['clearActiveItem'];
  onInsertToEditor?: WidgetInsertState['onInsertToEditor'];
}

export interface KanbanCreateState {
  groupId: string | null;
  title: string;
  error: string | null;
  isSubmitting: boolean;
}
