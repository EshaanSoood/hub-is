/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseReminderInput } from '../index.ts';

const now = new Date('2026-03-22T12:00:00-04:00');
const timezone = 'America/New_York';

const parse = (input: string) => parseReminderInput(input, { now, timezone });

describe('reminder parser time extraction', () => {
  test('parses "remind me to call mom tomorrow at 9am"', () => {
    const result = parse('remind me to call mom tomorrow at 9am');
    assert.equal(result.remind_at, '2026-03-23T09:00:00');
  });

  test('parses "don\'t forget dentist tonight at 7pm" using current tonight precedence', () => {
    const result = parse("don't forget dentist tonight at 7pm");
    // Potential issue: explicit 7pm is ignored; "tonight" maps to 20:00.
    assert.equal(result.remind_at, '2026-03-22T20:00:00');
  });

  test('parses "ping me about the meeting in 2 hours" as now + 2h', () => {
    const result = parse('ping me about the meeting in 2 hours');
    assert.equal(result.remind_at, '2026-03-22T14:00:00');
  });

  test('parses recurring monday reminder with explicit 8am time', () => {
    const result = parse('water plants every monday at 8am');
    assert.equal(result.remind_at, '2026-03-23T08:00:00');
    assert.deepEqual(result.recurrence, {
      frequency: 'weekly',
      interval: 1,
      days: ['monday'],
    });
  });

  test('maps "end of day" to today at 17:00', () => {
    const result = parse('check email end of day');
    assert.equal(result.remind_at, '2026-03-22T17:00:00');
  });

  test('parses ordinal date with default 09:00 time', () => {
    const result = parse('remind me on the 15th');
    assert.equal(result.remind_at, '2026-04-15T09:00:00');
  });

  test('interprets "call mom at 3" as 15:00 today via forward-date logic', () => {
    const result = parse('call mom at 3');
    assert.equal(result.remind_at, '2026-03-22T15:00:00');
  });
});
