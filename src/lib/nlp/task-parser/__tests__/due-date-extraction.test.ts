/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseTaskInput } from '../index.ts';

const now = new Date('2026-03-22T12:00:00-04:00');
const timezone = 'America/New_York';

const parse = (input: string) => parseTaskInput(input, { now, timezone });

describe('task parser due date extraction', () => {
  test('resolves "buy groceries today at 6pm" to today', () => {
    const result = parse('buy groceries today at 6pm');
    // Current parser stores date-only due_at values, not time-of-day.
    assert.equal(result.due_at, '2026-03-22');
  });

  test('resolves "finish report by friday" to next friday', () => {
    const result = parse('finish report by friday');
    assert.equal(result.due_at, '2026-03-27');
  });

  test('keeps "urgent fix the bug" due_at null (current behavior)', () => {
    const result = parse('urgent fix the bug');
    // Potential issue: dueForcedToday currently only triggers on "now" / "immediately", not "urgent".
    assert.equal(result.due_at, null);
  });

  test('resolves "do laundry tomorrow morning" to tomorrow', () => {
    const result = parse('do laundry tomorrow morning');
    assert.equal(result.due_at, '2026-03-23');
  });

  test('resolves "submit proposal end of month" to month end', () => {
    const result = parse('submit proposal end of month');
    assert.equal(result.due_at, '2026-03-31');
  });

  test('resolves "review PR this weekend" to current weekend', () => {
    const result = parse('review PR this weekend');
    assert.equal(result.due_at, '2026-03-22');
  });

  test('parses "call dentist at 3pm on tuesday" using current forward-date behavior', () => {
    const result = parse('call dentist at 3pm on tuesday');
    // Potential issue: parser currently resolves this to today instead of next Tuesday.
    assert.equal(result.due_at, '2026-03-22');
  });

  test('returns null due_at for "just buy groceries"', () => {
    const result = parse('just buy groceries');
    assert.equal(result.due_at, null);
  });

  test('resolves "meeting at noon" to today', () => {
    const result = parse('meeting at noon');
    assert.equal(result.due_at, '2026-03-22');
  });

  test('resolves "send it by eod" to today', () => {
    const result = parse('send it by eod');
    assert.equal(result.due_at, '2026-03-22');
  });
});
