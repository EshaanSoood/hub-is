import type { ReminderParseResult } from './nlp/reminder-parser';

export const emptyReminderPreview = (): ReminderParseResult => ({
  fields: {
    title: '',
    remind_at: null,
    recurrence: null,
    context_hint: null,
  },
  meta: {
    confidence: {
      title: 0,
      remind_at: 0,
      recurrence: 0,
      context_hint: 0,
    },
    spans: {
      title: [],
      remind_at: [],
      recurrence: [],
      context_hint: [],
    },
    debugSteps: [],
    maskedInput: '',
  },
  warnings: null,
});

export const hasMeaningfulReminderPreview = (preview: ReminderParseResult): boolean =>
  Boolean(preview.fields.title.trim() || preview.fields.remind_at || preview.fields.recurrence || preview.fields.context_hint);
