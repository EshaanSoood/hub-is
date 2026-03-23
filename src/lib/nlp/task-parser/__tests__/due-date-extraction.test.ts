/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseTaskInput } from '../index.ts';

const now = new Date('2026-03-22T12:00:00-04:00');
const timezone = 'America/New_York';

const parse = (input: string) => parseTaskInput(input, { now, timezone });

describe('task parser due date extraction', () => {
  test('resolves "buy groceries today at 6pm" to a concrete datetime', () => {
    const result = parse('buy groceries today at 6pm');
    assert.equal(result.fields.due_at, '2026-03-22T18:00:00');
  });

  test('resolves "finish report by friday" to next friday', () => {
    const result = parse('finish report by friday');
    assert.equal(result.fields.due_at, '2026-03-27T12:00:00');
  });

  test('sets "urgent fix the bug" due_at to now (current behavior)', () => {
    const result = parse('urgent fix the bug');
    assert.equal(result.fields.due_at, '2026-03-22T12:00:00');
  });

  test('resolves "do laundry tomorrow morning" to tomorrow', () => {
    const result = parse('do laundry tomorrow morning');
    assert.equal(result.fields.due_at, '2026-03-23T06:00:00');
  });

  test('resolves "submit proposal end of month" to month end', () => {
    const result = parse('submit proposal end of month');
    assert.equal(result.fields.due_at, '2026-03-31T23:59:00');
  });

  test('resolves "review PR this weekend" to current weekend', () => {
    const result = parse('review PR this weekend');
    assert.equal(result.fields.due_at, '2026-03-22T23:59:00');
  });

  test('parses "call dentist at 3pm on tuesday" to next Tuesday afternoon', () => {
    const result = parse('call dentist at 3pm on tuesday');
    assert.equal(result.fields.due_at, '2026-03-24T15:00:00');
  });

  test('returns null due_at for "just buy groceries"', () => {
    const result = parse('just buy groceries');
    assert.equal(result.fields.due_at, null);
  });

  test('resolves "meeting at noon" to today', () => {
    const result = parse('meeting at noon');
    assert.equal(result.fields.due_at, '2026-03-22T12:00:00');
  });

  test('resolves "send it by eod" to today', () => {
    const result = parse('send it by eod');
    assert.equal(result.fields.due_at, '2026-03-22T23:59:00');
  });
});
