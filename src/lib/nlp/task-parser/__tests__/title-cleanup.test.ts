/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseTaskInput } from '../index.ts';

const now = new Date('2026-03-22T12:00:00-04:00');
const timezone = 'America/New_York';

const parseTitle = (input: string) => parseTaskInput(input, { now, timezone }).fields.title;

describe('task parser title cleanup', () => {
  test('strips date/time tokens in "buy groceries today at 7 pm"', () => {
    const title = parseTitle('buy groceries today at 7 pm');
    assert.equal(title, 'Buy Groceries');
  });

  test('extracts title after date/priority/assignee removal', () => {
    const title = parseTitle('urgent fix the login bug by friday for @mark');
    assert.equal(title, 'Fix the Login Bug');
  });

  test('keeps contextual "with <name>" text in title and does not treat bare names as assignees', () => {
    const title = parseTitle('meeting with sarah next monday at noon');
    assert.equal(title, 'Meeting with Sarah');
  });

  test('strips reminder-style lead prefixes from task titles', () => {
    const title = parseTitle('remind me to call mom next month');
    assert.equal(title, 'Call Mom');
  });

  test('strips orphaned leading "to" after reminder and recurrence phrase cleanup', () => {
    const title = parseTitle('remind me every other day to stretch');
    assert.equal(title, 'Stretch');
  });

  test('strips recurring/date tokens in recurring sentence', () => {
    const title = parseTitle('send emails every tuesday at 7 pm');
    assert.equal(title, 'Send Emails');
  });

  test('strips residual temporal words when earlier passes leave them behind', () => {
    const title = parseTitle('finish the report next month');
    assert.equal(title, 'Finish the Report');
  });

  test('preserves standalone "next" when it is part of normal title text', () => {
    const title = parseTitle('plan next steps');
    assert.equal(title, 'Plan Next Steps');
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
