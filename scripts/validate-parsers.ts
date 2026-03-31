import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseEventInput } from '../src/lib/calendar-nlp/index.ts';
import { parseReminderInput } from '../src/lib/nlp/reminder-parser/index.ts';
import { parseTaskInput } from '../src/lib/nlp/task-parser/index.ts';

const referenceNow = new Date('2026-03-27T10:00:00');
const timezone = 'America/New_York';

const inputs = [
  'remind me to call mom next month',
  'in 3 days finish the report',
  'water plants daily',
  'check in with team every other week',
  'urgent fix the login bug by friday for @mark',
  'buy groceries tomorrow morning',
  'schedule dentist appointment next month at 3pm',
  'remind me in 2 weeks to renew subscription',
  'submit expenses end of month',
  'meeting with sarah next monday at noon',
  'remind me tonight to take out trash',
  'high priority review PR by end of day',
  'in 1 month plan the offsite',
  'remind me every other day to stretch',
  'call insurance company in 3 hours',
] as const;

type Row = {
  input: string;
  title: string;
  dateTime: string;
  recurrence: string;
  priority: string;
  warnings: string;
};

const mdCell = (value: string): string =>
  String(value || '—')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br />');

const formatWarnings = (
  warnings: Array<{ code: string; message: string }> | null | undefined,
): string => {
  if (!warnings || warnings.length === 0) {
    return '—';
  }
  return warnings.map((warning) => `${warning.code}: ${warning.message}`).join('<br />');
};

const formatRecurrence = (value: unknown): string => {
  if (!value) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const taskRows: Row[] = inputs.map((input) => {
  const result = parseTaskInput(input, { now: referenceNow, timezone });
  const row: Row = {
    input,
    title: result.fields.title || '—',
    dateTime: result.fields.due_at || '—',
    recurrence: '—',
    priority: result.fields.priority || '—',
    warnings: formatWarnings(result.warnings),
  };

  console.log(
    JSON.stringify({
      input,
      parser: 'task',
      title: row.title,
      date_time: row.dateTime,
      recurrence: row.recurrence,
      priority: row.priority,
      warnings: row.warnings,
    }),
  );

  return row;
});

const reminderRows: Row[] = inputs.map((input) => {
  const result = parseReminderInput(input, { now: referenceNow, timezone });
  const row: Row = {
    input,
    title: result.fields.title || '—',
    dateTime: result.fields.remind_at || '—',
    recurrence: formatRecurrence(result.fields.recurrence),
    priority: '—',
    warnings: formatWarnings(result.warnings),
  };

  console.log(
    JSON.stringify({
      input,
      parser: 'reminder',
      title: row.title,
      date_time: row.dateTime,
      recurrence: row.recurrence,
      priority: row.priority,
      warnings: row.warnings,
    }),
  );

  return row;
});

const calendarRows: Row[] = inputs.map((input) => {
  const result = parseEventInput(input, { now: referenceNow, timezone });
  const dateTime =
    result.fields.date && result.fields.time
      ? `${result.fields.date} ${result.fields.time}`
      : result.fields.date || result.fields.time || '—';

  const row: Row = {
    input,
    title: result.fields.title || '—',
    dateTime,
    recurrence: formatRecurrence(result.fields.recurrence),
    priority: '—',
    warnings: formatWarnings(result.warnings),
  };

  console.log(
    JSON.stringify({
      input,
      parser: 'calendar',
      title: row.title,
      date_time: row.dateTime,
      recurrence: row.recurrence,
      priority: row.priority,
      warnings: row.warnings,
    }),
  );

  return row;
});

const buildTable = (heading: string, rows: Row[]): string => {
  const lines = [
    `## ${heading}`,
    '',
    '| Input | Title | Date/Time | Recurrence | Priority | Warnings |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${mdCell(row.input)} | ${mdCell(row.title)} | ${mdCell(row.dateTime)} | ${mdCell(row.recurrence)} | ${mdCell(row.priority)} | ${mdCell(row.warnings)} |`,
    ),
    '',
  ];

  return lines.join('\n');
};

const output = [
  '# Parser Validation Results',
  '',
  `Reference Now: ${referenceNow.toISOString()}`,
  `Timezone: ${timezone}`,
  '',
  buildTable('Task Parser Results', taskRows),
  buildTable('Reminder Parser Results', reminderRows),
  buildTable('Calendar Parser Results', calendarRows),
].join('\n');

const outputPath = resolve(process.cwd(), 'parser-validation-results.md');
writeFileSync(outputPath, output, 'utf8');

console.log(`Wrote parser validation results to ${outputPath}`);
