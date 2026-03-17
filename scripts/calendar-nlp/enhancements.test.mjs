import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEventInput } from '../../src/lib/calendar-nlp/index.ts';

const baseOpts = {
  now: '2026-02-25T12:00:00-05:00',
  timezone: 'America/New_York',
  locale: 'en-US',
  debug: true,
};

test('defaults end_time to +60 minutes when only start time exists', () => {
  const result = parseEventInput('meeting with shanon 6 pm', baseOpts);

  assert.equal(result.fields.time, '18:00');
  assert.equal(result.fields.end_time, '19:00');
  assert.equal(result.fields.duration_minutes, 60);
});

test('recurrence till/until date maps to recurrence.end_date, not one-time date', () => {
  const result = parseEventInput('meeting with bob every monday at 7 till july 24.', baseOpts);

  assert.equal(result.fields.recurrence.frequency, 'weekly');
  assert.equal(result.fields.recurrence.end_date, '2026-07-24');
  assert.equal(result.fields.date, null);
  assert.equal(result.fields.time, '19:00');
  assert.equal(result.fields.end_time, '20:00');
  assert.equal(result.fields.duration_minutes, 60);
  assert.equal(result.warnings, null);
});

test('starting + date is treated as recurrence start anchor when recurrence exists', () => {
  const result = parseEventInput(
    'salsa class every other tuesday starting march 11th till august 9th at 9 pm',
    baseOpts,
  );

  assert.equal(result.fields.recurrence.frequency, 'weekly');
  assert.equal(result.fields.recurrence.interval, 2);
  assert.deepEqual(result.fields.recurrence.days, ['tuesday']);
  assert.equal(result.fields.date, null);
  assert.equal(result.fields.recurrence.end_date, '2026-08-09');
  assert.equal(result.fields.time, '21:00');
  assert.equal(result.fields.end_time, '22:00');
  assert.equal(result.fields.duration_minutes, 60);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.warnings?.some((warning) => warning.code === 'recurrence_start_weekday_mismatch'));
});

test('one-off explicit date wins over conflicting weekday and emits warning', () => {
  const result = parseEventInput('meeting on march 11th tuesday at 7', baseOpts);

  assert.equal(result.fields.date, '2026-03-11');
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.warnings?.some((warning) => warning.code === 'weekday_date_conflict'));
});

test('title cleanup removes trailing until/till glue and periods', () => {
  const result = parseEventInput('guitar lesson until.', baseOpts);
  assert.equal(result.fields.title, 'guitar lesson');
});

test('numeric day durations are parsed', () => {
  const result = parseEventInput('offsite for 2 days starting march 14 at 9am', baseOpts);

  assert.equal(result.fields.duration_minutes, 2880);
});

test('recurrence exceptions merge across matches and stay recurrence-scoped', () => {
  const recurring = parseEventInput('team sync every monday except march 9; except march 16 at 9am', baseOpts);
  assert.equal(recurring.fields.recurrence.frequency, 'weekly');
  assert.deepEqual(recurring.fields.recurrence.exceptions, ['2026-03-09', '2026-03-16']);

  const oneOff = parseEventInput('call mom except march 9 at 9am', baseOpts);
  assert.equal(oneOff.fields.recurrence.frequency, null);
  assert.equal(oneOff.fields.recurrence.exceptions, null);
});

test('exceptions are preserved for each-week recurrence phrasing', () => {
  const result = parseEventInput('planning each week except march 9 at 9am', baseOpts);

  assert.equal(result.fields.recurrence.frequency, 'weekly');
  assert.deepEqual(result.fields.recurrence.exceptions, ['2026-03-09']);
});

test('each-week recurrence keeps its end date', () => {
  const result = parseEventInput('planning each week until march 9 at 9am', baseOpts);

  assert.equal(result.fields.recurrence.frequency, 'weekly');
  assert.equal(result.fields.recurrence.end_date, '2026-03-09');
});

test('impossible month-day fallback dates are rejected', () => {
  const result = parseEventInput('planning session on february 31 at 9am', baseOpts);

  assert.equal(result.fields.date, null);
});
