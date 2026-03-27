/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { parseReminderInput } from '../index.ts';

const now = new Date('2026-03-22T12:00:00-04:00');
const timezone = 'America/New_York';

const parse = (input: string) => parseReminderInput(input, { now, timezone });

describe('reminder parser recurrence extraction', () => {
  test('extracts weekly recurrence for "water plants every monday"', () => {
    const result = parse('water plants every monday');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'weekly',
      interval: 1,
      days: ['monday'],
    });
  });

  test('keeps "take meds daily" recurrence null (current behavior)', () => {
    const result = parse('take meds daily');
    // Potential issue: "daily" is only recognized when it appears at the start.
    assert.equal(result.fields.recurrence, null);
  });

  test('keeps "pay rent monthly on the 1st" recurrence null (current behavior)', () => {
    const result = parse('pay rent monthly on the 1st');
    // Potential issue: mid-sentence "monthly" is not extracted as recurrence.
    assert.equal(result.fields.recurrence, null);
  });

  test('keeps "team sync every other week" recurrence null (current behavior)', () => {
    const result = parse('team sync every other week');
    // Potential issue: no parser rule currently handles "every other week".
    assert.equal(result.fields.recurrence, null);
  });

  test('extracts interval recurrence for "every 3 days check inventory"', () => {
    const result = parse('every 3 days check inventory');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'daily',
      interval: 3,
      days: null,
    });
  });

  test('extracts multiple weekly days for "call grandma every sunday and wednesday"', () => {
    const result = parse('call grandma every sunday and wednesday');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'weekly',
      interval: 1,
      days: ['sunday', 'wednesday'],
    });
  });

  test('extracts yearly recurrence for "yearly on march 15"', () => {
    const result = parse('yearly on march 15');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'yearly',
      interval: 1,
      days: null,
    });
  });
});
