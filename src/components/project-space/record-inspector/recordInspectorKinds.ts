import type { HubRecordDetail } from '../../../shared/api-types/records';

export type RecordInspectorKind = 'event' | 'task' | 'file' | 'reminder' | 'generic';

const readCollectionLabel = (record: HubRecordDetail): string =>
  `${record.schema?.name || ''} ${record.collection_id}`.trim().toLowerCase();

const labelHasWord = (label: string, words: string[]): boolean =>
  words.some((word) => new RegExp(`\\b${word}s?\\b`, 'u').test(label));

export const resolveRecordInspectorKind = (record: HubRecordDetail): RecordInspectorKind => {
  const collectionLabel = readCollectionLabel(record);
  const isFileLabel = labelHasWord(collectionLabel, ['file', 'document', 'asset']);
  const isReminderLabel = labelHasWord(collectionLabel, ['reminder']);

  if (record.capabilities.task_state || record.capabilities.capability_types.includes('task')) {
    return 'task';
  }

  if (record.capabilities.event_state || record.capabilities.capability_types.includes('event')) {
    return 'event';
  }

  if (isFileLabel) {
    return 'file';
  }

  if (
    record.capabilities.capability_types.includes('reminder')
    || record.capabilities.recurrence_rule
    || isReminderLabel
  ) {
    return 'reminder';
  }

  return 'generic';
};
