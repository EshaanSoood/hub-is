import type { HubRecordSummary } from '../../../services/hub/types';
import type { ModuleInsertState } from '../hooks/useModuleInsertState';

export const UNASSIGNED_ID = '__unassigned__';

export interface KanbanModuleGroup {
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

export interface KanbanModuleSkinProps {
  sizeTier?: 'S' | 'M' | 'L';
  groups: KanbanModuleGroup[];
  groupOptions: KanbanGroupOption[];
  loading: boolean;
  groupingConfigured: boolean;
  readOnly?: boolean;
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
  activeItemId: ModuleInsertState['activeItemId'];
  activeItemType: ModuleInsertState['activeItemType'];
  setActiveItem: ModuleInsertState['setActiveItem'];
  clearActiveItem: ModuleInsertState['clearActiveItem'];
  onInsertToEditor?: ModuleInsertState['onInsertToEditor'];
}

export interface KanbanCreateState {
  groupId: string | null;
  title: string;
  error: string | null;
  isSubmitting: boolean;
}
