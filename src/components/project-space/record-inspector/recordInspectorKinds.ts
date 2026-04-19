import type { HubRecordDetail } from '../../../shared/api-types/records';

export type RecordInspectorKind = 'event' | 'task' | 'file' | 'reminder' | 'generic';

const readCollectionLabel = (record: HubRecordDetail): string =>
  `${record.schema?.name || ''} ${record.collection_id}`.trim().toLowerCase();

export const resolveRecordInspectorKind = (record: HubRecordDetail): RecordInspectorKind => {
  const collectionLabel = readCollectionLabel(record);

  if (record.capabilities.task_state || record.capabilities.capability_types.includes('task')) {
    return 'task';
  }

  if (record.capabilities.event_state || record.capabilities.capability_types.includes('event')) {
    return 'event';
  }

  if (
    record.capabilities.capability_types.includes('reminder')
    || record.capabilities.reminders.length > 0
    || record.capabilities.recurrence_rule
    || collectionLabel.includes('reminder')
  ) {
    return 'reminder';
  }

  if (
    collectionLabel.includes('file')
    || collectionLabel.includes('document')
    || collectionLabel.includes('asset')
  ) {
    return 'file';
  }

  return 'generic';
};
