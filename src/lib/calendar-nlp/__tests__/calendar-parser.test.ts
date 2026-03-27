/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseEventInput } from '../index.ts';

const now = new Date('2026-03-27T10:00:00-04:00');
const timezone = 'America/New_York';

const parse = (input: string) => parseEventInput(input, { now, timezone });

describe('calendar parser accuracy regressions', () => {
  test('uses proper title case for small words in date-first sentence', () => {
    const result = parse('in 3 days finish the report');
    assert.equal(result.fields.title, 'Finish the Report');
    assert.equal(result.fields.date, '2026-03-30');
  });

  test('uses proper title case for small words in recurrence sentence', () => {
    const result = parse('check in with team every other week');
    assert.equal(result.fields.title, 'Check in with Team');
  });

  test('strips reminder lead phrase and title-cases event title', () => {
    const result = parse('remind me to call mom next month');
    assert.equal(result.fields.title, 'Call Mom');
    assert.equal(result.fields.date, '2026-04-27');
  });

  test('strips temporal context words like "morning" from final title', () => {
    const result = parse('buy groceries tomorrow morning');
    assert.equal(result.fields.title, 'Buy Groceries');
    assert.equal(result.fields.date, '2026-03-28');
  });

  test('keeps standalone "next" when it is part of the title', () => {
    const result = parse('plan next steps');
    assert.equal(result.fields.title, 'Plan Next Steps');
  });

  test('parses end-of-day and strips priority noise while preserving PR acronym', () => {
    const result = parse('high priority review PR by end of day');
    assert.equal(result.fields.date, '2026-03-27');
    assert.equal(result.fields.time, '17:00');
    assert.equal(result.fields.title, 'Review PR');
  });

  test('parses end-of-month and removes trailing temporal glue from title', () => {
    const result = parse('submit expenses end of month');
    assert.equal(result.fields.date, '2026-03-31');
    assert.equal(result.fields.title, 'Submit Expenses');
  });

  test('keeps small words lowercase in title-case output after stripping noise', () => {
    const result = parse('urgent fix the login bug by friday for @mark');
    assert.equal(result.fields.title, 'Fix the Login Bug');
    assert.equal(result.fields.date, '2026-03-27');
  });
});
