/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseTaskInput } from '../index.ts';

const now = new Date('2026-03-22T12:00:00-04:00');
const timezone = 'America/New_York';

const parseTitle = (input: string) => parseTaskInput(input, { now, timezone }).title;

describe('task parser title cleanup', () => {
  test('keeps residual time tokens in "buy groceries today at 7 pm" (current behavior)', () => {
    const title = parseTitle('buy groceries today at 7 pm');
    // Potential issue: cleanup currently leaves "Today Pm".
    assert.equal(title, 'Buy Groceries Today Pm');
  });

  test('extracts title after date/priority/assignee removal', () => {
    const title = parseTitle('urgent fix the login bug by friday for @mark');
    assert.equal(title, 'Fix the Login Bug');
  });

  test('keeps weekday token in recurring sentence (current behavior)', () => {
    const title = parseTitle('send emails every tuesday at 7 pm');
    // Potential issue: title still includes weekday and "Pm".
    assert.equal(title, 'Send Emails Every Tuesday Pm');
  });

  test('normalizes excess whitespace', () => {
    const title = parseTitle('   buy   groceries   ');
    assert.equal(title, 'Buy Groceries');
  });

  test('removes leading emoji noise', () => {
    const title = parseTitle('🎂 plan party');
    assert.equal(title, 'Plan Party');
  });

  test('strips shorthand date tokens in "tmrw morning call mom"', () => {
    const title = parseTitle('tmrw morning call mom');
    assert.equal(title, 'Call Mom');
  });

  test('strips filler and priority in "pls fix the bug asap"', () => {
    const title = parseTitle('pls fix the bug asap');
    assert.equal(title, 'Fix the Bug');
  });
});
