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

  test('extracts daily recurrence when "daily" appears at the start', () => {
    const result = parse('daily water plants');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'daily',
      interval: 1,
      days: null,
    });
    assert.equal(result.fields.title, 'Water Plants');
  });

  test('extracts monthly recurrence when "monthly" appears at the start', () => {
    const result = parse('monthly pay rent on the 1st');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'monthly',
      interval: 1,
      days: null,
    });
  });

  test('extracts every-other-week recurrence and keeps cleaned title', () => {
    const result = parse('check in with team every other week');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'weekly',
      interval: 2,
      days: null,
    });
    assert.equal(result.fields.title, 'Check in with Team');
  });

  test('strips orphaned leading filler after reminder + recurrence cleanup', () => {
    const result = parse('remind me every other day to stretch');
    assert.deepEqual(result.fields.recurrence, {
      frequency: 'daily',
      interval: 2,
      days: null,
    });
    assert.equal(result.fields.title, 'Stretch');
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
