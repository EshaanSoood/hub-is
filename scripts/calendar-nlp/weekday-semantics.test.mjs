import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEventInput } from '../../src/lib/calendar-nlp/index.ts';

const parse = (input, now) =>
  parseEventInput(input, {
    now,
    timezone: 'America/New_York',
    locale: 'en-US',
    debug: true,
  });

test('weekday semantics: wednesday reference', () => {
  const now = '2026-02-25T12:00:00-05:00';

  const bare = parse('sunday', now);
  assert.equal(bare.fields.date, '2026-03-01');

  const thisDay = parse('this sunday', now);
  assert.equal(thisDay.fields.date, '2026-03-01');
  assert.ok(thisDay.meta.confidence.date >= 0.85);

  const nextDay = parse('next sunday', now);
  assert.equal(nextDay.fields.date, '2026-03-01');
  assert.ok(nextDay.meta.confidence.date >= 0.85);
});

test('weekday semantics: sunday reference', () => {
  const now = '2026-03-01T09:00:00-05:00';

  const bare = parse('sunday', now);
  assert.equal(bare.fields.date, '2026-03-01');

  const thisDay = parse('this sunday', now);
  assert.equal(thisDay.fields.date, '2026-03-01');

  const nextDay = parse('next sunday', now);
  assert.equal(nextDay.fields.date, '2026-03-08');
});

test('weekday semantics: this monday does not go backward', () => {
  const now = '2026-02-28T12:00:00-05:00';
  const result = parse('this monday', now);

  assert.equal(result.fields.date, '2026-03-02');
  assert.ok(result.meta.confidence.date < 0.8);

  const fallbackNote = result.meta.debugSteps.find(
    (step) => step.ruleId === 'datetime.weekday.this' && /already passed this week; choosing upcoming/.test(step.note),
  );
  assert.ok(fallbackNote);
});

test('weekday extraction remains stable across locales', () => {
  const result = parseEventInput('next sunday', {
    now: '2026-02-25T12:00:00-05:00',
    timezone: 'America/New_York',
    locale: 'fr-FR',
    debug: true,
  });

  assert.equal(result.fields.date, '2026-03-01');
});
